import { describe, expect, it, vi, beforeEach } from 'vitest';
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), assurance: vi.fn(), user: { upsert: vi.fn(), findUnique: vi.fn() }, membership: { findUnique: vi.fn() }, privilege: { findUnique: vi.fn() }, branch: { findFirst: vi.fn() } }));
vi.mock('@/lib/auth/supabase', () => ({ supabase: async () => ({ auth: { getUser: mocks.getUser, mfa: { getAuthenticatorAssuranceLevel: mocks.assurance } } }) }));
vi.mock('@/lib/db', () => ({ db: { user: mocks.user, salonMembership: mocks.membership, platformPrivilege: mocks.privilege, branch: mocks.branch } }));
import { requireAuthenticatedUser, requireCustomerUser, requireSalonUser, requireBranchAccess, requirePlatformPrivilege, requireSalonMembership } from '@/lib/authorization/server';
const portal = vi.hoisted(() => ({ getPortalAccess: vi.fn() }));
vi.mock('@/lib/auth/portal-access', () => portal);
beforeEach(() => {
  vi.resetAllMocks();
  mocks.user.findUnique.mockResolvedValue(null);
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'u', email: 'user@example.test', email_confirmed_at: 'today', user_metadata: { role: 'owner' } } } });
  mocks.user.upsert.mockResolvedValue({ id: 'u', displayName: 'User', disabledAt: null });
  mocks.membership.findUnique.mockResolvedValue({ role: 'staff', status: 'active', branchScope: 'selected', branches: [{ branchId: 'b1' }], salon: { status: 'active' } });
});
describe('current server authorization', () => {
  it('denies salon onboarding to customer-only identities', async () => {
    portal.getPortalAccess.mockResolvedValue({ customer: true, salon: false, platform: false });
    await expect(requireSalonUser()).rejects.toThrow('FORBIDDEN');
  });
  it('allows registered salon identities into salon onboarding', async () => {
    portal.getPortalAccess.mockResolvedValue({ customer: false, salon: true, platform: false });
    expect((await requireSalonUser()).id).toBe('u');
  });
  it('denies customer operations even for authenticated salon owners', async () => {
    portal.getPortalAccess.mockResolvedValue({ customer: false, salon: true, platform: false });
    await expect(requireCustomerUser()).rejects.toThrow('FORBIDDEN');
  });
  it('permits customer operations only with current customer authorization', async () => {
    portal.getPortalAccess.mockResolvedValue({ customer: true, salon: false, platform: false });
    expect((await requireCustomerUser()).id).toBe('u');
  });
  it('reads current existing profiles without an unnecessary write',async()=>{
    mocks.user.findUnique.mockResolvedValue({id:'u',displayName:'User',disabledAt:null});
    expect((await requireAuthenticatedUser()).id).toBe('u');expect(mocks.user.upsert).not.toHaveBeenCalled();
  });
  it('rejects expired sessions', async () => { mocks.getUser.mockResolvedValue({ data: { user: null } }); await expect(requireAuthenticatedUser()).rejects.toThrow('UNAUTHENTICATED'); });
  it('rejects unverified identities', async () => { mocks.getUser.mockResolvedValue({ data: { user: { id: 'u', email: 'x@example.test' } } }); await expect(requireAuthenticatedUser()).rejects.toThrow('UNVERIFIED'); });
  it('rejects disabled application identities', async () => { mocks.user.upsert.mockResolvedValue({ id: 'u', disabledAt: new Date() }); await expect(requireAuthenticatedUser()).rejects.toThrow('FORBIDDEN'); });
  it('does not grant a membership from user metadata', async () => { mocks.membership.findUnique.mockResolvedValue(null); await expect(requireSalonMembership('other')).rejects.toThrow('FORBIDDEN'); });
  it.each(['suspended', 'revoked', 'invited'])('rejects %s membership', async status => { mocks.membership.findUnique.mockResolvedValue({ status, salon: { status: 'active' } }); await expect(requireSalonMembership('s')).rejects.toThrow('FORBIDDEN'); });
  it('rejects a suspended salon', async () => { mocks.membership.findUnique.mockResolvedValue({ status: 'active', salon: { status: 'suspended' } }); await expect(requireSalonMembership('s')).rejects.toThrow('FORBIDDEN'); });
  it('rejects cross-branch and cross-tenant identifiers', async () => {
    mocks.branch.findFirst.mockResolvedValue({ id: 'b2' });
    await expect(requireBranchAccess('s', 'b2', 'appointment.assigned.read')).rejects.toThrow('FORBIDDEN');
    mocks.branch.findFirst.mockResolvedValue(null);
    await expect(requireBranchAccess('other', 'b1', 'appointment.assigned.read')).rejects.toThrow('FORBIDDEN');
    expect(mocks.branch.findFirst).toHaveBeenLastCalledWith({ where: { id: 'b1', salonId: 'other', status: 'active' } });
  });
  it('rejects revoked platform privileges', async () => { mocks.privilege.findUnique.mockResolvedValue({ status: 'revoked' }); await expect(requirePlatformPrivilege('platform.manage')).rejects.toThrow('FORBIDDEN'); });
  it('requires provider verified MFA for platform', async () => {
    mocks.privilege.findUnique.mockResolvedValue({ status: 'active' }); mocks.assurance.mockResolvedValue({ data: { currentLevel: 'aal1' } });
    await expect(requirePlatformPrivilege('platform.manage')).rejects.toThrow('MFA_REQUIRED');
    mocks.assurance.mockResolvedValue({ data: { currentLevel: 'aal2' } }); expect((await requirePlatformPrivilege('platform.manage')).id).toBe('u');
  });
});
