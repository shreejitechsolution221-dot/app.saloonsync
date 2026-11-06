import 'server-only';
import { cache } from 'react';
import { db } from '@/lib/db';
import type { Prisma } from '@/generated/prisma/client';
export async function checkPlatformSchema(client: Prisma.TransactionClient) {
  const rows = await client.$queryRaw<{ ready: boolean }[]>`SELECT to_regclass('app."PlatformRecord"') IS NOT NULL AS ready`;
  return rows[0]?.ready === true;
}
export const platformSchemaReady = cache(() => checkPlatformSchema(db));
