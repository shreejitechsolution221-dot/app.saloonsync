import 'server-only';
import { headers } from 'next/headers';
import { createHash } from 'node:crypto';
import { db } from './db';
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
  const rows = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO app."RateLimit" (key, count, "resetsAt") VALUES (${key}, 1, now() + interval '15 minutes')
    ON CONFLICT (key) DO UPDATE SET count = CASE WHEN app."RateLimit"."resetsAt" < now() THEN 1 ELSE app."RateLimit".count + 1 END,
    "resetsAt" = CASE WHEN app."RateLimit"."resetsAt" < now() THEN now() + interval '15 minutes' ELSE app."RateLimit"."resetsAt" END
    RETURNING count`;
  if (rows[0].count > maximum) throw new Error('Too many attempts. Try again later.');
}
