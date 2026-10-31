'use server';
import { secureAuthCookies } from '@/lib/auth/cookie-options';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { db } from '@/lib/db';
import { AccessError, requireAuthenticatedUser, requirePermission } from '@/lib/authorization/server';
import { canInvite } from '@/lib/authorization/policy';
import { invitationSchema, onboardingSchema } from '@/lib/validation/auth';
import { legalConfig } from '@/lib/auth/config';
import { appOrigin, rateLimit, requireSameOrigin } from '@/lib/security';
import type { FormState } from './auth-actions';
import { sendInvitationEmail } from '@/lib/email/invitations';
import { emailPolicyError, assertSignupEmail } from '@/lib/email/signup-policy';
import { invalidateSalonLayout } from '@/lib/salon/layout-data';
export async function selectWorkspace(form: FormData) {
  await requireSameOrigin();
  const salonId = z.uuid().parse(form.get('salonId'));
  const user = await requireAuthenticatedUser();
  const membership = await db.salonMembership.findFirst({ where: { salonId, userId: user.id, status: 'active', salon: { status: 'active' } }, select: { id: true } });
  if (!membership) throw new AccessError('FORBIDDEN');
  (await cookies()).set('workspace', salonId, { httpOnly: true, sameSite: 'lax', secure: secureAuthCookies(), path: '/' });
  redirect('/salon');
}
export async function createWorkspace(_state: FormState, form: FormData): Promise<FormState> {
  const parsed = onboardingSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: 'Enter your salon and first branch names.' };
  const legal = legalConfig();
  if (!legal.ready || form.get('consent') !== 'on') return { error: 'Applicable service terms must be available and accepted.' };
  let salonId: string;
  try {
    await requireSameOrigin(); const user = await requireAuthenticatedUser(); await rateLimit('onboarding', user.id, 5);
    // Namespace the retry key by identity; a supplied key cannot attach another user.
    const key = `${user.id}:${parsed.data.key}`;
    const salon = await db.$transaction(async tx => {
      const existing = await tx.salon.findUnique({ where: { onboardingKey: key } });
      if (existing) return existing;
      const created = await tx.salon.create({ data: { name: parsed.data.name, slug: `${parsed.data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 45)}-${randomUUID().slice(0, 8)}`, onboardingKey: key } });
      await tx.branch.create({ data: { salonId: created.id, name: parsed.data.branch } });
      await tx.salonMembership.create({ data: { salonId: created.id, userId: user.id, role: 'owner', branchScope: 'all' } });
      await tx.consentRecord.upsert({ where: { userId_documentType_documentVersion_purpose: { userId: user.id, documentType: 'service_terms', documentVersion: legal.version, purpose: 'salon' } }, update: {}, create: { userId: user.id, documentType: 'service_terms', documentVersion: legal.version, purpose: 'salon' } });
      await tx.auditEvent.create({ data: { actorUserId: user.id, salonId: created.id, action: 'salon.created', targetType: 'Salon', targetId: created.id, outcome: 'allowed' } });
      return created;
    });
    salonId = salon.id;
  } catch { return { error: 'Unable to create the workspace. Please try again.' }; }
  (await cookies()).set('workspace', salonId, { httpOnly: true, sameSite: 'lax', secure: secureAuthCookies(), path: '/' });
  redirect('/salon');
}
export async function createInvitation(_state: FormState, form: FormData): Promise<FormState> {
  const parsed = invitationSchema.safeParse({ ...Object.fromEntries(form), branches: form.getAll('branches') });
  if (!parsed.success) return { error: 'Enter a valid email, role and branch scope.' };
  try {
    await requireSameOrigin(); const input = parsed.data;
    const { user } = await requirePermission(input.salonId, 'membership.invite');
    const emailError = emailPolicyError(input.email);
    if (emailError) return { error: emailError, fields: { email: [emailError] } };
    await rateLimit('invite', user.id, 30);
    try { await assertSignupEmail(input.email); }
    catch (error) { const message = error instanceof Error ? error.message : 'Check the recipient email address.'; return { error: message, fields: { email: [message] } }; }
    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const invitationId = await db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM app."Salon" WHERE id = ${input.salonId}::uuid FOR UPDATE`;
      const actor = await tx.salonMembership.findUnique({ where: { salonId_userId: { salonId: input.salonId, userId: user.id } }, include: { salon: true, user: true } });
      if (!actor || actor.user.disabledAt || actor.status !== 'active' || actor.salon.status !== 'active' || !canInvite(actor.role, input.role)) throw new Error('Denied');
      // Only all-branch administrators may delegate access.
      if (actor.branchScope !== 'all') throw new Error('Denied');
      if (input.branchScope === 'selected' && await tx.branch.count({ where: { id: { in: [...new Set(input.branches)] }, salonId: input.salonId, status: 'active' } }) !== new Set(input.branches).size) throw new Error('Invalid scope');
      const invitation = await tx.invitation.create({ data: { salonId: input.salonId, intendedEmail: input.email, role: input.role, branchScope: input.branchScope, tokenHash, invitedBy: user.id, expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000) } });
      if (input.branchScope === 'selected') await tx.invitationBranchAccess.createMany({ data: [...new Set(input.branches)].map(branchId => ({ invitationId: invitation.id, salonId: input.salonId, branchId })) });
      await tx.auditEvent.create({ data: { actorUserId: user.id, salonId: input.salonId, action: 'invitation.created', targetType: 'Invitation', targetId: invitation.id, outcome: 'allowed' } });
      return invitation.id;
    });
    const link = `${appOrigin()}/salon/invitations/accept#token=${token}`;
    const sent = form.get('emailDelivery') === 'on' && await sendInvitationEmail(input.email, link, invitationId);
    return { message: sent ? 'Invitation created and accepted by the email service. It expires in 72 hours.' : 'Invitation created. Copy this link and share it privately with the intended recipient. It expires in 72 hours.', link };
  } catch { return { error: 'Unable to create this invitation. Check your permissions and branch scope.' }; }
}
export async function acceptInvitation(_state: FormState, _form: FormData): Promise<FormState> {
  try {
    await requireSameOrigin(); const user = await requireAuthenticatedUser();
    await rateLimit('accept', user.id, 20);
    const token = (await cookies()).get('invitation')?.value;
    if (!token) return { error: 'Open the invitation link again.' };
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const lookup = await db.invitation.findUnique({ where: { tokenHash }, select: { salonId: true } });
    if (!lookup) return { error: 'This invitation is unavailable.' };
    await db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM app."Salon" WHERE id = ${lookup.salonId}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM app."Invitation" WHERE "tokenHash" = ${tokenHash} FOR UPDATE`;
      const invitation = await tx.invitation.findUnique({ where: { tokenHash }, include: { branches: { include: { branch: true } }, salon: true } });
      const [{ now }] = await tx.$queryRaw<{ now: Date }[]>`SELECT now() AS now`;
      const recipient = await tx.user.findUnique({ where: { id: user.id } });
      if (!recipient || recipient.disabledAt) throw new Error('Unavailable');
      if (!invitation || invitation.acceptedAt || invitation.revokedAt || invitation.expiresAt <= now || invitation.intendedEmail !== user.email || invitation.salon.status !== 'active') throw new Error('Unavailable');
      const inviter = await tx.salonMembership.findUnique({ where: { salonId_userId: { salonId: invitation.salonId, userId: invitation.invitedBy } }, include: { user: true } });
      if (!inviter || inviter.user.disabledAt || inviter.status !== 'active' || inviter.branchScope !== 'all' || !canInvite(inviter.role, invitation.role)) throw new Error('Unavailable');
      if (invitation.branches.some(b => b.branch.status !== 'active')) throw new Error('Unavailable');
      const existing = await tx.salonMembership.findUnique({ where: { salonId_userId: { salonId: invitation.salonId, userId: user.id } } });
      // Do not overwrite active or suspended memberships. Suspension needs explicit review.
      if (existing && !['invited', 'revoked'].includes(existing.status)) throw new Error('Existing membership');
      const membership = await tx.salonMembership.upsert({ where: { salonId_userId: { salonId: invitation.salonId, userId: user.id } }, update: { role: invitation.role, branchScope: invitation.branchScope, status: 'active' }, create: { salonId: invitation.salonId, userId: user.id, role: invitation.role, branchScope: invitation.branchScope } });
      await tx.membershipBranchAccess.deleteMany({ where: { membershipId: membership.id } });
      if (invitation.branchScope === 'selected') await tx.membershipBranchAccess.createMany({ data: invitation.branches.map(({ branchId }) => ({ membershipId: membership.id, salonId: invitation.salonId, branchId })) });
      if(invitation.staffProfileId){const linked=await tx.staffProfile.updateMany({where:{id:invitation.staffProfileId,salonId:invitation.salonId,active:true,OR:[{userId:null},{userId:user.id}]},data:{userId:user.id}});if(linked.count!==1)throw new Error('Employee profile is unavailable');}
      await tx.invitation.update({ where: { id: invitation.id }, data: { acceptedAt: now, acceptedBy: user.id } });
      await tx.auditEvent.create({ data: { actorUserId: user.id, salonId: invitation.salonId, action: 'invitation.accepted', targetType: 'Invitation', targetId: invitation.id, outcome: 'allowed' } });
    });
    await invalidateSalonLayout(lookup.salonId);
    (await cookies()).delete('invitation');
    return { message: 'Invitation accepted. Open your salon workspace to continue.' };
  } catch { return { error: 'This invitation is unavailable, expired, or does not match your verified email.' }; }
}
export async function revokeInvitation(form: FormData) {
  await requireSameOrigin();
  const salonId = z.uuid().parse(form.get('salonId')); const id = z.uuid().parse(form.get('invitationId'));
  const { user } = await requirePermission(salonId, 'membership.invite');
  await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM app."Salon" WHERE id = ${salonId}::uuid FOR UPDATE`;
    const actor = await tx.salonMembership.findUnique({ where: { salonId_userId: { salonId, userId: user.id } }, include: { salon: true, user: true } });
    const invitation = await tx.invitation.findFirst({ where: { id, salonId, acceptedAt: null, revokedAt: null } });
    if (!actor || actor.user.disabledAt || actor.salon.status !== 'active' || actor.branchScope !== 'all' || actor.status !== 'active' || !invitation || !canInvite(actor.role, invitation.role)) throw new Error('Denied');
    await tx.invitation.update({ where: { id }, data: { revokedAt: new Date() } });
    await tx.auditEvent.create({ data: { actorUserId: user.id, salonId, action: 'invitation.revoked', targetType: 'Invitation', targetId: id, outcome: 'allowed' } });
  });
  await invalidateSalonLayout(salonId);
  const { revalidatePath } = await import('next/cache'); revalidatePath('/salon');
}
export async function transferOwnership(_state: FormState, form: FormData): Promise<FormState> {
  const parsed = z.object({ salonId: z.uuid(), membershipId: z.uuid() }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: 'Choose an active member.' };
  try {
    await requireSameOrigin(); const { user } = await requirePermission(parsed.data.salonId, 'ownership.transfer');
    await db.$transaction(async tx => {
      const { salonId, membershipId } = parsed.data;
      await tx.$queryRaw`SELECT id FROM app."Salon" WHERE id = ${salonId}::uuid FOR UPDATE`;
      const actor = await tx.salonMembership.findUnique({ where: { salonId_userId: { salonId, userId: user.id } }, include: { salon: true, user: true } });
      const target = await tx.salonMembership.findFirst({ where: { id: membershipId, salonId, status: 'active', user: { disabledAt: null } } });
      if (!actor || actor.user.disabledAt || actor.salon.status !== 'active' || actor.role !== 'owner' || actor.status !== 'active' || !target || target.userId === user.id) throw new Error('Denied');
      await tx.salonMembership.update({ where: { id: target.id }, data: { role: 'owner', branchScope: 'all' } });
      await tx.membershipBranchAccess.deleteMany({ where: { membershipId: target.id } });
      await tx.salonMembership.update({ where: { id: actor.id }, data: { role: 'admin' } });
      await tx.auditEvent.create({ data: { actorUserId: user.id, salonId, action: 'ownership.transferred', targetType: 'SalonMembership', targetId: target.id, outcome: 'allowed' } });
    });
    await invalidateSalonLayout(parsed.data.salonId);
    return { message: 'Ownership transferred. You now have administrator access.' };
  } catch { return { error: 'Unable to transfer ownership. Check that the selected member is active.' }; }
}

