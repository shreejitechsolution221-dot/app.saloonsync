import { beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ context: vi.fn(), services: vi.fn(), members: vi.fn(), visits: vi.fn() }));
vi.mock('@/lib/salon/context', () => ({ requireModule: m.context, money: String }));
vi.mock('@/lib/db', () => ({ db: { $queryRaw: m.services, salonMembership: { findMany: m.members }, appointment: { findMany: m.visits } } }));
vi.mock('@/server/salon-actions', () => ({ addService: vi.fn() }));
vi.mock('@/server/catalog-actions', () => ({ editService: vi.fn() }));
vi.mock('@/components/salon/shell', () => ({ SalonShell: () => null, PageHeading: () => null, Empty: () => null }));
vi.mock('@/components/salon/forms', () => ({ ActionForm: () => null, CreatePanel: () => null, Field: () => null }));
vi.mock('@/components/operations/ui', () => ({ ModuleTabs: () => null }));
import Services from '@/app/salon/services/page';
beforeEach(() => { vi.resetAllMocks(); m.context.mockResolvedValue({ salonId: 'salon-a', user: { id: 'user-a' }, membership: { role: 'owner', branchScope: 'all' }, administrator: true }); m.services.mockResolvedValue([]); m.members.mockResolvedValue([]); m.visits.mockResolvedValue([]); });
it('starts catalog loading without waiting for the independent staff selector', async () => {
  let finish!: (value: unknown[]) => void; let started!: () => void;
  const loading = new Promise<void>(resolve => { started = resolve; });
  m.members.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  m.services.mockImplementation(async () => { started(); return []; });
  const page = Services(); await loading;
  expect(m.members).toHaveBeenCalledOnce(); expect(m.services).toHaveBeenCalledOnce();
  expect(m.services.mock.calls[0][0].values).toEqual(['salon-a',true,false,'user-a']);
  finish([]); await page;
});
it('preserves staff service visibility filters and avoids the administrator staff query', async () => {
  m.context.mockResolvedValue({ salonId: 'salon-a', user: { id: 'staff-a' }, membership: { role: 'staff', branchScope: 'selected' }, administrator: false });
  m.visits.mockResolvedValue([{ serviceName: 'Assigned haircut' }]); await Services();
  expect(m.members).not.toHaveBeenCalled();
  expect(m.visits).not.toHaveBeenCalled();
  const query=m.services.mock.calls[0][0];expect(query.values).toEqual(['salon-a',false,true,'staff-a']);
  expect(query.text).toContain('a."salonId" = s."salonId"');expect(query.text).toContain('a."assignedUserId"');expect(query.text).toContain('AND a."serviceName" = s.name');
});
