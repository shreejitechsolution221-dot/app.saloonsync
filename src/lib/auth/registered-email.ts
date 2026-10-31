import 'server-only';
import { db } from '@/lib/db';

// The identity provider remains the source of truth for registered email addresses.
// Only a boolean leaves the database; this is never exposed as a public list.
export async function registeredEmailExists(email: string) {
  const result = await db.$queryRaw<{ exists: boolean }[]>`
    SELECT app.registered_email_exists(${email}::text) AS exists`;
  return result[0]?.exists === true;
}

