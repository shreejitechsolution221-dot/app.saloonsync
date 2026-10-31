import { beforeEach, expect, it, vi } from 'vitest';
import { platformRolePrivileges } from '@/lib/authorization/platform-policy';
const m = vi.hoisted(() => ({ require: vi.fn(), transaction: vi.fn(), user: { findFirst: vi.fn(), findUnique: vi.fn(), count: vi.fn() }, grants: { findUnique: vi.fn(), upsert: vi.fn(), updateMany: vi.fn() }, salon: { findUnique: vi.fn() }, subscription: { findUnique: vi.fn(), upsert: vi.fn() }, audit: { create: vi.fn() }, raw: vi.fn() }));
vi.mock('@/lib/authorization/server', () => ({ requirePlatformPrivilege: m.require }));
vi.mock('@/lib/security', () => ({ requireSameOrigin: async () => {}, rateLimit: async () => {} }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/db', () => ({ db: { $transaction: m.transaction } }));
import { saveSubscription, manageOperator } from '@/server/platform-actions';
const id='11111111-1111-4111-8111-111111111111';
const form = (data: Record<string,string>) => { const f=new FormData(); Object.entries(data).forEach(([k,v])=>f.set(k,v)); return f; };
beforeEach(() => {
  vi.resetAllMocks(); m.require.mockResolvedValue({ id });
  m.transaction.mockImplementation(async fn => fn({ user: m.user, platformPrivilege: m.grants, salon: m.salon, salonSubscription: m.subscription, auditEvent: m.audit, $queryRaw: m.raw }));
  m.user.findFirst.mockResolvedValue({ id }); m.user.findUnique.mockResolvedValue({ id, disabledAt: null });
  m.salon.findUnique.mockResolvedValue({ id }); m.subscription.findUnique.mockResolvedValue(null); m.subscription.upsert.mockResolvedValue({ id: 'subscription' });
});
it('subscription managers cannot manage platform operators', () => {
  expect(platformRolePrivileges('manager')).toEqual(['platform.manage','platform.subscriptions.manage']);
  expect(platformRolePrivileges('admin')).toContain('platform.operators.manage');
  expect(platformRolePrivileges('owner')).toEqual([]); expect(platformRolePrivileges('customer')).toEqual([]);
});
it('direct subscription actions deny salon/customer callers without platform privileges', async () => {
  m.require.mockRejectedValue(new Error('Forbidden'));
  expect((await saveSubscription({}, form({ salonId:id,planCode:'plan',status:'active',version:'0',periodEnd:'' }))).error).toBeTruthy();
  expect(m.transaction).not.toHaveBeenCalled();
});
it('checks subscription-specific privileges even with platform entry', async () => {
  m.require.mockImplementation(async privilege => { if(privilege === 'platform.subscriptions.manage') throw new Error('Forbidden'); return { id }; });
  expect((await saveSubscription({}, form({ salonId:id,planCode:'plan',status:'active',version:'0',periodEnd:'' }))).error).toBeTruthy(); expect(m.transaction).not.toHaveBeenCalled();
});
it('saves subscription records without claiming to charge payments', async () => {
  const result=await saveSubscription({},form({salonId:id,planCode:'plan',status:'active',version:'0',periodEnd:''}));
  expect(result.message).toContain('No payment'); expect(m.subscription.upsert).toHaveBeenCalled();
});
it('rejects stale subscription updates', async () => {
  m.subscription.findUnique.mockResolvedValue({ version: 2 });
  expect((await saveSubscription({},form({salonId:id,planCode:'plan',status:'active',version:'1',periodEnd:''}))).error).toBeTruthy(); expect(m.subscription.upsert).not.toHaveBeenCalled();
});
it('requires operator-management privilege for direct operator actions', async () => {
  m.require.mockImplementation(async privilege => { if(privilege==='platform.operators.manage') throw new Error('Forbidden'); return { id }; });
  expect((await manageOperator({}, form({userId:id,role:'admin'}))).error).toBeTruthy(); expect(m.grants.upsert).not.toHaveBeenCalled();
});
it('protects the last platform administrator', async () => {
  m.grants.findUnique.mockResolvedValue({status:'active'}); m.user.count.mockResolvedValue(0);
  expect((await manageOperator({},form({userId:id,role:'revoked'}))).error).toContain('last platform administrator'); expect(m.grants.updateMany).not.toHaveBeenCalled();
});
it('rechecks current platform authority inside the transaction', async () => {
  m.user.findFirst.mockResolvedValue(null);
  expect((await manageOperator({},form({userId:id,role:'admin'}))).error).toBeTruthy(); expect(m.grants.upsert).not.toHaveBeenCalled();
});
