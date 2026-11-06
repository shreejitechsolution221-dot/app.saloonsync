import { redirect } from 'next/navigation';
import { AuthLayout } from '@/components/auth/layout';
import { MfaForm } from '@/components/auth/mfa-form';
import { guard } from '@/lib/auth/page-guard';
import { requireAuthenticatedUser } from '@/lib/authorization/server';
import { db } from '@/lib/db';
import { pendingPlatformInvitation } from '@/lib/platform/invitations';
export const dynamic = 'force-dynamic';
export default async function Mfa() {
  const user = await guard('platform', requireAuthenticatedUser);
  const grant = await db.platformPrivilege.findUnique({ where: { userId_privilege: { userId: user.id, privilege: 'platform.manage' } } });
  const invited = !grant || grant.status !== 'active' || grant.revokedAt ? await pendingPlatformInvitation(user.email) : undefined;
  if ((!grant || grant.status !== 'active' || grant.revokedAt) && !invited) redirect('/platform/access-denied');
  const { data: assurance } = await user.auth.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance?.currentLevel === 'aal2') redirect(invited ? `/platform/invitations/${invited.id}` : '/platform');
  const { data: factors } = await user.auth.auth.mfa.listFactors();
  const factor = factors?.totp.find(f => f.status === 'verified');
  return <AuthLayout portal="platform"><p className="eyebrow">One more layer of care</p><h1>Verify it’s you.</h1><p className="intro">Platform access requires multi-factor authentication.</p><MfaForm factorId={factor?.id}/></AuthLayout>;
}
