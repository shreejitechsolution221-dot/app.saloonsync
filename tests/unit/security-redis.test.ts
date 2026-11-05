import { beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ eval: vi.fn(), query: vi.fn() }));
vi.mock('@/server/redis', () => ({ redis: { eval: m.eval } }));
vi.mock('@/lib/db', () => ({ db: { $queryRaw: m.query } }));
import { rateLimit } from '@/lib/security';
beforeEach(() => { m.eval.mockResolvedValue(1); m.query.mockResolvedValue([{ count: 1 }]); });
it('uses Redis with a hashed identity and atomic expiry', async () => {
  await rateLimit('customer-booking', 'private-user-id', 20);
  expect(m.eval.mock.calls[0][1][0]).toMatch(/^ratelimit:v1:[a-f0-9]{64}$/);
  expect(m.eval.mock.calls[0][2]).toEqual([900]);
  expect(m.query).not.toHaveBeenCalled();
});
it('rejects excess Redis attempts without falling back and allowing them', async () => {
  m.eval.mockResolvedValueOnce(21);
  await expect(rateLimit('customer-booking', 'user', 20)).rejects.toThrow('Too many attempts');
  expect(m.query).not.toHaveBeenCalled();
});
it('falls back to the shared database limiter during a Redis outage', async () => {
  m.eval.mockRejectedValueOnce(new Error('offline'));
  await rateLimit('customer-booking', 'user', 20);
  expect(m.query).toHaveBeenCalledOnce();
});
