import { expect, it, vi, beforeEach } from 'vitest';
import { poolConfig } from '@/lib/performance/pool-config';
import { appointmentPage, encodeCursor } from '@/lib/performance/pagination';
import { measured, httpMetrics, metricsAuthorized } from '@/lib/performance/http';
const id = '11111111-1111-4111-8111-111111111111';
const scope = { salonId: id, branchId: id, userId: 'user-a' };
it('validates pg settings without leaking input', () => {
  expect(poolConfig({}).max).toBe(5);
  expect(poolConfig({ DB_POOL_MAX: '9' }).max).toBe(9);
  for (const value of ['0', '-1', '101', '1.1', 'NaN', 'secret']) expect(() => poolConfig({ DB_POOL_MAX: value })).toThrow('Invalid DB_POOL_MAX');
  expect(() => poolConfig({ DB_STATEMENT_TIMEOUT_MS: '0' })).toThrow();
});
it('bounds page sizes and validates cursor scope and shape', () => {
  expect(appointmentPage(new URLSearchParams(), scope).limit).toBe(100);
  for (const limit of ['0', '101', '-1', '1.5', 'Infinity']) expect(() => appointmentPage(new URLSearchParams({ limit }), scope)).toThrow();
  const cursor = encodeCursor({ ...scope, v: 1, id, startsAt: '2026-10-29T10:00:00.000Z' });
  expect(appointmentPage(new URLSearchParams({ cursor }), scope).cursor?.id).toBe(id);
  expect(() => appointmentPage(new URLSearchParams({ cursor }), { ...scope, userId: 'user-b' })).toThrow();
  expect(() => appointmentPage(new URLSearchParams({ cursor }), { ...scope, salonId: '22222222-2222-4222-8222-222222222222' })).toThrow();
  for (const bad of ['!!!', 'a'.repeat(1025), Buffer.from('{}').toString('base64url')]) expect(() => appointmentPage(new URLSearchParams({ cursor: bad }), scope)).toThrow();
});
it('records bounded route histograms and preserves valid correlation IDs', async () => {
  const response = await measured('health', new Request('https://test', { headers: { 'x-request-id': 'trace_123' } }), async () => Response.json({}, { status: 503 }));
  expect(response.headers.get('x-request-id')).toBe('trace_123');
  expect(response.headers.get('cache-control')).toContain('no-store');
  expect(httpMetrics()).toContain('saloonsync_http_errors_total{route="health"}');
  expect(httpMetrics()).not.toContain('https://test');
});
it('metrics fail closed without a valid configured secret', () => {
  const secret = 'a'.repeat(32);
  const request = new Request('https://test', { headers: { authorization: `Bearer ${secret}` } });
  expect(metricsAuthorized(request, secret)).toBe(true);
  expect(metricsAuthorized(request, 'short')).toBe(false);
  expect(metricsAuthorized(request, 'b'.repeat(32))).toBe(false);
  expect(metricsAuthorized(new Request('https://test'), secret)).toBe(false);
});
const mocks = vi.hoisted(() => ({ query: vi.fn(), configured: vi.fn() }));
vi.mock('@/lib/db', () => ({ db: { $queryRaw: mocks.query }, databasePoolMetrics: () => '' }));
vi.mock('@/lib/auth/config', () => ({ authConfigured: mocks.configured }));
import { GET as ready } from '@/app/api/v1/ready/route';
import { GET as health } from '@/app/api/v1/health/route';
import { GET as metrics } from '@/app/api/metrics/route';
beforeEach(() => { vi.clearAllMocks(); mocks.configured.mockReturnValue(true); mocks.query.mockResolvedValue([]); });
it('liveness does not depend on PostgreSQL', async () => {
  mocks.query.mockRejectedValue(new Error('offline'));
  expect((await health(new Request('https://test'))).status).toBe(200);
  expect(mocks.query).not.toHaveBeenCalled();
});
it('readiness reports missing configuration and database failures accurately', async () => {
  expect((await ready(new Request('https://test'))).status).toBe(200);
  mocks.query.mockRejectedValue(new Error('private database error'));
  const response = await ready(new Request('https://test'));
  expect(response.status).toBe(503); expect(await response.text()).not.toContain('private');
  mocks.configured.mockReturnValue(false); mocks.query.mockClear();
  expect((await ready(new Request('https://test'))).status).toBe(503); expect(mocks.query).not.toHaveBeenCalled();
});
it('rejects anonymous metrics requests', async () => {
  expect((await metrics(new Request('https://test'))).status).toBe(401);
});
