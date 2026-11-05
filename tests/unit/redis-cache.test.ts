import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  ping: vi.fn(),
}));

vi.mock('@/server/redis', () => ({
  redis: {
    get: mocks.get,
    set: mocks.set,
    del: mocks.del,
    ping: mocks.ping,
  },
}));

import { cached, invalidate, getDevCacheStats, resetDevCacheStats } from '@/server/cache';
import { assertTenantIsolation, getScopedSalonLayoutData } from '@/lib/salon/layout-data';

describe('Redis Cache Helper and Invalidation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDevCacheStats();
  });

  it('returns cached item on cache hit without invoking loader', async () => {
    mocks.get.mockResolvedValueOnce({ hello: 'world' });
    const loader = vi.fn();

    const result = await cached('test:key', 600, loader);

    expect(result).toEqual({ hello: 'world' });
    expect(mocks.get).toHaveBeenCalledWith('test:key');
    expect(loader).not.toHaveBeenCalled();
    expect(mocks.set).not.toHaveBeenCalled();
    expect(getDevCacheStats().hits).toBe(1);
    expect(getDevCacheStats().misses).toBe(0);
  });

  it('invokes loader and fires background SET on cache miss', async () => {
    mocks.get.mockResolvedValueOnce(null);
    mocks.set.mockResolvedValueOnce('OK');
    const loader = vi.fn().mockResolvedValue({ fresh: 'data' });

    const result = await cached('test:key', 600, loader);

    expect(result).toEqual({ fresh: 'data' });
    expect(loader).toHaveBeenCalledOnce();
    expect(mocks.set).toHaveBeenCalledWith('test:key', { fresh: 'data' }, { ex: 600 });
    expect(getDevCacheStats().misses).toBe(1);
  });

  it('fails open on Redis GET error and returns loader result without throwing', async () => {
    mocks.get.mockRejectedValueOnce(new Error('Upstash connection refused'));
    mocks.set.mockResolvedValueOnce('OK');
    const loader = vi.fn().mockResolvedValue({ recovered: true });

    const result = await cached('test:error_key', 600, loader);

    expect(result).toEqual({ recovered: true });
    expect(loader).toHaveBeenCalledOnce();
    expect(getDevCacheStats().errors).toBe(1);
  });

  it('fails open on Redis GET timeout (>300ms) and returns loader result', async () => {
    // Hang Redis GET beyond 300ms
    mocks.get.mockImplementationOnce(() => new Promise((resolve) => setTimeout(() => resolve('late'), 400)));
    mocks.set.mockResolvedValueOnce('OK');
    const loader = vi.fn().mockResolvedValue({ timely: true });

    const result = await cached('test:timeout_key', 600, loader);

    expect(result).toEqual({ timely: true });
    expect(loader).toHaveBeenCalledOnce();
    expect(getDevCacheStats().errors).toBe(1);
  });

  it('invalidate calls redis.del and never throws even if Redis del rejects', async () => {
    mocks.del.mockResolvedValueOnce(1);
    await expect(invalidate('salon:123:layout')).resolves.toBeUndefined();
    expect(mocks.del).toHaveBeenCalledWith('salon:123:layout');

    // Simulate Redis failure during invalidate
    mocks.del.mockRejectedValueOnce(new Error('Quota exceeded'));
    await expect(invalidate('salon:123:layout')).resolves.toBeUndefined();
  });

  it('shares simultaneous misses and releases the pending read afterward', async () => {
    mocks.get.mockResolvedValue(null);
    mocks.set.mockResolvedValue('OK');
    const loader = vi.fn().mockResolvedValue({ fresh: true });
    const results = await Promise.all(Array.from({ length: 20 }, () => cached('burst', 60, loader)));
    expect(results).toHaveLength(20);
    expect(loader).toHaveBeenCalledOnce();
    expect(mocks.get).toHaveBeenCalledOnce();
    expect(mocks.set).toHaveBeenCalledOnce();
    await cached('burst', 60, loader);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('does not write to Redis after a failed read', async () => {
    mocks.get.mockRejectedValueOnce(new Error('offline'));
    await expect(cached('offline', 60, async () => 'database')).resolves.toBe('database');
    expect(mocks.set).not.toHaveBeenCalled();
  });

  it('does not repopulate an invalidated pending query', async () => {
    mocks.get.mockResolvedValue(null);
    let finish!: (value: string) => void;
    let started!: () => void;
    const loading = new Promise<void>(resolve => { started = resolve; });
    const pending = cached('mutation', 60, () => {
      started();
      return new Promise<string>(resolve => { finish = resolve; });
    });
    await loading;
    await invalidate('mutation');
    finish('old data');
    await expect(pending).resolves.toBe('old data');
    expect(mocks.set).not.toHaveBeenCalled();
  });

  it('retries the database after a loader rejects', async () => {
    mocks.get.mockResolvedValue(null);
    mocks.set.mockResolvedValue('OK');
    await expect(cached('retry', 60, async () => { throw new Error('database failed'); })).rejects.toThrow('database failed');
    await expect(cached('retry', 60, async () => 'recovered')).resolves.toBe('recovered');
  });
});

describe('Tenant Isolation', () => {
  const salonA = '11111111-1111-4111-8111-111111111111';
  const salonB = '22222222-2222-4222-8222-222222222222';

  it('permits access when active context salon matches target salon', () => {
    expect(() => assertTenantIsolation(salonA, salonA)).not.toThrow();
  });

  it('strictly throws when a user context from salon A attempts to read salon B', () => {
    expect(() => assertTenantIsolation(salonA, salonB)).toThrow(/Tenant isolation violation/);
  });

  it('rejects cross-tenant layout data access in getScopedSalonLayoutData', async () => {
    await expect(getScopedSalonLayoutData({ salonId: salonA }, salonB)).rejects.toThrow(
      /Tenant isolation violation/,
    );
  });
});

