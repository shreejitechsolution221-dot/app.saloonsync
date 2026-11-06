import { beforeEach, expect, it, vi } from 'vitest';
import { parseRecord } from '@/lib/platform/validation';
import { platformRolePrivileges } from '@/lib/authorization/platform-policy';
import { evaluateRollout, rolloutApplies, rolloutBucket } from '@/lib/platform/rollout';
const m = vi.hoisted(() => ({ require: vi.fn(), actor: vi.fn(), find: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), audit: vi.fn(), transaction: vi.fn() }));
vi.mock('@/lib/authorization/server', () => ({ requirePlatformPrivilege: m.require, requireAuthenticatedUser: m.require }));
vi.mock('@/lib/security', () => ({ requireSameOrigin: async () => {}, rateLimit: async () => {} }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/salon/layout-data', () => ({ invalidateSalonLayout: vi.fn() }));
vi.mock('@/lib/db', () => ({ db: { $transaction: m.transaction } }));
import { savePlatformRecord, inspectSupportMetadata } from '@/server/platform-console-actions';
const actor = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const salon = '33333333-3333-4333-8333-333333333333';
const record = '44444444-4444-4444-8444-444444444444';
const ticket = '55555555-5555-4555-8555-555555555555';
function form(data: Record<string, string>) { const form = new FormData(); for (const [key,value] of Object.entries(data)) form.set(key,value); return form; }
const flag = () => form({ id: '', version: '0', kind: 'flag', title: 'Online booking', status: 'enabled', salonId: '', assigneeId: '', code: 'online_booking', percentage: '100' });
const request = () => form({ id: record, version: '1', kind: 'access', title: 'Help onboarding', status: 'approved', salonId: salon, assigneeId: other, ticketId: ticket, scope: 'onboarding_metadata', consent: 'Owner approval #17', expiresAt: new Date(Date.now() + 30 * 60000).toISOString().slice(0,16), notes: 'Help validate the setup' });
beforeEach(() => {
  vi.resetAllMocks(); m.require.mockResolvedValue({ id: actor }); m.actor.mockResolvedValue({ id: actor });
  m.transaction.mockImplementation(async work => work({ $queryRaw: vi.fn(), user: { findFirst: m.actor }, salon: { findUnique: vi.fn().mockResolvedValue({ id: salon }) }, platformRecord: { findUnique: m.find, findFirst: m.findFirst, create: m.create, update: m.update }, auditEvent: { create: m.audit } }));
  m.find.mockResolvedValue(null); m.findFirst.mockResolvedValue({ id: ticket }); m.create.mockResolvedValue({ id: record, version: 1 }); m.update.mockResolvedValue({ id: record, version: 2 });
});
it('keeps each specialist role away from operator assignment', () => {
  for (const role of ['operations','support','billing','security']) { expect(platformRolePrivileges(role)).toContain('platform.manage'); expect(platformRolePrivileges(role)).not.toContain('platform.operators.manage'); }
  expect(platformRolePrivileges('support')).not.toContain('platform.salons.manage');
  expect(platformRolePrivileges('security')).not.toContain('platform.settings.manage');
});
it('rejects direct requests without the action-specific privilege', async () => {
  m.require.mockImplementation(async privilege => { if (privilege === 'platform.configuration.manage') throw new Error('Denied'); return { id: actor }; });
  expect((await savePlatformRecord({}, flag())).error).toBeTruthy(); expect(m.transaction).not.toHaveBeenCalled();
});
it('rechecks revoked grants under the management lock', async () => {
  m.actor.mockResolvedValue(null); expect((await savePlatformRecord({},flag())).error).toBeTruthy(); expect(m.create).not.toHaveBeenCalled();
});
it('persists a rollout with an audit event in the same transaction', async () => {
  expect((await savePlatformRecord({},flag())).message).toContain('audit');
  expect(m.create).toHaveBeenCalledWith({ data: expect.objectContaining({ key: 'flag:online_booking', payload: expect.objectContaining({ percentage: 100 }), createdBy: actor }) });
  expect(m.audit).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'platform.flag.created' }) });
});
it('rejects stale record edits before writing', async () => {
  const input = flag(); input.set('id',record); input.set('version','1'); m.find.mockResolvedValue({ id: record, kind: 'flag', version: 2 });
  expect((await savePlatformRecord({},input)).error).toContain('changed'); expect(m.update).not.toHaveBeenCalled();
});
it('requires verified requester evidence before resolving support tickets', () => {
  const input = form({ id:'', version:'0', kind:'ticket', title:'Case', status:'resolved', salonId:'', assigneeId:'', priority:'normal', requester:'owner@example.com', notes:'Resolved' });
  expect(() => parseRecord(input)).toThrow('Verify');
});
it('rejects self-approval of support access', async () => {
  const input = request(); const parsed = parseRecord(input);
  m.find.mockResolvedValue({ id: record, kind:'access', version:1, createdBy:actor, salonId:salon, assigneeId:other, status:'requested', payload:parsed.payload });
  expect((await savePlatformRecord({},input)).error).toContain('Another'); expect(m.update).not.toHaveBeenCalled();
});
it('permits a separate security reviewer without giving that role support permissions', async () => {
  const input = request(); const parsed = parseRecord(input);
  m.require.mockImplementation(async privilege => { if (privilege === 'platform.support.manage') throw new Error('Denied'); return { id: actor }; });
  m.find.mockResolvedValue({ id: record, kind:'access', version:1, createdBy:other, salonId:salon, assigneeId:other, status:'requested', payload:parsed.payload });
  expect((await savePlatformRecord({},input)).message).toBeTruthy(); expect(m.update).toHaveBeenCalled();
});
it('prevents a reviewer from expanding the requested scope', async () => {
  const input=request(); const parsed=parseRecord(input);
  m.find.mockResolvedValue({ id:record, kind:'access', version:1, createdBy:other, salonId:salon, assigneeId:other, status:'requested', payload:{...parsed.payload, scope:'integration_metadata'} });
  expect((await savePlatformRecord({},input)).error).toContain('scope'); expect(m.update).not.toHaveBeenCalled();
});
it('rejects expired approved access before reading salon metadata', async () => {
  m.findFirst.mockResolvedValue({ salonId:salon, payload:{ expiresAt:'2020-01-01T00:00', scope:'onboarding_metadata' } });
  expect((await inspectSupportMetadata({},form({id:record}))).error).toContain('unexpired'); expect(m.audit).not.toHaveBeenCalled();
});
it('rejects access requests with a window longer than one hour', () => {
  const input=request();input.set('expiresAt',new Date(Date.now()+120*60000).toISOString().slice(0,16));expect(()=>parseRecord(input)).toThrow('60 minutes');
});
it('requires the invitee to accept invitations rather than an operator marking them accepted', async () => {
  const input=form({id:'',version:'0',kind:'invitation',title:'New agent',status:'accepted',salonId:'',assigneeId:'',email:'agent@example.com',role:'support',expiresAt:new Date(Date.now()+86400000).toISOString().slice(0,16)});
  expect((await savePlatformRecord({},input)).error).toContain('verified invitee'); expect(m.create).not.toHaveBeenCalled();
});
it('rejects unsafe legal links and out-of-range rollout percentages', () => {
  const input=flag(); input.set('percentage','101');expect(()=>parseRecord(input)).toThrow('percentage');
  const settings=form({id:'',version:'0',kind:'settings',title:'SaloonSync',status:'active',salonId:'',assigneeId:'',supportEmail:'help@example.com',locale:'en-IN',timezone:'Asia/Kolkata',termsUrl:'javascript:alert(1)'});
  expect(()=>parseRecord(settings)).toThrow('HTTPS');
});
it('keeps rollout targeting tenant-specific and deterministic', () => {
  expect(rolloutApplies({salonId:salon,status:'enabled',payload:{planCode:'pro',group:'early'}},{salonId:other,planCode:'pro',group:'early'})).toBe(false);
  expect(rolloutApplies({salonId:null,status:'enabled',payload:{planCode:'pro'}},{salonId:salon,planCode:'basic'})).toBe(false);
  expect(rolloutBucket(salon,'online_booking')).toBe(rolloutBucket(salon,'online_booking'));
  expect(evaluateRollout(undefined,salon,'online_booking')).toBe(true);
  expect(evaluateRollout({salonId:null,status:'disabled',payload:{percentage:100}},salon,'online_booking')).toBe(false);
  expect(evaluateRollout({salonId:null,status:'enabled',payload:{percentage:100}},salon,'online_booking')).toBe(true);
  expect(evaluateRollout({salonId:null,status:'enabled',payload:{percentage:0}},salon,'online_booking')).toBe(false);
});
it('prevents even a super admin from changing another operator’s private preferences', async () => {
  const input=form({id:record,version:'1',kind:'preference',title:'Preferences',status:'active',salonId:'',assigneeId:'',locale:'en-IN',timezone:'Asia/Kolkata',density:'compact'});
  m.find.mockResolvedValue({id:record,kind:'preference',version:1,createdBy:other});
  expect((await savePlatformRecord({},input)).error).toContain('current operator');expect(m.update).not.toHaveBeenCalled();
});
