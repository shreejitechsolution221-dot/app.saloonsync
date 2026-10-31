import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/v1/web-vitals/route';
import { admitVital, vitalMetrics, vitalSchema } from '@/lib/performance/vitals';
beforeEach(() => { vi.stubEnv('ENABLE_WEB_VITALS', 'true'); vi.stubEnv('APP_ORIGIN', 'https://app.test'); });
afterEach(() => vi.unstubAllEnvs());
function request(body: string, origin = 'https://app.test') { return new Request('https://app.test/api/v1/web-vitals', { method: 'POST', headers: { origin }, body }); }
it('accepts only numeric known metrics without identifying metadata', async () => {
  expect((await POST(request('{"name":"LCP","value":1200}'))).status).toBe(204);
  expect(vitalMetrics()).toContain('saloonsync_web_vital_count{name="LCP"}');
  expect((await POST(request('{"name":"CLS","value":0.05,"email":"private"}'))).status).toBe(400);
  expect(vitalMetrics()).not.toContain('private');
  expect(vitalSchema.safeParse({ name: 'LCP', value: Infinity }).success).toBe(false);
  expect(vitalSchema.safeParse({ name: 'arbitrary', value: 1 }).success).toBe(false);
});
it('rejects cross-origin, oversized and disabled ingestion', async () => {
  expect((await POST(request('{}', 'https://evil.test'))).status).toBe(403);
  expect((await POST(request('x'.repeat(513)))).status).toBe(413);
  vi.stubEnv('ENABLE_WEB_VITALS', 'false');
  expect((await POST(request('{}'))).status).toBe(404);
});
it('bounds per-instance ingestion and resets its window', () => {
  const now = Date.now() + 10000;
  for (let i = 0; i < 60; i++) expect(admitVital(now)).toBe(true);
  expect(admitVital(now)).toBe(false); expect(admitVital(now + 1000)).toBe(true);
});
