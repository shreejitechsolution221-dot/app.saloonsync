// Read-only harness. No login, writes, provider requests or synthetic bookings.
import { performance } from 'node:perf_hooks';
const base = new URL(process.env.PERF_BASE_URL || 'http://localhost:3000');
if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.pathname !== '/' || base.search || base.hash) throw new Error('Use an origin without credentials or a path');
const local = ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname);
if (!local && process.env.PERF_APPROVED_ORIGIN !== base.origin) throw new Error('A non-local target requires PERF_APPROVED_ORIGIN matching the approved test origin');
const modes = { smoke: [1, 10], small: [25, 60], medium: [100, 60], stress: [200, 60], soak: [25, 600] };
const mode = process.env.PERF_MODE || 'smoke';
if (!Object.hasOwn(modes, mode)) throw new Error('Unknown PERF_MODE');
if (['stress', 'soak'].includes(mode) && process.env.PERF_EXTENDED_APPROVED !== 'yes') throw new Error('Stress and soak require explicit operator approval: PERF_EXTENDED_APPROVED=yes');
const [concurrency, duration] = modes[mode];
const cookie = process.env.PERF_COOKIE;
const salon = process.env.PERF_SALON_ID, branch = process.env.PERF_BRANCH_ID;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const scenarios = [{ name: 'liveness', path: '/api/v1/health', status: 200 }];
if (cookie) {
  scenarios.push({ name: 'dashboard', path: '/salon', status: 200, cookie });
  if (!uuid.test(salon || '') || !uuid.test(branch || '')) throw new Error('Authenticated testing requires dedicated PERF_SALON_ID and PERF_BRANCH_ID fixtures');
  const path = `/api/salons/${salon}/branches/${branch}/appointments?limit=25`;
  scenarios.push({ name: 'appointments', path, status: 200, cookie }, { name: 'permission-denied', path, status: 401 });
}
// Histogram avoids retaining one sample per request during soak tests.
const bounds = [5, 10, 25, 50, 100, 200, 300, 400, 600, 1000, 2000, 5000, 10000, 15000];
const results = scenarios.map(s => ({ scenario: s.name, requests: 0, failures: 0, buckets: Array(bounds.length + 1).fill(0), totalMs: 0 }));
const start = performance.now(), deadline = start + duration * 1000;
await Promise.all(Array.from({ length: concurrency }, async (_, worker) => {
  let index = worker;
  while (performance.now() < deadline) {
    const i = index++ % scenarios.length, scenario = scenarios[i], result = results[i], t = performance.now();
    try {
      const response = await fetch(new URL(scenario.path, base), { redirect: 'manual', headers: scenario.cookie ? { cookie: scenario.cookie } : {}, signal: AbortSignal.timeout(15000) });
      await response.arrayBuffer();
      if (response.status !== scenario.status) result.failures++;
    } catch { result.failures++; }
    const ms = performance.now() - t;
    const bucket = bounds.findIndex(bound => ms <= bound);
    result.buckets[bucket === -1 ? bounds.length : bucket]++; result.totalMs += ms; result.requests++;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
}));
const elapsed = (performance.now() - start) / 1000;
function percentile(row, fraction) {
  let count = 0;
  for (let i = 0; i < row.buckets.length; i++) { count += row.buckets[i]; if (count >= Math.ceil(row.requests * fraction)) return bounds[i] ?? '>15000'; }
  return null;
}
console.log(JSON.stringify({ mode, concurrency, elapsedSeconds: elapsed, environment: process.env.PERF_ENVIRONMENT || 'unspecified', results: results.map(row => ({ scenario: row.scenario, requests: row.requests, failures: row.failures, errorPercent: row.requests ? 100 * row.failures / row.requests : null, rps: row.requests / elapsed, meanMs: row.requests ? row.totalMs / row.requests : null, p50UpperBoundMs: percentile(row, .5), p95UpperBoundMs: percentile(row, .95), p99UpperBoundMs: percentile(row, .99) })) }, null, 2));
if (results.some(row => !row.requests || row.failures / row.requests >= .01)) process.exitCode = 1;
