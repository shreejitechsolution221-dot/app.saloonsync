import 'server-only';
import { redis } from './redis';

let devHits = 0;
let devMisses = 0;
let devErrors = 0;
let devCommands = 0;

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
  return Promise.race([
    promise.then((res) => {
      clearTimeout(timer);
      return res;
    }),
    timeout,
  ]);
}

/**
 * cached<T>:
 * - Attempts to retrieve value from Redis with a 300ms timeout.
 * - On cache hit, immediately returns cached value.
 * - On cache miss, error, or timeout, loads fresh data via `loader()`,
 *   and fires off a background SET with the provided TTL (never blocking response).
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
    if (process.env.NODE_ENV !== 'production') {
      devErrors++;
      console.warn(`[cache] ERROR/TIMEOUT (errors=${devErrors}, commands=${devCommands})`);
    }
  }

  const fresh = await loader();

  try {
    if (process.env.NODE_ENV !== 'production') {
      devCommands++;
    }
    // Fire-and-forget SET, never block response
    redis.set(key, fresh, { ex: ttlSeconds }).catch((err) => {
      if (process.env.NODE_ENV !== 'production') {
        devErrors++;
        console.warn('[cache] fire-and-forget SET failed:', err instanceof Error ? err.message : err);
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
  if (!redis || filtered.length === 0) return;
  try {
    if (process.env.NODE_ENV !== 'production') {
      devCommands += filtered.length;
    }
    await redis.del(...filtered);
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      devErrors++;
      console.warn('[cache] invalidate failed:', err instanceof Error ? err.message : err);
    }
  }
}

