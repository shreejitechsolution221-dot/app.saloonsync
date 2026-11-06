'use server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { requireAuthenticatedUser, requirePlatformPrivilege } from '@/lib/authorization/server';
import { platformRolePrivileges } from '@/lib/authorization/platform-policy';
import { recordTypes } from '@/lib/platform/catalog';
import { parseRecord } from '@/lib/platform/validation';
import { requireSameOrigin, rateLimit } from '@/lib/security';
import { invalidateSalonLayout } from '@/lib/salon/layout-data';
import type { FormState } from './auth-actions';
import type { Prisma } from '@/generated/prisma/client';

async function authorizeTransaction(tx: Prisma.TransactionClient, userId: string, privileges: string[]) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(81320711)::text`;
  const actor = await tx.user.findFirst({ where: { id: userId, disabledAt: null, AND: ['platform.manage', ...privileges].map(privilege => ({ privileges: { some: { privilege, status: 'active', revokedAt: null } } })) } });
  if (!actor) throw new Error('Your platform permissions changed. Reload and try again.');
}

export async function savePlatformRecord(_state: FormState, form: FormData): Promise<FormState> {
  try {
    const input = parseRecord(form);
    const definition = recordTypes[input.kind];
    await requireSameOrigin();
    await requirePlatformPrivilege('platform.manage');
    const approving = input.kind === 'access' && input.status !== 'requested';
    const requiredPrivilege = approving ? 'platform.security.manage' : definition.privilege;
    const actor = await requirePlatformPrivilege(requiredPrivilege);
    await rateLimit('platform-console', actor.id, 80);
    const result = await db.$transaction(async tx => {
      await authorizeTransaction(tx, actor.id, [requiredPrivilege]);
      const current = input.id ? await tx.platformRecord.findUnique({ where: { id: input.id } }) : null;
      if (input.id && (!current || current.kind !== input.kind || current.version !== input.version)) throw new Error('This record changed. Reload before saving.');
      if (input.kind === 'preference' && (current && current.createdBy !== actor.id || input.salonId || input.assigneeId)) throw new Error('Preferences belong to the current operator only.');
      if (input.kind === 'access') {
        if (!current && input.status !== 'requested') throw new Error('Create the request before review.');
        if (approving && (!current || current.createdBy === actor.id || input.assigneeId === actor.id)) throw new Error('Another authorized operator must review this request.');
        const original = current?.payload as Record<string, unknown> | undefined;
        if (approving && current && (current.salonId !== input.salonId || current.assigneeId !== input.assigneeId || Object.entries(input.payload).some(([key, value]) => original?.[key] !== value))) throw new Error('Review cannot change the requested scope.');
        if (current && current.status !== 'requested' && input.status !== 'revoked') throw new Error('Create a new request for a new access window.');
        const ticket = await tx.platformRecord.findFirst({ where: { id: String(input.payload.ticketId), kind: 'ticket', salonId: input.salonId, status: { in: ['verified', 'in_progress', 'escalated'] } } });
        if (!ticket && ['requested','approved'].includes(input.status)) throw new Error('A verified, open case for this salon is required.');
      }
      if (input.kind === 'invitation' && input.status === 'accepted') throw new Error('Only the verified invitee can accept an invitation.');
      if (input.kind === 'invitation' && current?.status === 'accepted') throw new Error('Manage accepted access through the operator controls.');
      if (input.salonId && !await tx.salon.findUnique({ where: { id: input.salonId }, select: { id: true } })) throw new Error('Salon unavailable.');
      if (input.assigneeId && !await tx.user.findFirst({ where: { id: input.assigneeId, disabledAt: null, privileges: { some: { privilege: 'platform.manage', status: 'active', revokedAt: null } } } })) throw new Error('Assign an active platform operator.');
      const key = input.kind === 'preference' ? `preference:${actor.id}` : ['plan', 'flag', 'policy'].includes(input.kind) ? `${input.kind}:${input.payload.code}` : input.kind === 'settings' ? 'settings:platform' : current?.key ?? `${input.kind}:${randomUUID()}`;
      let assigneeId = input.assigneeId || null;
      // Route unassigned cases to the eligible agent with the smallest open queue.
      if (input.kind === 'ticket' && !current && !assigneeId) {
        const agents = await tx.user.findMany({ where: { disabledAt: null, AND: ['platform.manage','platform.support.manage'].map(privilege => ({ privileges: { some: { privilege, status: 'active', revokedAt: null } } })) }, select: { id: true }, orderBy: { id: 'asc' }, take: 100 });
        const queues = await tx.platformRecord.groupBy({ by: ['assigneeId'], where: { kind: 'ticket', status: { notIn: ['closed','resolved'] }, assigneeId: { in: agents.map(agent => agent.id) } }, _count: true });
        assigneeId = agents.sort((a,b) => (queues.find(queue => queue.assigneeId === a.id)?._count ?? 0) - (queues.find(queue => queue.assigneeId === b.id)?._count ?? 0))[0]?.id ?? null;
      }
      const data = { key, title: input.title, status: input.status, salonId: input.salonId || null, assigneeId, payload: input.payload, updatedBy: actor.id };
      const saved = current
        ? await tx.platformRecord.update({ where: { id: current.id }, data: { ...data, version: { increment: 1 } } })
        : await tx.platformRecord.create({ data: { ...data, kind: input.kind, createdBy: actor.id } });
      await tx.auditEvent.create({ data: { actorUserId: actor.id, salonId: input.salonId || null, action: `platform.${input.kind}.${current ? 'updated' : 'created'}`, targetType: 'PlatformRecord', targetId: saved.id, outcome: 'allowed', metadata: { previousStatus: current?.status ?? null, status: input.status, version: saved.version, notes: String(input.payload.notes ?? ''), assigneeId } } });
      return saved;
    });
    revalidatePath('/platform', 'layout');
    revalidatePath('/salon', 'layout');
    return { message: input.kind === 'invitation' ? `Invitation saved. Share /platform/invitations/${result.id} with the invitee; no email has been sent.` : input.kind === 'job' && input.status === 'retry_requested' ? 'Retry request recorded for an operator. No external job has been executed.' : 'Saved and recorded in the audit log.' };
  } catch (error) {
    if (error instanceof z.ZodError) return { error: 'Check all required fields, IDs and formats.' };
    if (error instanceof Error && !('code' in error)) return { error: error.message.slice(0, 240) };
    return { error: 'Unable to save. Check your permissions, duplicate keys and database migration status.' };
  }
}

export async function updateSalonStatus(_state: FormState, form: FormData): Promise<FormState> {
  const parsed = z.object({ salonId: z.uuid(), status: z.enum(['active', 'suspended']), stage: z.enum(['registered', 'review', 'validated', 'active', 'monitoring', 'assistance']), reason: z.string().trim().min(8).max(1000), group: z.string().trim().max(80).optional(), updatedAt: z.iso.datetime() }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: 'Provide a valid salon, onboarding stage and a reason of at least eight characters.' };
  try {
    await requireSameOrigin(); await requirePlatformPrivilege('platform.manage');
    const actor = await requirePlatformPrivilege('platform.salons.manage');
    await rateLimit('platform-salon', actor.id, 40);
    await db.$transaction(async tx => {
      await authorizeTransaction(tx, actor.id, ['platform.salons.manage']);
      const salon = await tx.salon.findUnique({ where: { id: parsed.data.salonId } });
      if (!salon || salon.updatedAt.toISOString() !== parsed.data.updatedAt) throw new Error('Conflict');
      const oldSettings = salon.settings && typeof salon.settings === 'object' && !Array.isArray(salon.settings) ? salon.settings : {};
      await tx.salon.update({ where: { id: salon.id }, data: { status: parsed.data.status, settings: { ...oldSettings, platformRolloutGroup: parsed.data.group ?? '', platformOnboarding: { stage: parsed.data.stage, reason: parsed.data.reason, reviewedAt: new Date().toISOString() } } } });
      await tx.auditEvent.create({ data: { actorUserId: actor.id, salonId: salon.id, action: 'platform.salon.reviewed', targetType: 'Salon', targetId: salon.id, outcome: 'allowed', metadata: { previousStatus: salon.status, status: parsed.data.status, stage: parsed.data.stage, reason: parsed.data.reason } } });
    });
    await invalidateSalonLayout(parsed.data.salonId);
    revalidatePath('/platform', 'layout'); revalidatePath('/salon', 'layout');
    return { message: 'Salon review saved. Status changes apply to salon workspace access.' };
  } catch { return { error: 'Unable to save. Reload to check for concurrent changes and verify your permissions.' }; }
}

export async function updateUserStatus(_state: FormState, form: FormData): Promise<FormState> {
  const parsed = z.object({ userId: z.uuid(), status: z.enum(['active', 'disabled']), reason: z.string().trim().min(8).max(1000) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: 'Select an account status and explain the change.' };
  try {
    await requireSameOrigin(); await requirePlatformPrivilege('platform.manage');
    const actor = await requirePlatformPrivilege('platform.users.manage');
    await rateLimit('platform-user', actor.id, 30);
    await db.$transaction(async tx => {
      await authorizeTransaction(tx, actor.id, ['platform.users.manage']);
      const target = await tx.user.findUnique({ where: { id: parsed.data.userId }, select: { id: true, privileges: { where: { status: 'active', revokedAt: null } } } });
      // Operator suspension requires operator management, with the last-admin safeguard in manageOperator.
      if (!target || target.id === actor.id || target.privileges.length) throw new Error('Use platform role revocation before disabling an operator.');
      if (parsed.data.status === 'disabled') {
        const owned = await tx.salonMembership.findMany({ where: { userId: target.id, role: 'owner', status: 'active' }, orderBy: { salonId: 'asc' }, select: { salonId: true } });
        for (const membership of owned) {
          await tx.$queryRaw`SELECT id FROM app."Salon" WHERE id=${membership.salonId}::uuid FOR UPDATE`;
          if (!await tx.salonMembership.count({ where: { salonId: membership.salonId, role: 'owner', status: 'active', userId: { not: target.id }, user: { disabledAt: null } } })) throw new Error('Last salon owner');
        }
      }
      await tx.user.update({ where: { id: target.id }, data: { disabledAt: parsed.data.status === 'disabled' ? new Date() : null } });
      await tx.auditEvent.create({ data: { actorUserId: actor.id, action: 'platform.user.status', targetType: 'User', targetId: target.id, outcome: 'allowed', metadata: { status: parsed.data.status, reason: parsed.data.reason } } });
    });
    revalidatePath('/platform', 'layout'); return { message: 'Account status updated and audited.' };
  } catch { return { error: 'Unable to update. You cannot disable yourself, a platform operator, or the last enabled owner of a salon.' }; }
}

export async function acceptPlatformInvitation(_state: FormState, form: FormData): Promise<FormState> {
  try {
    const id = z.uuid().parse(form.get('id'));
    await requireSameOrigin(); const user = await requireAuthenticatedUser();
    const { data, error } = await user.auth.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error || data?.currentLevel !== 'aal2') return { error: 'Verify multi-factor authentication before accepting platform access.' };
    await rateLimit('platform-invite', user.id, 10);
    await db.$transaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(81320711)::text`;
      const invite = await tx.platformRecord.findFirst({ where: { id, kind: 'invitation', status: 'pending' } });
      const payload = invite?.payload as Record<string, string> | undefined;
      if (!invite || !payload || payload.email !== user.email || Date.parse(`${payload.expiresAt}Z`) <= Date.now()) throw new Error('Invalid invite');
      await authorizeTransaction(tx, invite.createdBy, ['platform.operators.manage']);
      const desired = platformRolePrivileges(payload.role);
      if (!desired.length) throw new Error('Invalid role');
      for (const privilege of desired) await tx.platformPrivilege.upsert({ where: { userId_privilege: { userId: user.id, privilege } }, create: { userId: user.id, privilege, grantedBy: invite.createdBy }, update: { status: 'active', revokedAt: null, grantedBy: invite.createdBy, grantedAt: new Date() } });
      await tx.platformRecord.update({ where: { id }, data: { status: 'accepted', updatedBy: user.id, version: { increment: 1 } } });
      await tx.auditEvent.create({ data: { actorUserId: user.id, action: 'platform.invitation.accepted', targetType: 'PlatformRecord', targetId: id, outcome: 'allowed' } });
    });
    revalidatePath('/platform', 'layout'); return { message: 'Invitation accepted. Open the platform overview to continue.' };
  } catch { return { error: 'Invitation unavailable, expired, revoked or intended for a different verified email.' }; }
}

export async function inspectSupportMetadata(_state: FormState, form: FormData): Promise<FormState> {
  try {
    const id = z.uuid().parse(form.get('id'));
    await requireSameOrigin(); await requirePlatformPrivilege('platform.manage');
    const actor = await requirePlatformPrivilege('platform.support.manage');
    await rateLimit('platform-support-view', actor.id, 30);
    const metadata = await db.$transaction(async tx => {
      await authorizeTransaction(tx, actor.id, ['platform.support.manage']);
      const request = await tx.platformRecord.findFirst({ where: { id, kind: 'access', status: 'approved', assigneeId: actor.id } });
      const payload = request?.payload as Record<string, string> | undefined;
      if (!request?.salonId || !payload || Date.parse(`${payload.expiresAt}Z`) <= Date.now()) throw new Error('Access unavailable');
      const ticket = await tx.platformRecord.findFirst({ where: { id: payload.ticketId, kind: 'ticket', salonId: request.salonId, status: { in: ['verified', 'in_progress', 'escalated'] } } });
      if (!ticket) throw new Error('Case closed');
      let result: unknown;
      if (payload.scope === 'onboarding_metadata') {
        const salon = await tx.salon.findUniqueOrThrow({ where: { id: request.salonId }, select: { name: true, status: true, settings: true, _count: { select: { branches: true, services: true } } } });
        result = { name: salon.name, status: salon.status, branches: salon._count.branches, configuredServices: salon._count.services, onboarding: (salon.settings as Record<string, unknown>).platformOnboarding ?? null };
      } else if (payload.scope === 'integration_metadata') {
        result = await tx.platformRecord.findMany({ where: { salonId: request.salonId, kind: { in: ['integration', 'job'] } }, take: 30, select: { title: true, status: true, updatedAt: true } });
      } else throw new Error('Invalid scope');
      await tx.auditEvent.create({ data: { actorUserId: actor.id, salonId: request.salonId, action: 'platform.support.metadata_viewed', targetType: 'PlatformRecord', targetId: id, outcome: 'allowed', metadata: { scope: payload.scope, ticketId: payload.ticketId } } });
      return result;
    });
    return { message: JSON.stringify(metadata, null, 2) };
  } catch { return { error: 'Access unavailable. Your independently approved request must be unexpired, assigned to you and linked to a verified open case.' }; }
}

export async function revokeSalonMembership(_state: FormState, form: FormData): Promise<FormState> {
  const parsed = z.object({ id: z.uuid(), reason: z.string().trim().min(8).max(1000) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: 'Select a membership and give a reason of at least eight characters.' };
  try {
    await requireSameOrigin(); await requirePlatformPrivilege('platform.manage');
    const actor = await requirePlatformPrivilege('platform.users.manage');
    await rateLimit('platform-membership', actor.id, 20);
    const salonId = await db.$transaction(async tx => {
      await authorizeTransaction(tx, actor.id, ['platform.users.manage']);
      const candidate = await tx.salonMembership.findUnique({ where: { id: parsed.data.id } });
      if (!candidate) throw new Error('Unavailable');
      // Coordinate with salon team changes, which lock the parent salon row.
      await tx.$queryRaw`SELECT id FROM app."Salon" WHERE id=${candidate.salonId}::uuid FOR UPDATE`;
      const membership = await tx.salonMembership.findUnique({ where: { id: parsed.data.id } });
      if (!membership || membership.status !== 'active') throw new Error('Unavailable');
      if (membership.role === 'owner' && await tx.salonMembership.count({ where: { salonId: membership.salonId, role: 'owner', status: 'active', id: { not: membership.id }, user: { disabledAt: null } } }) === 0) throw new Error('Last owner');
      await tx.salonMembership.update({ where: { id: membership.id }, data: { status: 'revoked' } });
      await tx.auditEvent.create({ data: { actorUserId: actor.id, salonId: membership.salonId, action: 'platform.membership.revoked', targetType: 'SalonMembership', targetId: membership.id, outcome: 'allowed', metadata: { reason: parsed.data.reason, role: membership.role } } });
      return membership.salonId;
    });
    await invalidateSalonLayout(salonId); revalidatePath('/platform', 'layout'); revalidatePath('/salon', 'layout');
    return { message: 'Salon membership revoked and audited.' };
  } catch { return { error: 'Unable to revoke. The last active salon owner cannot be removed.' }; }
}
