import { beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ find: vi.fn(), invite: vi.fn(), signOut: vi.fn() }));
vi.mock('@/lib/db', () => ({ db: { user: { findUnique: m.find }, invitation: { findUnique: m.invite } } }));
import { getPortalAccess, authorizePortalSession } from '@/lib/auth/portal-access';
import { portalDestination } from '@/lib/auth/redirects';

const customer = () => ({ disabledAt: null, salonRegistrationName: null, customer: { userId: 'u' }, memberships: [], privileges: [], consents: [] });
beforeEach(() => { vi.resetAllMocks(); m.find.mockResolvedValue(customer()); m.signOut.mockResolvedValue({ error: null }); });

it('allows registered customers only into customer login', async () => {
  expect(await getPortalAccess('u')).toEqual({ customer: true, salon: false, platform: false });
});
it.each(['owner', 'admin', 'manager', 'staff', 'receptionist', 'inventory', 'accountant', 'cashier'])('denies customer access to salon %s accounts even with an old customer profile', async role => {
  m.find.mockResolvedValue({ ...customer(), memberships: [{ role, status: 'active', salon: { status: 'active' } }] });
  expect(await getPortalAccess('u')).toEqual({ customer: false, salon: true, platform: false });
});
it('preserves owner onboarding before their first membership', async () => {
  m.find.mockResolvedValue({ ...customer(), salonRegistrationName: 'My Salon', customer: null });
  expect(await getPortalAccess('u')).toEqual({ customer: false, salon: true, platform: false });
});
it('recognizes legacy salon registration consent', async () => {
  m.find.mockResolvedValue({ ...customer(), consents: [{ id: 'salon-terms' }] });
  expect((await getPortalAccess('u')).salon).toBe(true);
  expect((await getPortalAccess('u')).customer).toBe(false);
});
it.each(['suspended', 'revoked', 'invited'])('does not turn %s team membership into customer access', async status => {
  m.find.mockResolvedValue({ ...customer(), memberships: [{ status, salon: { status: 'active' } }] });
  expect(await getPortalAccess('u')).toEqual({ customer: false, salon: false, platform: false });
});
it('denies suspended salons', async () => {
  m.find.mockResolvedValue({ ...customer(), memberships: [{ status: 'active', salon: { status: 'suspended' } }] });
  expect((await getPortalAccess('u')).salon).toBe(false);
});
it('requires a current platform grant and prevents it becoming a customer account', async () => {
  m.find.mockResolvedValue({ ...customer(), privileges: [{ id: 'grant' }] });
  expect(await getPortalAccess('u')).toEqual({ customer: false, salon: false, platform: true });
  expect(m.find).toHaveBeenCalledWith(expect.objectContaining({ select: expect.objectContaining({ privileges: expect.objectContaining({ where: { privilege: 'platform.manage', status: 'active', revokedAt: null } }) }) }));
});
it.each([null, { ...customer(), disabledAt: new Date() }, { ...customer(), customer: null }])('fails closed for unavailable or unassigned profiles', async profile => {
  m.find.mockResolvedValue(profile);
  expect(await getPortalAccess('u')).toEqual({ customer: false, salon: false, platform: false });
});
it('signs out the attempted local session on wrong portal access', async () => {
  expect(await authorizePortalSession({ auth: { signOut: m.signOut } }, 'u', 'salon')).toBe(false);
  expect(m.signOut).toHaveBeenCalledWith({ scope: 'local' });
});
it('closes the attempted session when the role database is unavailable', async () => {
  m.find.mockRejectedValue(new Error('offline'));
  await expect(authorizePortalSession({ auth: { signOut: m.signOut } }, 'u', 'customer')).rejects.toThrow('offline');
  expect(m.signOut).toHaveBeenCalledWith({ scope: 'local' });
});
it('keeps authorized sessions', async () => {
  expect(await authorizePortalSession({ auth: { signOut: m.signOut } }, 'u', 'customer')).toBe(true);
  expect(m.signOut).not.toHaveBeenCalled();
});
it('binds redirect destinations to the authorized portal', () => {
  expect(portalDestination('/salon/onboarding', 'customer')).toBe('/customer');
  expect(portalDestination('/customer', 'salon')).toBe('/salon');
  expect(portalDestination('//evil.test', 'platform')).toBe('/platform');
  expect(portalDestination('/salon/invitations/accept', 'salon')).toBe('/salon/invitations/accept');
});
it('preserves recipient-bound team invitation sign-in without granting ordinary salon login', async () => {
  m.invite.mockResolvedValue({ intendedEmail: 'customer@example.test', acceptedAt: null, revokedAt: null, expiresAt: new Date(Date.now() + 60000), salon: { status: 'active' } });
  const invitation = { token: 'private-token', email: 'customer@example.test', destination: '/salon/invitations/accept' };
  expect(await authorizePortalSession({ auth: { signOut: m.signOut } }, 'u', 'salon', invitation)).toBe(true);
  expect(m.invite).toHaveBeenCalledWith(expect.objectContaining({ where: { tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/) } }));
  expect(await authorizePortalSession({ auth: { signOut: m.signOut } }, 'u', 'salon', { ...invitation, destination: '/salon' })).toBe(false);
});
it.each(['another@example.test', ''])('rejects invitation login for an incorrect recipient (%s)', async email => {
  m.invite.mockResolvedValue({ intendedEmail: 'invited@example.test', acceptedAt: null, revokedAt: null, expiresAt: new Date(Date.now() + 60000), salon: { status: 'active' } });
  expect(await authorizePortalSession({ auth: { signOut: m.signOut } }, 'u', 'salon', { token: 'private-token', email, destination: '/salon/invitations/accept' })).toBe(false);
});
