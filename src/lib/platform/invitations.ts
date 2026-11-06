import 'server-only';
import { db } from '@/lib/db';
import { platformSchemaReady } from './schema-ready';
export async function pendingPlatformInvitation(email: string) {
  if (!await platformSchemaReady()) return undefined;
  const invitations = await db.platformRecord.findMany({ where: { kind: 'invitation', status: 'pending', payload: { path: ['email'], equals: email.toLowerCase() } }, orderBy: { createdAt: 'desc' }, take: 20, select: { id: true, payload: true } });
  return invitations.find(invitation => {
    const payload = invitation.payload as Record<string, string>;
    return Date.parse(`${payload.expiresAt}Z`) > Date.now();
  });
}
