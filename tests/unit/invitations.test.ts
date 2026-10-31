import { beforeEach, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
const m = vi.hoisted(() => ({ cookie: { get: vi.fn(), delete: vi.fn() }, user: vi.fn(), tx: { $queryRaw: vi.fn(), user: { findUnique: vi.fn() }, staffProfile:{updateMany:vi.fn()}, invitation: { findUnique: vi.fn(), update: vi.fn() }, salonMembership: { findUnique: vi.fn(), upsert: vi.fn() }, membershipBranchAccess: { deleteMany: vi.fn(), createMany: vi.fn() }, auditEvent: { create: vi.fn() } }, lookup: vi.fn() }));
vi.mock('next/headers', () => ({ cookies: async () => m.cookie }));
vi.mock('@/lib/security', () => ({ requireSameOrigin: async () => {}, rateLimit: async () => {}, appOrigin: () => 'https://app.test' }));
vi.mock('@/lib/authorization/server', () => ({ requireAuthenticatedUser: m.user, requirePermission: vi.fn() }));
vi.mock('@/lib/db', () => ({ db: { invitation: { findUnique: m.lookup }, $transaction: async (fn: (tx: unknown) => unknown) => fn(m.tx) } }));
import { acceptInvitation } from '@/server/workspaces';
const now = new Date('2026-10-27T12:00:00Z');
const token = 'a'.repeat(43);
let invitation: Record<string, unknown>;
beforeEach(() => {
  vi.resetAllMocks(); m.cookie.get.mockReturnValue({ value: token });
  m.user.mockResolvedValue({ id: 'user', email: 'invited@example.test' });
  m.tx.user.findUnique.mockResolvedValue({ id: 'user', disabledAt: null });
  m.lookup.mockResolvedValue({ salonId: 'salon' }); m.tx.$queryRaw.mockResolvedValue([{ now }]);
  invitation = { id: 'invite', salonId: 'salon', intendedEmail: 'invited@example.test', invitedBy: 'owner', role: 'staff', branchScope: 'all', branches: [], salon: { status: 'active' }, acceptedAt: null, revokedAt: null, expiresAt: new Date('2026-10-28T12:00:00Z') };
  m.tx.invitation.findUnique.mockImplementation(async () => invitation);
  m.tx.salonMembership.findUnique.mockImplementation(async ({ where }) => where.salonId_userId.userId === 'owner' ? { role: 'owner', status: 'active', branchScope: 'all', user: { disabledAt: null } } : null);
  m.tx.salonMembership.upsert.mockResolvedValue({ id: 'membership' });
});
it.each(['expired', 'revoked', 'accepted', 'wrong-email', 'suspended-salon'])('rejects %s invitation without granting membership', async kind => {
  if (kind === 'expired') invitation.expiresAt = now;
  if (kind === 'revoked') invitation.revokedAt = now;
  if (kind === 'accepted') invitation.acceptedAt = now;
  if (kind === 'wrong-email') invitation.intendedEmail = 'someone-else@example.test';
  if (kind === 'suspended-salon') invitation.salon = { status: 'suspended' };
  expect((await acceptInvitation({}, new FormData())).error).toBeTruthy();
  expect(m.tx.salonMembership.upsert).not.toHaveBeenCalled();
});
it('stores and queries only a hash, atomically consumes the invitation and clears context', async () => {
  expect((await acceptInvitation({}, new FormData())).message).toContain('accepted');
  expect(m.lookup).toHaveBeenCalledWith({ where: { tokenHash: createHash('sha256').update(token).digest('hex') }, select: { salonId: true } });
  expect(m.tx.invitation.update).toHaveBeenCalledWith({ where: { id: 'invite' }, data: { acceptedAt: now, acceptedBy: 'user' } });
  expect(m.cookie.delete).toHaveBeenCalledWith('invitation');
});
it('cannot overwrite an existing active member role', async () => {
  m.tx.salonMembership.findUnique.mockResolvedValue({ role: 'owner', status: 'active', branchScope: 'all', user: { disabledAt: null } });
  expect((await acceptInvitation({}, new FormData())).error).toBeTruthy(); expect(m.tx.salonMembership.upsert).not.toHaveBeenCalled();
});
it('rejects invitations when inviter authority has been revoked', async () => {
  m.tx.salonMembership.findUnique.mockResolvedValue({ role: 'owner', status: 'revoked', branchScope: 'all', user: { disabledAt: null } });
  expect((await acceptInvitation({}, new FormData())).error).toBeTruthy(); expect(m.tx.salonMembership.upsert).not.toHaveBeenCalled();
});

it('links the employee profile when its invitation is accepted',async()=>{invitation.staffProfileId='profile';m.tx.staffProfile.updateMany.mockResolvedValue({count:1});expect((await acceptInvitation({},new FormData())).message).toContain('accepted');expect(m.tx.staffProfile.updateMany).toHaveBeenCalledWith({where:{id:'profile',salonId:'salon',active:true,OR:[{userId:null},{userId:'user'}]},data:{userId:'user'}});});
it('does not consume an invitation whose employee profile is no longer available',async()=>{invitation.staffProfileId='profile';m.tx.staffProfile.updateMany.mockResolvedValue({count:0});expect((await acceptInvitation({},new FormData())).error).toBeTruthy();expect(m.tx.invitation.update).not.toHaveBeenCalled();});
