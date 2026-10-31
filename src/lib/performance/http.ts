import { randomUUID, timingSafeEqual } from 'node:crypto';
// Fixed route templates only. Never put identity, query strings or raw paths here.
export type RouteName = 'health' | 'ready' | 'appointments';
const bounds = [0.05, 0.1, 0.2, 0.4, 1, 2, 5, 15, 30];
const registry = globalThis as unknown as { perfHttp?: Map<RouteName, { count: number; errors: number; sum: number; buckets: number[] }> };
const stats = registry.perfHttp ??= new Map();
export function observe(route: RouteName, seconds: number, status: number) {
  const row = stats.get(route) ?? { count: 0, errors: 0, sum: 0, buckets: bounds.map(() => 0) };
  row.count++; row.sum += seconds; if (status >= 500) row.errors++;
  bounds.forEach((bound, i) => { if (seconds <= bound) row.buckets[i]++; });
  stats.set(route, row);
}
export async function measured(route: RouteName, request: Request, run: () => Promise<Response>) {
  const supplied = request.headers.get('x-request-id');
  const id = supplied && /^[a-zA-Z0-9_-]{1,64}$/.test(supplied) ? supplied : randomUUID();
  const start = performance.now(); let status = 500;
  try {
    const response = await run(); status = response.status;
    response.headers.set('X-Request-ID', id);
    response.headers.set('Server-Timing', `app;dur=${(performance.now() - start).toFixed(1)}`);
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  } finally { observe(route, (performance.now() - start) / 1000, status); }
}
export function metricsAuthorized(request: Request, secret = process.env.METRICS_SECRET) {
  const provided = request.headers.get('authorization')?.replace(/^Bearer /, '');
  return !!secret && secret.length >= 32 && !!provided && Buffer.byteLength(secret) === Buffer.byteLength(provided) && timingSafeEqual(Buffer.from(secret), Buffer.from(provided));
}
export function httpMetrics() {
  const lines: string[] = ['# TYPE saloonsync_http_duration_seconds histogram', '# TYPE saloonsync_http_errors_total counter'];
  for (const [route, row] of stats) {
    for (let i = 0; i < bounds.length; i++) lines.push(`saloonsync_http_duration_seconds_bucket{route="${route}",le="${bounds[i]}"} ${row.buckets[i]}`);
    lines.push(`saloonsync_http_duration_seconds_bucket{route="${route}",le="+Inf"} ${row.count}`, `saloonsync_http_duration_seconds_count{route="${route}"} ${row.count}`, `saloonsync_http_duration_seconds_sum{route="${route}"} ${row.sum}`, `saloonsync_http_errors_total{route="${route}"} ${row.errors}`);
  }
  return lines.join('\n') + '\n';
}
