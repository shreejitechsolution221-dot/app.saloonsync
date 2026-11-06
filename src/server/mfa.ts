'use server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireAuthenticatedUser } from '@/lib/authorization/server';
import { db } from '@/lib/db';
import { rateLimit, requireSameOrigin } from '@/lib/security';
import { pendingPlatformInvitation } from '@/lib/platform/invitations';
export type MfaState = { error?: string; factorId?: string; secret?: string; uri?: string };
async function mfaUser() {
  await requireSameOrigin();
  const user = await requireAuthenticatedUser();
  const grant = await db.platformPrivilege.findUnique({ where: { userId_privilege: { userId: user.id, privilege: 'platform.manage' } } });
  const invited = !grant || grant.status !== 'active' || grant.revokedAt ? await pendingPlatformInvitation(user.email) : undefined;
  if ((!grant || grant.status !== 'active' || grant.revokedAt) && !invited) throw new Error('Denied');
  await rateLimit('mfa', user.id, 15);
  return { ...user, platformInvitationId: invited?.id };
}
export async function enrollMfa(_state: MfaState, _form: FormData): Promise<MfaState> {
  try {
    const user = await mfaUser();
    const { data: factors, error: listError } = await user.auth.auth.mfa.listFactors();
    if (listError || factors.totp.some(f => f.status === 'verified')) return { error: 'An authenticator is already enrolled. Use its current code.' };
    // Remove only this user's abandoned TOTP enrollments before retrying setup.
    for (const factor of factors.all.filter(f => f.factor_type === 'totp' && f.status === 'unverified')) await user.auth.auth.mfa.unenroll({ factorId: factor.id });
    const { data, error } = await user.auth.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Saloonsync platform' });
    if (error) return { error: 'Unable to set up your authenticator. Try again.' };
    return { factorId: data.id, secret: data.totp.secret, uri: data.totp.uri };
  } catch { return { error: 'Unable to set up your authenticator.' }; }
}
export async function verifyMfa(_state: MfaState, form: FormData): Promise<MfaState> {
  const parsed = z.object({ factorId: z.uuid(), code: z.string().regex(/^\d{6}$/) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: 'Enter the six-digit code from your authenticator.' };
  let destination = '/platform';
  try {
    const user = await mfaUser();
    if (user.platformInvitationId) destination = `/platform/invitations/${user.platformInvitationId}`;
    const { error } = await user.auth.auth.mfa.challengeAndVerify(parsed.data);
    if (error) return { error: 'The code could not be verified. Try a new code.' };
  } catch { return { error: 'Unable to verify this code. Try again.' }; }
  redirect(destination);
}
