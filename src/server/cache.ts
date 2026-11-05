import 'server-only';
import { redis } from './redis';

let devHits = 0;
let devMisses = 0;
let devErrors = 0;
let devCommands = 0;
// Share pending reads only; settled values always come from Redis or the DB.
const inFlight = new Map<string, Promise<unknown>>();

export function getDevCacheStats() {
  return {
    hits: devHits,
    misses: devMisses,
    errors: devErrors,
    commands: devCommands,
  };
}

export function resetDevCacheStats() {
  devHits = 0;
  devMisses = 0;
  devErrors = 0;
  devCommands = 0;
}

function timeoutPromise<T>(promise: Promise<T>, ms: number, timeoutMsg: string): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(timeoutMsg)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * cached<T>:
 * - Attempts to retrieve value from Redis with a 300ms timeout.
 * - On cache hit, immediately returns cached value.
 * - Concurrent reads of one key share a pending lookup and database load.
 * - On a miss, loads fresh data and populates Redis with a 300ms timeout.
 * - On cache failure, loads fresh data without attempting a cache write.
 * - Logs hit/miss/error in dev only without leaking sensitive key values or data.
 */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>,
): Promise<T> {
  if (!redis) {
    return loader();
  }

  const existing = inFlight.get(key);
  if (existing) return existing as Promise<T>;
  // Bound memory during bursts of distinct keys.
  if (inFlight.size >= 256) return loader();
  const pending: Promise<T> = Promise.resolve().then(() => readCached(key, ttlSeconds, loader, () => inFlight.get(key) === pending));
  inFlight.set(key, pending);
  try {
    return await pending;
  } finally {
    if (inFlight.get(key) === pending) inFlight.delete(key);
  }
}

async function readCached<T>(key: string, ttlSeconds: number, loader: () => Promise<T>, canPopulate: () => boolean): Promise<T> {
  if (!redis) return loader();
  let cacheAvailable = true;

  try {
    if (process.env.NODE_ENV !== 'production') {
      devCommands++;
    }
    const result = await timeoutPromise(redis.get<T>(key), 300, 'Redis GET timeout');
    if (result !== null && result !== undefined) {
      if (process.env.NODE_ENV !== 'production') {
        devHits++;
        console.info(`[cache] HIT (hits=${devHits}, commands=${devCommands})`);
      }
      return result;
    }
    if (process.env.NODE_ENV !== 'production') {
      devMisses++;
      console.info(`[cache] MISS (misses=${devMisses}, commands=${devCommands})`);
    }
  } catch (_err) {
    cacheAvailable = false;
    if (process.env.NODE_ENV !== 'production') {
      devErrors++;
      console.warn(`[cache] ERROR/TIMEOUT (errors=${devErrors}, commands=${devCommands})`);
    }
  }

  const fresh = await loader();

  // Do not pay a second timeout during an outage, or refill a read invalidated
  // while its database query was running.
  if (!cacheAvailable || !canPopulate()) return fresh;

  try {
    if (process.env.NODE_ENV !== 'production') {
      devCommands++;
    }
    // Bound the write so the cache is populated before this request finishes.
    await timeoutPromise(redis.set(key, fresh, { ex: ttlSeconds }), 300, 'Redis SET timeout').catch((err) => {
      if (process.env.NODE_ENV !== 'production') {
        devErrors++;
        console.warn('[cache] SET failed:', err instanceof Error ? err.message : err);
      }
    });
  } catch (_setDispatchErr) {
    // Fail-open: ignore any synchronous dispatch errors
  }

  return fresh;
}

/**
 * invalidate:
 * Deletes one or more cache keys in Redis and never throws.
 */
export async function invalidate(...keys: string[]): Promise<void> {
  const filtered = keys.filter(Boolean);
  for (const key of filtered) inFlight.delete(key);
  if (!redis || filtered.length === 0) return;
  try {
    if (process.env.NODE_ENV !== 'production') {
      devCommands += filtered.length;
    }
    await timeoutPromise(redis.del(...filtered), 300, 'Redis DEL timeout');
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      devErrors++;
      console.warn('[cache] invalidate failed:', err instanceof Error ? err.message : err);
    }
  }
}

