import 'server-only';
import { db } from '@/lib/db';
import type { Portal } from './redirects';
import { cache } from 'react';
import { createHash } from 'node:crypto';

// Roles come from current application records, never the login form or editable
// provider metadata. No shared authorization cache is used.
export const getPortalAccess = cache(async function getPortalAccess(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      disabledAt: true,
      salonRegistrationName: true,
      customer: { select: { userId: true } },
      memberships: { select: { status: true, salon: { select: { status: true } } } },
      privileges: { where: { privilege: 'platform.manage', status: 'active', revokedAt: null }, select: { id: true } },
      consents: { where: { purpose: 'salon', documentType: 'service_terms' }, select: { id: true }, take: 1 },
    },
  });
  const enabled = Boolean(user && !user.disabledAt);
  const salonIdentity = Boolean(user?.salonRegistrationName || user?.memberships.length || user?.consents.length);
  const platform = enabled && Boolean(user?.privileges.length);
  const salon = enabled && Boolean(user?.memberships.some(m => m.status === 'active' && m.salon.status === 'active') ||
    (!user?.memberships.length && (user?.salonRegistrationName || user?.consents.length)));
  // Old customer profiles accidentally created for owners do not grant access.
  const customer = enabled && Boolean(user?.customer) && !salonIdentity && !platform;
  return { customer, salon, platform };
});

type SessionClient = { auth: { signOut(options: { scope: 'local' }): Promise<{ error: unknown }> } };

export async function authorizePortalSession(client: SessionClient, userId: string, portal: Portal,
  invitation?: { token: string; email: string; destination: string },
): Promise<boolean> {
  try {
    if ((await getPortalAccess(userId))[portal]) return true;
    // Joining a team is a separate flow, and does not grant workspace access.
    // Preserve sign-in to a real, recipient-bound invitation before membership
    // exists; acceptInvitation performs the final transactional authorization.
    if (portal === 'salon' && invitation?.destination === '/salon/invitations/accept') {
      const [recipient, invite] = await Promise.all([
        db.user.findUnique({ where: { id: userId }, select: { disabledAt: true } }),
        db.invitation.findUnique({
          where: { tokenHash: createHash('sha256').update(invitation.token).digest('hex') },
          select: { intendedEmail: true, acceptedAt: true, revokedAt: true, expiresAt: true, salon: { select: { status: true } } },
        }),
      ]);
      if (recipient && !recipient.disabledAt && invite && !invite.acceptedAt && !invite.revokedAt &&
        invite.expiresAt > new Date() && invite.salon.status === 'active' &&
        invite.intendedEmail.toLowerCase() === invitation.email.toLowerCase()) return true;
    }
  } catch (error) {
    await client.auth.signOut({ scope: 'local' });
    throw error;
  }
  // Revoke only this attempted login, leaving other devices signed in.
  const { error } = await client.auth.signOut({ scope: 'local' });
  if (error) throw new Error('Unable to close unauthorized portal session');
  return false;
}
