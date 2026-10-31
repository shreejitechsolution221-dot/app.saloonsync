import 'server-only';
import { db } from '@/lib/db';
import { supabase } from '@/lib/auth/supabase';
import { branchPermitted, permits, type Permission } from './policy';
import { cache } from 'react';
export class AccessError extends Error {
  constructor(public code: 'UNAUTHENTICATED' | 'UNVERIFIED' | 'FORBIDDEN' | 'MFA_REQUIRED') { super(code); }
}
export const requireVerifiedIdentity = cache(async function requireVerifiedIdentity() {
  const client = await supabase();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) throw new AccessError('UNAUTHENTICATED');
  if (!user.email_confirmed_at || !user.email) throw new AccessError('UNVERIFIED');
  return { user, client, email: user.email };
});
export const requireAuthenticatedUser = cache(async function requireAuthenticatedUser() {
  const { user, client, email } = await requireVerifiedIdentity();
  // Only display text comes from editable metadata. Authorization never does.
  const select = { id: true, displayName: true, mobileNumber: true, salonRegistrationName: true, disabledAt: true } as const;
  const profile = await db.user.findUnique({ where: { id: user.id }, select }) ?? await db.user.upsert({ where: { id: user.id }, update: {}, create: { id: user.id, displayName: String(user.user_metadata.full_name ?? '').slice(0, 120) || 'Member' }, select });
  if (profile.disabledAt) throw new AccessError('FORBIDDEN');
  return { ...profile, email: email.toLowerCase(), auth: client };
});
export const requirePlatformPrivilege = cache(async function requirePlatformPrivilege(privilege: string) {
  const user = await requireAuthenticatedUser();
  const grant = await db.platformPrivilege.findUnique({ where: { userId_privilege: { userId: user.id, privilege } }, select: { status: true, revokedAt: true } });
  if (!grant || grant.status !== 'active' || grant.revokedAt) throw new AccessError('FORBIDDEN');
  const { data, error } = await user.auth.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || data?.currentLevel !== 'aal2') throw new AccessError('MFA_REQUIRED');
  return user;
});
export const requireSalonMembership = cache(async function requireSalonMembership(salonId: string) {
  const user = await requireAuthenticatedUser();
  const membership = await db.salonMembership.findUnique({ where: { salonId_userId: { salonId, userId: user.id } }, select: { id: true, salonId: true, userId: true, role: true, branchScope: true, status: true, salon: { select: { status: true } }, branches: { select: { branchId: true } } } });
  if (!membership || membership.status !== 'active' || membership.salon.status !== 'active') throw new AccessError('FORBIDDEN');
  return { user, membership };
});
export async function requirePermission(salonId: string, permission: Permission) {
  const context = await requireSalonMembership(salonId);
  if (!permits(context.membership.role, permission)) throw new AccessError('FORBIDDEN');
  return context;
}
export async function requireBranchAccess(salonId: string, branchId: string, permission: Permission) {
  const context = await requirePermission(salonId, permission);
  const branch = await db.branch.findFirst({ where: { id: branchId, salonId, status: 'active' } });
  if (!branch || !branchPermitted(context.membership, branchId)) throw new AccessError('FORBIDDEN');
  return { ...context, branch };
}
