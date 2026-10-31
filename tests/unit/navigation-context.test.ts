import { beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ identity: vi.fn(), profile: vi.fn(), schema: vi.fn(), query: vi.fn() }));
vi.mock('@/lib/authorization/server', () => ({ requireVerifiedIdentity: m.identity, requireAuthenticatedUser: m.profile, AccessError: class extends Error { constructor(public code: string) { super(code); } } }));
vi.mock('@/lib/auth/page-guard', () => ({ guard: async (_portal: string, run: () => Promise<unknown>) => run() }));
vi.mock('@/lib/operations/schema-ready', () => ({ businessSchemaReady: m.schema }));
vi.mock('@/lib/db', () => ({ db: { $queryRaw: m.query } }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw new Error('redirect:' + url); } }));
import { salonContext } from '@/lib/salon/context';
beforeEach(() => {
  vi.resetAllMocks(); m.identity.mockResolvedValue({ user: { id: 'verified-user' }, email: 'member@example.test', client: {} });
  m.profile.mockResolvedValue({ id: 'verified-user', displayName: 'Member' }); m.schema.mockResolvedValue(true);
  m.query.mockResolvedValue([{ id: 'verified-user', displayName: 'Member', mobileNumber: null, salonRegistrationName: null, disabledAt: null, workspace: { membershipId: 'membership', salonId: 'salon', role: 'staff', branchScope: 'selected', salonName: 'Studio', branches: [{ id: 'allowed', name: 'Allowed' }] } }]);
});
it('loads the profile and workspace once without a duplicate profile query', async () => {
  const result = await salonContext();
  expect(result.user.id).toBe('verified-user'); expect(result.salonId).toBe('salon');
  expect(result.branches.map(b => b.id)).toEqual(['allowed']);
  expect(m.query).toHaveBeenCalledOnce(); expect(m.profile).not.toHaveBeenCalled();
});
it('still rejects disabled-account/profile failures even when workspace data resolves', async () => {
  m.query.mockResolvedValue([{ id: 'verified-user', disabledAt: new Date(), workspace: null }]);
  await expect(salonContext()).rejects.toThrow('FORBIDDEN');
});
it('does not query tenant data before provider identity verification succeeds', async () => {
  m.identity.mockRejectedValue(new Error('UNAUTHENTICATED'));
  await expect(salonContext()).rejects.toThrow('UNAUTHENTICATED'); expect(m.query).not.toHaveBeenCalled();
});
it('preserves the schema-update and missing-workspace redirects', async () => {
  m.schema.mockResolvedValue(false); await expect(salonContext()).rejects.toThrow('redirect:/salon/setup');
  m.schema.mockResolvedValue(true); m.query.mockResolvedValue([]);
  await expect(salonContext()).rejects.toThrow('redirect:/salon/select-workspace');
});
it('preserves first-login profile provisioning without granting a workspace', async () => {
  m.query.mockResolvedValue([]);
  await expect(salonContext()).rejects.toThrow('redirect:/salon/select-workspace');
  expect(m.profile).toHaveBeenCalledOnce();
});
