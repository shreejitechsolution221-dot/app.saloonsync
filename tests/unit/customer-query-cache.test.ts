import { beforeEach, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), del: vi.fn(), appointments: vi.fn(), feedback: vi.fn() }));
vi.mock('@/server/redis', () => ({ redis: { get: m.get, set: m.set, del: m.del } }));
vi.mock('@/lib/db', () => ({ db: { appointment: { findMany: m.appointments }, feedback: { findMany: m.feedback } } }));
import { getCustomerBookings } from '@/lib/customer/queries';
import { invalidateCustomer } from '@/lib/customer/cache';

beforeEach(() => {
  m.get.mockResolvedValue(null);
  m.set.mockResolvedValue('OK');
  m.del.mockResolvedValue(1);
  m.feedback.mockResolvedValue([]);
  m.appointments.mockResolvedValue([{ id: 'visit', startsAt: new Date('2099-01-02T04:30:00Z'), status: 'confirmed', serviceName: 'Cut', durationMinutes: 30, pricePaise: 10000, salon: { id: 'salon' }, branch: { id: 'branch' }, assignedMembership: null }]);
});

it('caches serialized bookings with an isolated key for each customer', async () => {
  const fresh = await getCustomerBookings('customer-a');
  const payload = JSON.parse(JSON.stringify(fresh));
  expect(m.set).toHaveBeenCalledWith('customer:v1:customer-a:bookings', payload, { ex: 15 });
  m.get.mockResolvedValueOnce(payload);
  expect(await getCustomerBookings('customer-a')).toEqual(fresh);
  expect(m.appointments).toHaveBeenCalledOnce();
  await getCustomerBookings('customer-b');
  expect(m.get).toHaveBeenLastCalledWith('customer:v1:customer-b:bookings');
  expect(m.appointments).toHaveBeenLastCalledWith(expect.objectContaining({ where: { customerUserId: 'customer-b' } }));
});

it('invalidates private DTOs only for the changed customer', async () => {
  await invalidateCustomer('customer-a');
  expect(m.del).toHaveBeenCalledWith('customer:v1:customer-a:dashboard', 'customer:v1:customer-a:bookings', 'customer:v1:customer-a:offers');
});
