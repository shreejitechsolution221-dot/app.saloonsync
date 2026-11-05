import { beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ user: vi.fn(), access: vi.fn(), configured: vi.fn() }));
vi.mock('@/lib/auth/config', () => ({ authConfigured: m.configured }));
vi.mock('@/lib/auth/portal-access', () => ({ getPortalAccess: m.access }));
vi.mock('next/navigation', () => ({ redirect: (path: string) => { throw new Error(`REDIRECT:${path}`); } }));
vi.mock('@/lib/authorization/server', () => ({
  requireAuthenticatedUser: m.user,
  AccessError: class AccessError extends Error { constructor(public code: string) { super(code); } },
}));
import { AccessError } from '@/lib/authorization/server';
import { optionalCustomerUser } from '@/lib/customer/identity';

beforeEach(() => {
  vi.resetAllMocks();
  m.configured.mockReturnValue(true);
  m.user.mockResolvedValue({ id: 'u', displayName: 'Customer' });
  m.access.mockResolvedValue({ customer: true, salon: false, platform: false });
});
it('allows guest discovery without querying role data', async () => {
  m.user.mockRejectedValue(new AccessError('UNAUTHENTICATED'));
  expect(await optionalCustomerUser()).toBeNull();
  expect(m.access).not.toHaveBeenCalled();
});
it('returns only an authorized customer identity', async () => {
  expect(await optionalCustomerUser()).toEqual({ id: 'u', displayName: 'Customer' });
  expect(m.access).toHaveBeenCalledWith('u');
});
it.each(['salon', 'platform'])('routes an existing %s session to its own panel', async portal => {
  m.access.mockResolvedValue({ customer: false, salon: portal === 'salon', platform: portal === 'platform' });
  await expect(optionalCustomerUser()).rejects.toThrow(`REDIRECT:/${portal}`);
});
it('denies disabled or unassigned accounts without treating them as guests', async () => {
  m.access.mockResolvedValue({ customer: false, salon: false, platform: false });
  await expect(optionalCustomerUser()).rejects.toThrow('REDIRECT:/customer/access-denied');
});
it('requires verified email before customer access', async () => {
  m.user.mockRejectedValue(new AccessError('UNVERIFIED'));
  await expect(optionalCustomerUser()).rejects.toThrow('REDIRECT:/auth/verify-email?portal=customer');
});
it('does not hide database errors as guest sessions', async () => {
  m.access.mockRejectedValue(new Error('offline'));
  await expect(optionalCustomerUser()).rejects.toThrow('offline');
});
