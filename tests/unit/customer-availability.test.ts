import { beforeEach, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ branch: vi.fn(), staff: vi.fn(), appointments: vi.fn(), leave: vi.fn(), shifts: vi.fn(), services: vi.fn() }));
vi.mock('@/lib/db', () => ({ db: {
  branch: { findFirst: m.branch }, salonMembership: { findMany: m.staff },
  appointment: { findMany: m.appointments }, leaveRequest: { findMany: m.leave },
  shift: { findMany: m.shifts }, service: { findMany: m.services },
} }));
vi.mock('@/server/redis', () => ({ redis: null }));
import { getCustomerBookingAvailability } from '@/lib/customer/queries';

beforeEach(() => {
  m.branch.mockResolvedValue({ id: 'branch', salon: { settings: { openingHour: 10, closingHour: 12 } } });
  m.staff.mockResolvedValue([{ userId: 'stylist' }]);
  m.appointments.mockResolvedValue([]);
  m.leave.mockResolvedValue([]);
  m.shifts.mockResolvedValue([]);
  m.services.mockResolvedValue([{ eligibleUserIds: [] }]);
});
const slots = () => getCustomerBookingAvailability('salon', 'branch', 60, undefined, '2099-01-02');

it('uses configured opening hours and fits the entire duration before closing', async () => {
  const result = await slots();
  expect(result.map(s => s.timeStr)).toEqual(['10:00 AM', '10:30 AM', '11:00 AM']);
  expect(result.every(s => s.available)).toBe(true);
});
it('rejects impossible dates before querying the database', async () => {
  expect(await getCustomerBookingAvailability('salon', 'branch', 60, undefined, '2099-02-30')).toEqual([]);
  expect(m.branch).not.toHaveBeenCalled();
});
it('does not offer inactive or mismatched branches', async () => {
  m.branch.mockResolvedValueOnce(null);
  expect(await slots()).toEqual([]);
  expect(m.staff).not.toHaveBeenCalled();
});
it('checks every overlapping appointment across branch boundaries', async () => {
  m.appointments.mockResolvedValue([
    { assignedUserId: 'stylist', startsAt: new Date('2099-01-02T01:00:00Z'), durationMinutes: 30 },
    { assignedUserId: 'stylist', startsAt: new Date('2099-01-02T04:30:00Z'), durationMinutes: 60 },
  ]);
  const result = await slots();
  expect(result[0].available).toBe(false);
  expect(result[2].available).toBe(true);
  expect(m.appointments.mock.calls[0][0].where).not.toHaveProperty('branchId');
});
it('blocks approved leave and missing required shifts', async () => {
  m.leave.mockResolvedValue([{ userId: 'stylist', startsAt: new Date('2099-01-02T00:00:00Z'), endsAt: new Date('2099-01-03T00:00:00Z') }]);
  expect((await slots()).every(s => !s.available)).toBe(true);
  m.leave.mockResolvedValue([]);
  m.branch.mockResolvedValue({ salon: { settings: { requireShift: true } } });
  expect((await slots()).every(s => !s.available)).toBe(true);
});
it('requires staff eligibility for every selected service', async () => {
  m.services.mockResolvedValue([{ eligibleUserIds: ['other-stylist'] }]);
  const result = await getCustomerBookingAvailability('salon', 'branch', 60, undefined, '2099-01-02', { serviceIds: ['service'] });
  expect(result.every(s => !s.available)).toBe(true);
});
