import { describe, expect, it, vi, beforeEach } from 'vitest';

const m = vi.hoisted(() => ({
  limit: vi.fn(),
}));

vi.mock('@upstash/ratelimit', () => {
  const slidingWindow = vi.fn().mockReturnValue({});
  class Ratelimit {
    static slidingWindow = slidingWindow;
    limit = m.limit;
  }
  return { Ratelimit };
});

vi.mock('@/server/redis', () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue({
    get: (name: string) => {
      if (name.toLowerCase() === 'x-forwarded-for') return '203.0.113.195, 70.41.3.18';
      if (name.toLowerCase() === 'x-real-ip') return '203.0.113.195';
      return null;
    },
  }),
}));

import { getClientIp, limitLogin, limitRegister } from '@/server/rate-limit';

describe('Rate Limiting with @upstash/ratelimit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('extracts first IP from x-forwarded-for header', async () => {
    const ip = await getClientIp();
    expect(ip).toBe('203.0.113.195');
  });

  it('allows login attempts when under limit', async () => {
    m.limit.mockResolvedValueOnce({ success: true, remaining: 9 });
    const allowed = await limitLogin('203.0.113.195', 'user@example.test');
    expect(allowed).toBe(true);
    expect(m.limit).toHaveBeenCalledWith('203.0.113.195:user@example.test');
  });

  it('blocks login attempts when limit is exceeded', async () => {
    m.limit.mockResolvedValueOnce({ success: false, remaining: 0 });
    const allowed = await limitLogin('203.0.113.195', 'user@example.test');
    expect(allowed).toBe(false);
  });

  it('allows register attempts under limit and blocks when exceeded', async () => {
    m.limit.mockResolvedValueOnce({ success: true, remaining: 4 });
    expect(await limitRegister('203.0.113.195')).toBe(true);
    expect(m.limit).toHaveBeenCalledWith('203.0.113.195');

    m.limit.mockResolvedValueOnce({ success: false, remaining: 0 });
    expect(await limitRegister('203.0.113.195')).toBe(false);
  });

  it('fails open (returns true) if Redis throws or times out during login check', async () => {
    m.limit.mockRejectedValueOnce(new Error('Upstash connection timeout'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const allowed = await limitLogin('203.0.113.195', 'user@example.test');
    expect(allowed).toBe(true);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('fails open (returns true) if Redis throws during register check', async () => {
    m.limit.mockRejectedValueOnce(new Error('Rate limit service degraded'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const allowed = await limitRegister('203.0.113.195');
    expect(allowed).toBe(true);
    expect(warnSpy).toHaveBeenCalled();
  });
});
