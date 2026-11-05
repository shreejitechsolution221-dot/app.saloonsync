import { beforeEach, expect, it, vi } from 'vitest';
import { AccessError } from '@/lib/authorization/server';
import { NextRequest } from 'next/server';
const mocks = vi.hoisted(() => ({ auth: vi.fn(), branch: vi.fn(), booking: vi.fn(), list: vi.fn() }));
vi.mock('@/lib/authorization/server', () => ({ requireCustomerUser: mocks.auth, requireBranchAccess: mocks.branch, AccessError: class AccessError extends Error { constructor(public code: string) { super(code); } } }));
vi.mock('@/lib/db', () => ({ db: { appointment: { findFirst: mocks.booking, findMany: mocks.list } } }));
import { GET as getBooking } from '@/app/api/customer/bookings/[bookingId]/route';
import { GET as getBranch } from '@/app/api/salons/[salonId]/branches/[branchId]/appointments/route';
const id = '11111111-1111-4111-8111-111111111111';
beforeEach(() => { vi.resetAllMocks(); mocks.auth.mockResolvedValue({ id: 'customer-a' }); mocks.booking.mockResolvedValue(null); });
it('scopes direct customer API requests by authenticated identity', async () => {
  const result = await getBooking(new NextRequest('https://app.test'), { params: Promise.resolve({ bookingId: id }) });
  expect(result.status).toBe(404); expect(mocks.booking.mock.calls[0][0].where).toEqual({ id, customerUserId: 'customer-a' });
});
it('denies direct customer API requests from authenticated accounts with the wrong role', async () => {
  mocks.auth.mockRejectedValue(new AccessError('FORBIDDEN'));
  const result = await getBooking(new NextRequest('https://app.test'), { params: Promise.resolve({ bookingId: id }) });
  expect(result.status).toBe(403);
  expect(mocks.booking).not.toHaveBeenCalled();
});
it('does not query appointments when direct branch access is denied', async () => {
  mocks.branch.mockRejectedValue(new AccessError('FORBIDDEN'));
  const result = await getBranch(new NextRequest('https://app.test'), { params: Promise.resolve({ salonId: id, branchId: id }) });
  expect(result.status).toBe(403); expect(mocks.list).not.toHaveBeenCalled();
});
it('keeps staff scope on cursor pages and uses a unique ordering tie-breaker', async () => {
  mocks.branch.mockResolvedValue({ user: { id: 'staff-a' }, membership: { role: 'staff' } });
  mocks.list.mockResolvedValue([{ id, startsAt: new Date('2026-10-29T10:00:00Z'), status: 'confirmed' }, { id: '22222222-2222-4222-8222-222222222222', startsAt: new Date('2026-10-29T09:00:00Z'), status: 'confirmed' }]);
  const context = { params: Promise.resolve({ salonId: id, branchId: id }) };
  const response = await getBranch(new NextRequest('https://app.test?limit=1'), context);
  const body = await response.json();
  expect(body.appointments).toHaveLength(1); expect(body.nextCursor).toBeTruthy();
  expect(mocks.list.mock.calls[0][0]).toMatchObject({ where: { salonId: id, branchId: id, assignedUserId: 'staff-a' }, take: 2, orderBy: [{ startsAt: 'desc' }, { id: 'desc' }] });
  mocks.list.mockResolvedValue([]);
  const next = await getBranch(new NextRequest(`https://app.test?limit=1&cursor=${body.nextCursor}`), context);
  expect(next.status).toBe(200); expect(mocks.branch).toHaveBeenCalledTimes(2);
  expect(mocks.list.mock.calls[1][0].where).toMatchObject({ salonId: id, branchId: id, assignedUserId: 'staff-a', OR: [{ startsAt: { lt: new Date('2026-10-29T10:00:00Z') } }, { startsAt: new Date('2026-10-29T10:00:00Z'), id: { lt: id } }] });
});
it('rejects invalid page limits without querying appointment data', async () => {
  mocks.branch.mockResolvedValue({ user: { id: 'user-a' }, membership: { role: 'owner' } });
  const response = await getBranch(new NextRequest('https://app.test?limit=100000'), { params: Promise.resolve({ salonId: id, branchId: id }) });
  expect(response.status).toBe(400); expect(mocks.list).not.toHaveBeenCalled();
});
it('reports database outages separately from authorization failures', async () => {
  mocks.branch.mockResolvedValue({ user: { id: 'user-a' }, membership: { role: 'owner' } });
  mocks.list.mockRejectedValue(new Error('private SQL error'));
  const response = await getBranch(new NextRequest('https://app.test'), { params: Promise.resolve({ salonId: id, branchId: id }) });
  expect(response.status).toBe(503); expect(await response.json()).toEqual({ error: 'Service unavailable' });
});
