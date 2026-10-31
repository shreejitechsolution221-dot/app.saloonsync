import { z } from 'zod';
export const vitalSchema = z.discriminatedUnion('name', [
  z.object({ name: z.literal('LCP'), value: z.number().finite().min(0).max(300000) }).strict(),
  z.object({ name: z.literal('INP'), value: z.number().finite().min(0).max(300000) }).strict(),
  z.object({ name: z.literal('CLS'), value: z.number().finite().min(0).max(100) }).strict(),
]);
type Name = 'LCP' | 'INP' | 'CLS';
const limits: Record<Name, number[]> = { LCP: [1000, 2500, 4000, 10000, 300000], INP: [100, 200, 500, 1000, 300000], CLS: [0.05, 0.1, 0.25, 1, 100] };
const state = globalThis as unknown as { perfVitals?: { second: number; received: number; rows: Map<Name, { count: number; sum: number; buckets: number[] }> } };
const stats: NonNullable<typeof state.perfVitals> = state.perfVitals ??= { second: 0, received: 0, rows: new Map() };
export function admitVital(now = Date.now()) {
  const second = Math.floor(now / 1000);
  if (stats.second !== second) { stats.second = second; stats.received = 0; }
  return ++stats.received <= 60;
}
export function observeVital(vital: z.infer<typeof vitalSchema>) {
  const row = stats.rows.get(vital.name) ?? { count: 0, sum: 0, buckets: limits[vital.name].map(() => 0) };
  row.count++; row.sum += vital.value;
  limits[vital.name].forEach((bound, i) => { if (vital.value <= bound) row.buckets[i]++; });
  stats.rows.set(vital.name, row);
}
export function vitalMetrics() {
  const lines = ['# TYPE saloonsync_web_vital histogram'];
  for (const [name, row] of stats.rows) {
    limits[name].forEach((bound, i) => lines.push(`saloonsync_web_vital_bucket{name="${name}",le="${bound}"} ${row.buckets[i]}`));
    lines.push(`saloonsync_web_vital_bucket{name="${name}",le="+Inf"} ${row.count}`, `saloonsync_web_vital_count{name="${name}"} ${row.count}`, `saloonsync_web_vital_sum{name="${name}"} ${row.sum}`);
  }
  return lines.join('\n') + '\n';
}
