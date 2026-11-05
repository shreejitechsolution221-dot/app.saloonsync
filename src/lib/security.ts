import 'server-only';
import { headers } from 'next/headers';
import { createHash } from 'node:crypto';
import { db } from './db';
import { redis } from '@/server/redis';
import { DomainError } from '@/lib/operations/errors';
export function appOrigin() {
  const value = process.env.APP_ORIGIN;
  if (!value) throw new Error('APP_ORIGIN is required.');
  const url = new URL(value);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && url.hostname === 'localhost')) throw new Error('Invalid application origin.');
  return url.origin;
}
export async function requireSameOrigin() {
  const h = await headers();
  if (h.get('origin') !== appOrigin()) throw new Error('Invalid request origin.');
}
export async function rateLimit(bucket: string, identity: string, maximum = 10) {
  // Database-backed limit works across application instances; identifiers are hashed.
  const key = createHash('sha256').update(`${bucket}:${identity}`).digest('hex');
  if (redis) {
    let count: number | undefined;
    try {
      // Atomic increment + expiry; failed Redis requests fall back to PostgreSQL.
      count = await redis.eval<[number], number>(
        "local n = redis.call('INCR', KEYS[1]); if n == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]); end; return n",
        ['ratelimit:v1:' + key], [900],
      );
    } catch { /* Preserve the database-backed limiter during Redis outages. */ }
    if (count !== undefined) {
      if (count > maximum) throw new DomainError('Too many attempts. Try again later.');
      return;
    }
  }
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO app."RateLimit" (key, count, "resetsAt") VALUES (${key}, 1, now() + interval '15 minutes')
    ON CONFLICT (key) DO UPDATE SET count = CASE WHEN app."RateLimit"."resetsAt" < now() THEN 1 ELSE app."RateLimit".count + 1 END,
    "resetsAt" = CASE WHEN app."RateLimit"."resetsAt" < now() THEN now() + interval '15 minutes' ELSE app."RateLimit"."resetsAt" END
    RETURNING count`;
  if (rows[0].count > maximum) throw new DomainError('Too many attempts. Try again later.');
}
