import { config } from 'dotenv';
import { z } from 'zod';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { platformPrivileges } from '../src/lib/authorization/platform-policy';
config({ path: '.env.local', quiet: true });
config({ path: '.env.migrations.local', quiet: true }); config({ quiet: true });
const [userId, mode, ...reasonWords] = process.argv.slice(2);
const reason = reasonWords.join(' ').trim();
if (!z.uuid().safeParse(userId).success || !['grant', 'revoke'].includes(mode) || reason.length < 10 || reason.length > 200) {
  console.error('Usage: npm run platform:grant -- <existing-user-uuid> <grant|revoke> <10–200 character reason>');
  process.exit(1);
}
if (!process.env.DIRECT_URL) throw new Error('A controlled provisioning DIRECT_URL is required.');
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL, max: 1, connectionTimeoutMillis: 5000 }, { schema: 'app' }) });
try {
  await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(81320711)::text`;
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user || user.disabledAt) throw new Error('An existing active application user is required. Have the user sign in first.');
    const data = { status: mode === 'grant' ? 'active' : 'revoked', grantedAt: new Date(), revokedAt: mode === 'revoke' ? new Date() : null };
    for (const privilege of platformPrivileges) await tx.platformPrivilege.upsert({ where: { userId_privilege: { userId, privilege } }, update: data, create: { userId, privilege, ...data } });
    await tx.auditEvent.create({ data: { action: `platform.${mode}`, targetType: 'User', targetId: userId, outcome: 'allowed', metadata: { reason, mechanism: 'controlled-bootstrap' } } });
  });
  console.log(`Platform privilege ${mode === 'grant' ? 'granted' : 'revoked'}. MFA remains required.`);
} finally { await db.$disconnect(); }

