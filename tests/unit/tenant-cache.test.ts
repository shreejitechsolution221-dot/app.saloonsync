import { expect, it, vi } from 'vitest';
import { z } from 'zod';
import { TenantCache, type CacheStore } from '@/lib/performance/tenant-cache';
const a = '11111111-1111-4111-8111-111111111111', b = '22222222-2222-4222-8222-222222222222';
function fixture() {
  const data = new Map<string, string>();
  const store: CacheStore = { get: vi.fn(async key => data.get(key) ?? null), set: vi.fn(async (key, value) => { data.set(key, value); }), increment: vi.fn(async key => { const next = Number(data.get(key) ?? 0) + 1; data.set(key, String(next)); return next; }) };
  const cache = new TenantCache(store);
  const scope = { tenantId: a, userId: a, role: 'owner', permissions: ['service.read'], branchIds: [a] };
  const input = { scope, filters: { active: true }, ttlSeconds: 30, schema: z.object({ name: z.string() }).strict(), load: vi.fn(async () => ({ name: 'Fresh' })) };
  return { data, store, cache, input };
}
it('isolates tenants, users, roles, branch scope and filters', async () => {
  const { cache, input } = fixture();
  await cache.read(input); await cache.read(input); expect(input.load).toHaveBeenCalledTimes(1);
  for (const scope of [{ ...input.scope, tenantId: b }, { ...input.scope, userId: b }, { ...input.scope, role: 'staff' }, { ...input.scope, branchIds: [b] }, { ...input.scope, permissions: [] }]) await cache.read({ ...input, scope });
  await cache.read({ ...input, filters: { active: false } });
  expect(input.load).toHaveBeenCalledTimes(7);
});
it('invalidates generations after a mutation', async () => {
  const { cache, input } = fixture(); await cache.read(input);
  expect(await cache.invalidate(a)).toBe(true);
  input.load.mockResolvedValue({ name: 'Changed' });
  expect(await cache.read(input)).toEqual({ name: 'Changed' });
});
it('does not republish an in-flight fill after invalidation', async () => {
  const { cache, input, store } = fixture();
  let finish!: (value: { name: string }) => void;
  let started!: () => void; const loading = new Promise<void>(resolve => { started = resolve; });
  const pending = cache.read({ ...input, load: () => { started(); return new Promise(resolve => { finish = resolve; }); } });
  await loading; await cache.invalidate(a); finish({ name: 'Old' }); await pending;
  expect(store.set).not.toHaveBeenCalled();
  expect(await cache.read(input)).toEqual({ name: 'Fresh' });
});
it('degrades to authoritative reads during a store outage and reports invalidation failure', async () => {
  const { cache, input, store } = fixture(); vi.mocked(store.get).mockRejectedValue(new Error('offline'));
  expect(await cache.read(input)).toEqual({ name: 'Fresh' }); await cache.read(input);
  expect(store.get).toHaveBeenCalledTimes(1); expect(input.load).toHaveBeenCalledTimes(2);
  vi.mocked(store.increment).mockRejectedValue(new Error('offline'));
  expect(await cache.invalidate(a)).toBe(false);
});
it('treats malformed JSON as a miss, bounds TTL and preserves loader failures', async () => {
  const { cache, input, data } = fixture(); await cache.read(input);
  for (const key of data.keys()) if (key.includes(':generation:')) data.set(key, '{bad');
  expect(await cache.read(input)).toEqual({ name: 'Fresh' }); expect(input.load).toHaveBeenCalledTimes(2);
  await expect(cache.read({ ...input, ttlSeconds: 9999 })).rejects.toThrow();
  await cache.invalidate(a); input.load.mockRejectedValue(new Error('Database unavailable'));
  await expect(cache.read(input)).rejects.toThrow('Database unavailable');
});
