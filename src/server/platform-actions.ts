'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { invalidateSalonLayout } from '@/lib/salon/layout-data';
import { db } from '@/lib/db';
import { requirePlatformPrivilege } from '@/lib/authorization/server';
import { platformPrivileges, platformRolePrivileges } from '@/lib/authorization/platform-policy';
import { rateLimit, requireSameOrigin } from '@/lib/security';
import type { FormState } from './auth-actions';

const subscriptionInput = z.object({ salonId: z.uuid(), planCode: z.string().trim().min(1).max(80), status: z.enum(['trialing', 'active', 'past_due', 'paused', 'canceled']), version: z.coerce.number().int().min(0), periodEnd: z.union([z.literal(''), z.iso.date()]) });
export async function saveSubscription(_state: FormState, form: FormData): Promise<FormState> {
  const parsed = subscriptionInput.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: 'Enter a salon, plan, valid status and date.' };
  try {
    await requireSameOrigin();
    await requirePlatformPrivilege('platform.manage');
    const user = await requirePlatformPrivilege('platform.subscriptions.manage');
    await rateLimit('platform-subscription', user.id, 60);
    const input = parsed.data;
    await db.$transaction(async tx => {
      // Global lock serializes management actions with platform grant changes.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(81320711)::text`;
      const actor = await tx.user.findFirst({ where: { id: user.id, disabledAt: null, AND: ['platform.manage','platform.subscriptions.manage'].map(privilege => ({ privileges: { some: { privilege, status: 'active', revokedAt: null } } })) } });
      if (!actor) throw new Error('Denied');
      const salon = await tx.salon.findUnique({ where: { id: input.salonId } });
      if (!salon) throw new Error('Unavailable');
      const current = await tx.salonSubscription.findUnique({ where: { salonId: input.salonId } });
      if ((current?.version ?? 0) !== input.version) throw new Error('Conflict');
      const data = { planCode: input.planCode, status: input.status, currentPeriodEnd: input.periodEnd ? new Date(`${input.periodEnd}T23:59:59Z`) : null };
      const subscription = await tx.salonSubscription.upsert({ where: { salonId: input.salonId }, create: { salonId: input.salonId, ...data }, update: { ...data, version: { increment: 1 } } });
      await tx.auditEvent.create({ data: { actorUserId: user.id, action: 'platform.subscription.updated', targetType: 'SalonSubscription', targetId: subscription.id, outcome: 'allowed', metadata: { status: input.status, mode: 'manual-record' } } });
    });
    await invalidateSalonLayout(input.salonId);
    revalidatePath('/platform');
    return { message: 'Subscription record saved. No payment or billing-provider changes were made.' };
  } catch { return { error: 'Unable to save. Check your platform permissions, or reload if another operator changed this record.' }; }
}

export async function manageOperator(_state: FormState, form: FormData): Promise<FormState> {
  const parsed = z.object({ userId: z.uuid(), role: z.enum(['admin', 'manager', 'revoked']) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: 'Enter an existing user UUID and a valid platform role.' };
  try {
    await requireSameOrigin();
    await requirePlatformPrivilege('platform.manage');
    const actor = await requirePlatformPrivilege('platform.operators.manage');
    await rateLimit('platform-operator', actor.id, 20);
    await db.$transaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(81320711)::text`;
      const currentActor = await tx.user.findFirst({ where: { id: actor.id, disabledAt: null, AND: ['platform.manage','platform.operators.manage'].map(privilege => ({ privileges: { some: { privilege, status: 'active', revokedAt: null } } })) } });
      if (!currentActor) throw new Error('Denied');
      const target = await tx.user.findUnique({ where: { id: parsed.data.userId } });
      if (!target || target.disabledAt) throw new Error('Unavailable');
      const desired = platformRolePrivileges(parsed.data.role);
      if (!desired.includes('platform.operators.manage')) {
        const targetGrant = await tx.platformPrivilege.findUnique({ where: { userId_privilege: { userId: target.id, privilege: 'platform.operators.manage' } } });
        if (targetGrant?.status === 'active') {
          const remaining = await tx.user.count({ where: { id: { not: target.id }, disabledAt: null, AND: ['platform.manage','platform.operators.manage'].map(privilege => ({ privileges: { some: { privilege, status: 'active', revokedAt: null } } })) } });
          if (!remaining) throw new Error('Last platform administrator');
        }
      }
      for (const privilege of platformPrivileges) {
        const active = desired.includes(privilege);
        if (active) await tx.platformPrivilege.upsert({ where: { userId_privilege: { userId: target.id, privilege } }, create: { userId: target.id, privilege, grantedBy: actor.id }, update: { status: 'active', revokedAt: null, grantedBy: actor.id, grantedAt: new Date() } });
        else await tx.platformPrivilege.updateMany({ where: { userId: target.id, privilege, status: 'active' }, data: { status: 'revoked', revokedAt: new Date() } });
      }
      await tx.auditEvent.create({ data: { actorUserId: actor.id, action: 'platform.operator.updated', targetType: 'User', targetId: target.id, outcome: 'allowed', metadata: { platformRole: parsed.data.role } } });
    });
    revalidatePath('/platform');
    return { message: 'Platform access updated. Salon memberships and customer access are unchanged.' };
  } catch { return { error: 'Unable to update platform access. Check the user UUID and your permissions. The last platform administrator cannot be removed.' }; }
}

