import { createHash } from 'node:crypto';
import { z } from 'zod';
// Adapter contract for a real Redis client. No in-memory production fallback.
export interface CacheStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  increment(key: string): Promise<number>;
}
export type CacheScope = {
  tenantId: string; userId: string; role: string; permissions: readonly string[]; branchIds: readonly string[];
};
const scopeSchema = z.object({ tenantId: z.uuid(), userId: z.uuid(), role: z.string().min(1).max(64), permissions: z.array(z.string().max(80)).max(100), branchIds: z.array(z.uuid()).max(1000) });
const filtersSchema = z.record(z.string().max(80), z.union([z.string().max(512), z.number().finite(), z.boolean()])).refine(value => Object.keys(value).length <= 32);
const counters = { hit: 0, miss: 0, error: 0, invalidation: 0, coalesced: 0 };
function digest(value: unknown) { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
export function tenantCacheMetrics() {
  return Object.entries(counters).map(([event, count]) => `saloonsync_cache_events_total{event="${event}"} ${count}`).join('\n') + '\n';
}
export class TenantCache {
  private openUntil = 0;
  private inFlight = new Map<string, Promise<unknown>>();
  constructor(private store: CacheStore) {}
  private generationKey(tenantId: string) {
    return `saloonsync:v1:tenant:${z.uuid().parse(tenantId)}:catalog:generation`;
  }
  private async generation(tenantId: string) {
    const raw = await this.store.get(this.generationKey(tenantId));
    if (raw !== null && !/^\d{1,16}$/.test(raw)) throw new Error('Invalid cache generation');
    return raw ?? '0';
  }
  private outage() { counters.error++; this.openUntil = Date.now() + 10000; }
  // Callers must freshly authorize this scope BEFORE invoking read, on every hit.
  async read<T>(input: { scope: CacheScope; filters: Record<string, string | number | boolean>; ttlSeconds: number; schema: z.ZodType<T>; load: () => Promise<T> }): Promise<T> {
    const scope = scopeSchema.parse(input.scope);
    const ttl = z.number().int().min(1).max(300).parse(input.ttlSeconds);
    const filters = Object.fromEntries(Object.entries(filtersSchema.parse(input.filters)).sort(([a], [b]) => a.localeCompare(b)));
    if (JSON.stringify(filters).length > 4096) throw new Error('Cache filters too large');
    const load = async () => input.schema.parse(await input.load());
    if (Date.now() < this.openUntil) return load();
    let generation: string, key: string;
    try {
      generation = await this.generation(scope.tenantId);
      key = `${this.generationKey(scope.tenantId)}:${generation}:${digest({ userId: scope.userId, role: scope.role, permissions: [...new Set(scope.permissions)].sort(), branchIds: [...new Set(scope.branchIds)].sort(), filters })}`;
      const raw = await this.store.get(key);
      if (raw !== null && Buffer.byteLength(raw) <= 65536) {
        try { const value = input.schema.parse(JSON.parse(raw)); counters.hit++; return value; }
        catch { /* Corrupt data is a miss, never a fabricated successful response. */ }
      }
    } catch { this.outage(); return load(); }
    counters.miss++;
    const existing = this.inFlight.get(key);
    if (existing) { counters.coalesced++; return existing as Promise<T>; }
    const pending = (async () => {
      const value = await load();
      // JSON.stringify can throw for unsupported values; never fail a good DB read.
      try {
        const serialized = JSON.stringify(value);
        if (serialized !== undefined && Buffer.byteLength(serialized) <= 65536 && await this.generation(scope.tenantId) === generation) await this.store.set(key, serialized, ttl);
      } catch { this.outage(); }
      return value;
    })();
    if (this.inFlight.size < 128) this.inFlight.set(key, pending);
    try { return await pending; } finally { if (this.inFlight.get(key) === pending) this.inFlight.delete(key); }
  }
  // Increment rather than delete: a concurrent old-generation fill cannot become current.
  // A false result REQUIRES durable reconciliation/bypass before enabling live caching.
  async invalidate(tenantId: string): Promise<boolean> {
    const key = this.generationKey(tenantId);
    try { await this.store.increment(key); counters.invalidation++; return true; }
    catch { this.outage(); return false; }
  }
}
