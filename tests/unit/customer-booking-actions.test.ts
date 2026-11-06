import { beforeEach, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  feature: vi.fn(),
  user: { id: '11111111-1111-4111-8111-111111111111', displayName: 'Jane Doe', email: 'jane@example.com', mobileNumber: '+919876543210' },
  origin: vi.fn(),
  availability: vi.fn(),
  invalidate: vi.fn(),
  rateLimit: vi.fn(),
  salon: vi.fn(),
  branch: vi.fn(),
  service: vi.fn(),
  staff: vi.fn(),
  staffMany: vi.fn(),
  appointmentFind: vi.fn(),
  appointmentCreate: vi.fn(),
  appointmentUpdate: vi.fn(),
  salonCustomerFind: vi.fn(),
  salonCustomerCreate: vi.fn(),
  salonCustomerUpdate: vi.fn(),
  customerProfileUpsert: vi.fn(),
  audit: vi.fn(),
  feedbackFind: vi.fn(),
  feedbackCreate: vi.fn(),
  userUpdate: vi.fn(),
}));

vi.mock('@/lib/customer/queries', () => ({ getCustomerBookingAvailability: m.availability }));
vi.mock('@/lib/customer/cache', () => ({ invalidateCustomer: m.invalidate }));
vi.mock('@/lib/platform/features', () => ({ platformFeatureEnabled: m.feature }));
vi.mock('@/lib/authorization/server', () => ({
  requireCustomerUser: async () => m.user,
}));

vi.mock('@/lib/security', () => ({
  requireSameOrigin: m.origin,
  rateLimit: m.rateLimit,
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    $transaction: async (work: (tx: unknown) => unknown) =>
      work({
        $queryRaw: vi.fn().mockResolvedValue([]),
        salon: { findFirst: m.salon },
        branch: { findFirst: m.branch },
        service: { findMany: m.service },
        salonMembership: { findFirst: m.staff, findMany: m.staffMany },
        appointment: {
          findFirst: m.appointmentFind,
          create: m.appointmentCreate,
          update: m.appointmentUpdate,
        },
        salonCustomer: {
          findFirst: m.salonCustomerFind,
          create: m.salonCustomerCreate,
          update: m.salonCustomerUpdate,
        },
        customerProfile: { upsert: m.customerProfileUpsert },
        auditEvent: { create: m.audit },
        feedback: { findFirst: m.feedbackFind, create: m.feedbackCreate },
        user: { update: m.userUpdate },
      }),
  },
}));

import {
  bookCustomerAppointment,
  cancelCustomerAppointment,
  rescheduleCustomerAppointment,
  submitCustomerFeedback,
  updateCustomerProfile,
} from '@/server/customer-booking-actions';

const salonId = '22222222-2222-4222-8222-222222222222';
const branchId = '33333333-3333-4333-8333-333333333333';
const serviceId = '44444444-4444-4444-8444-444444444444';
const staffId = '55555555-5555-4555-8555-555555555555';
const appointmentId = '66666666-6666-4666-8666-666666666666';

function validBookForm() {
  const f = new FormData();
  f.set('salonId', salonId);
  f.set('branchId', branchId);
  f.set('serviceIds', serviceId);
  f.set('assignedUserId', staffId);
  const startsAt = new Date(Date.now() + 86400000); startsAt.setUTCSeconds(0, 0);
  f.set('startsAt', startsAt.toISOString());
  f.set('contactPhone', '+919876543210');
  f.set('notes', 'Fade cut');
  f.set('whatsappConsent', 'on');
  return f;
}

beforeEach(() => {
  m.feature.mockResolvedValue(true);
  m.availability.mockImplementation(async (_salon: string, _branch: string, _duration: number, _staff: string, date: string) => {
    const startsAt = new Date(Date.now() + 86400000);
    startsAt.setUTCSeconds(0, 0);
    return [{ isoString: startsAt.toISOString(), available: true, availableStaffIds: [staffId] }, { isoString: new Date(date + 'T11:00:00+05:30').toISOString(), available: true, availableStaffIds: [staffId] }];
  });
  m.origin.mockResolvedValue(undefined);
  m.rateLimit.mockResolvedValue(undefined);
  m.salon.mockResolvedValue({ id: salonId, name: 'Micasa Saloon' });
  m.branch.mockResolvedValue({ id: branchId, name: 'Main Branch' });
  m.service.mockResolvedValue([
    {
      id: serviceId,
      name: 'Signature Haircut',
      durationMinutes: 45,
      pricePaise: 65000,
      checklist: ['Wash', 'Cut'],
      commissionEligible: true,
      commissionBps: 1000,
    },
  ]);
  m.staff.mockResolvedValue({ userId: staffId });
  m.staffMany.mockResolvedValue([{ userId: staffId }]);
  m.appointmentFind.mockResolvedValue(null);
  m.appointmentCreate.mockResolvedValue({ id: appointmentId });
  m.appointmentUpdate.mockResolvedValue({ id: appointmentId });
  m.salonCustomerFind.mockResolvedValue(null);
  m.salonCustomerCreate.mockResolvedValue({ id: 'cust-1' });
  m.customerProfileUpsert.mockResolvedValue({});
  m.audit.mockResolvedValue({});
  m.feedbackFind.mockResolvedValue(null);
  m.feedbackCreate.mockResolvedValue({});
  m.userUpdate.mockResolvedValue({});
});

it('successfully books a customer appointment with server-side validation and audit log', async () => {
  const res = await bookCustomerAppointment({}, validBookForm());
  expect(res.error).toBeUndefined();
  expect(res.bookingReference).toMatch(/^SS-[A-Z0-9]{8}$/);
  expect(m.appointmentCreate).toHaveBeenCalledWith({
    data: expect.objectContaining({
      salonId,
      branchId,
      customerUserId: m.user.id,
      serviceName: 'Signature Haircut',
      durationMinutes: 45,
      pricePaise: 65000,
      status: 'confirmed',
    }),
  });
  expect(m.audit).toHaveBeenCalledWith({
    data: expect.objectContaining({
      action: 'appointment.customer_booked',
      targetType: 'Appointment',
      outcome: 'allowed',
    }),
  });
});

it('prevents double booking when a conflicting appointment exists', async () => {
  m.availability.mockResolvedValueOnce([]);

  const res = await bookCustomerAppointment({}, validBookForm());
  expect(res.error).toContain('no longer available');
  expect(m.appointmentCreate).not.toHaveBeenCalled();
});

it('rejects cross-origin mutations', async () => {
  m.origin.mockRejectedValueOnce(new Error('Cross origin denied'));
  const res = await bookCustomerAppointment({}, validBookForm());
  expect(res.error).toBeTruthy();
  expect(m.appointmentCreate).not.toHaveBeenCalled();
});

it('allows customer to cancel an upcoming confirmed appointment', async () => {
  m.appointmentFind.mockResolvedValueOnce({
    id: appointmentId,
    salonId,
    branchId,
    startsAt: new Date(Date.now() + 86400000),
    status: 'confirmed',
  });

  const f = new FormData();
  f.set('appointmentId', appointmentId);
  f.set('reason', 'Feeling sick');

  const res = await cancelCustomerAppointment({}, f);
  expect(res.error).toBeUndefined();
  expect(res.message).toContain('cancelled successfully');
  expect(m.appointmentUpdate).toHaveBeenCalledWith({
    where: { id: appointmentId },
    data: { status: 'cancelled' },
  });
  expect(m.audit).toHaveBeenCalledWith({
    data: expect.objectContaining({
      action: 'appointment.customer_cancelled',
      targetId: appointmentId,
    }),
  });
});

it('blocks cancelling an appointment that is already completed', async () => {
  m.appointmentFind.mockResolvedValueOnce({
    id: appointmentId,
    salonId,
    branchId,
    startsAt: new Date(Date.now() - 3600000),
    status: 'completed',
  });

  const f = new FormData();
  f.set('appointmentId', appointmentId);

  const res = await cancelCustomerAppointment({}, f);
  expect(res.error).toContain('already completed');
  expect(m.appointmentUpdate).not.toHaveBeenCalled();
});

it('allows customer to reschedule an upcoming appointment to a free slot', async () => {
  const newDate = new Date(Date.now() + 172800000); // 2 days in future
  m.availability.mockResolvedValueOnce([{ isoString: newDate.toISOString(), available: true, availableStaffIds: [staffId] }]);
  m.appointmentFind
    .mockResolvedValueOnce({
      id: appointmentId,
      salonId,
      branchId,
      assignedUserId: staffId,
      startsAt: new Date(Date.now() + 86400000),
      durationMinutes: 45,
      status: 'confirmed',
    });

  const f = new FormData();
  f.set('appointmentId', appointmentId);
  f.set('newStartsAt', newDate.toISOString());

  const res = await rescheduleCustomerAppointment({}, f);
  expect(res.error).toBeUndefined();
  expect(res.message).toContain('rescheduled');
  expect(m.appointmentUpdate).toHaveBeenCalledWith({
    where: { id: appointmentId },
    data: { startsAt: newDate },
  });
});

it('allows submitting feedback for completed appointments and rejects duplicates', async () => {
  m.appointmentFind.mockResolvedValueOnce({
    id: appointmentId,
    salonId,
  });

  const f = new FormData();
  f.set('appointmentId', appointmentId);
  f.set('rating', '5');
  f.set('comment', 'Amazing precision haircut!');

  const res = await submitCustomerFeedback({}, f);
  expect(res.error).toBeUndefined();
  expect(res.message).toContain('Thank you');
  expect(m.feedbackCreate).toHaveBeenCalledWith({
    data: expect.objectContaining({
      appointmentId,
      customerUserId: m.user.id,
      rating: 5,
      comment: 'Amazing precision haircut!',
    }),
  });

  // Duplicate check
  m.appointmentFind.mockResolvedValueOnce({ id: appointmentId, salonId });
  m.feedbackFind.mockResolvedValueOnce({ id: 'prev' });
  const dupRes = await submitCustomerFeedback({}, f);
  expect(dupRes.error).toContain('already submitted feedback');
});

it('updates customer profile name and phone', async () => {
  const f = new FormData();
  f.set('displayName', 'Jane Smith');
  f.set('phone', '+919999988888');

  const res = await updateCustomerProfile({}, f);
  expect(res.error).toBeUndefined();
  expect(res.message).toContain('updated');
  expect(m.userUpdate).toHaveBeenCalledWith({
    where: { id: m.user.id },
    data: { displayName: 'Jane Smith' },
  });
  expect(m.customerProfileUpsert).toHaveBeenCalledWith({
    where: { userId: m.user.id },
    create: { userId: m.user.id, phone: '+919999988888' },
    update: { phone: '+919999988888' },
  });
});

it('rejects booking without available staff and does not invalidate cached data', async () => {
  m.availability.mockResolvedValueOnce([]);
  const result = await bookCustomerAppointment({}, validBookForm());
  expect(result.error).toContain('no longer available');
  expect(m.appointmentCreate).not.toHaveBeenCalled();
  expect(m.invalidate).not.toHaveBeenCalled();
});
it('invalidates only the authenticated customer after a successful booking', async () => {
  await bookCustomerAppointment({}, validBookForm());
  expect(m.invalidate).toHaveBeenCalledWith(m.user.id);
});
it('enforces the platform online-booking rollout before creating a visit', async () => {
  m.feature.mockResolvedValueOnce(false);
  const result = await bookCustomerAppointment({}, validBookForm());
  expect(result.error).toContain('Online booking is currently unavailable');
  expect(m.appointmentCreate).not.toHaveBeenCalled(); expect(m.invalidate).not.toHaveBeenCalled();
});
