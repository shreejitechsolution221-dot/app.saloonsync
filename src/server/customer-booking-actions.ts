'use server';

import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { getCustomerBookingAvailability } from '@/lib/customer/queries';
import { invalidateCustomer } from '@/lib/customer/cache';
import { requireCustomerUser } from '@/lib/authorization/server';
import { requireSameOrigin, rateLimit } from '@/lib/security';
import { DomainError } from '@/lib/operations/errors';
import { saveError } from '@/lib/operations/save-error';
import type { FormState } from './auth-actions';
import { platformFeatureEnabled } from '@/lib/platform/features';

const bookInput = z.object({
  salonId: z.string().uuid(),
  branchId: z.string().uuid(),
  serviceIds: z.array(z.string().uuid()).min(1).max(10),
  assignedUserId: z.string().uuid().optional().or(z.literal('')),
  startsAt: z.string().datetime({ offset: true }),
  notes: z.string().max(500).optional(),
  contactPhone: z.string().max(30).optional(),
  whatsappConsent: z.boolean().optional(),
});

export async function bookCustomerAppointment(_: FormState, formData: FormData): Promise<FormState & { bookingReference?: string }> {
  try {
    await requireSameOrigin();
    const user = await requireCustomerUser();
    await rateLimit('customer-booking', user.id, 20);

    const rawServiceIds = formData.getAll('serviceIds').map(String);
    const parsed = bookInput.parse({
      salonId: formData.get('salonId'),
      branchId: formData.get('branchId'),
      serviceIds: rawServiceIds.length > 0 ? rawServiceIds : [formData.get('serviceId')].filter(Boolean),
      assignedUserId: formData.get('assignedUserId') || undefined,
      startsAt: formData.get('startsAt'),
      notes: formData.get('notes') ? String(formData.get('notes')) : undefined,
      contactPhone: formData.get('contactPhone') ? String(formData.get('contactPhone')) : undefined,
      whatsappConsent: formData.get('whatsappConsent') === 'on' || formData.get('whatsappConsent') === 'true',
    });

    const startsAt = new Date(parsed.startsAt);
    if (startsAt.getTime() <= Date.now() + 15 * 60000) {
      throw new DomainError('Please choose a time slot in the future.');
    }

    let bookingRef = '';

    await db.$transaction(async (tx) => {
      if (!await platformFeatureEnabled(parsed.salonId, 'online_booking', tx)) throw new DomainError('Online booking is currently unavailable for this salon. Please contact the salon.');
      // 1. Verify Salon & Branch
      const [salon, branch] = await Promise.all([
        tx.salon.findFirst({ where: { id: parsed.salonId, status: 'active' }, select: { id: true, name: true } }),
        tx.branch.findFirst({ where: { id: parsed.branchId, salonId: parsed.salonId, status: 'active' }, select: { id: true, name: true } }),
      ]);
      if (!salon || !branch) throw new DomainError('Selected salon or branch is currently unavailable.');

      // 2. Fetch Services & Calculate Totals
      const services = await tx.service.findMany({
        where: { id: { in: parsed.serviceIds }, salonId: parsed.salonId, active: true },
        select: { id: true, name: true, durationMinutes: true, pricePaise: true, commissionEligible: true, commissionBps: true, checklist: true },
      });
      if (services.length !== parsed.serviceIds.length) {
        throw new DomainError('One or more selected services are no longer available.');
      }

      const totalDuration = services.reduce((acc, s) => acc + s.durationMinutes, 0);
      const totalPricePaise = services.reduce((acc, s) => acc + s.pricePaise, 0);
      const combinedServiceNames = services.map((s) => s.name).join(' + ');

      // Final validation uses live transactional data, never cached availability.
      const date = new Date(startsAt.getTime() + 330 * 60000).toISOString().slice(0, 10);
      const slots = await getCustomerBookingAvailability(parsed.salonId, parsed.branchId, totalDuration, parsed.assignedUserId || undefined, date, { client: tx, serviceIds: parsed.serviceIds });
      const slot = slots.find(s => s.isoString === startsAt.toISOString() && s.available);
      const assignedStaffId = slot?.availableStaffIds?.[0];
      if (!assignedStaffId) throw new DomainError('This time slot is no longer available. Please select another slot.');
      // The database overlap trigger serializes concurrent writes for this stylist.

      // 5. Upsert or Link SalonCustomer
      let salonCustomer = await tx.salonCustomer.findFirst({
        where: { salonId: parsed.salonId, userId: user.id },
      });

      if (!salonCustomer) {
        salonCustomer = await tx.salonCustomer.create({
          data: {
            salonId: parsed.salonId,
            userId: user.id,
            displayName: user.displayName,
            phone: parsed.contactPhone || user.mobileNumber || '',
            originBranchId: parsed.branchId,
            notes: parsed.notes || null,
            whatsappConsentAt: parsed.whatsappConsent ? new Date() : null,
          },
        });
      } else {
        await tx.salonCustomer.update({
          where: { id: salonCustomer.id },
          data: {
            ...(parsed.contactPhone ? { phone: parsed.contactPhone } : {}),
            ...(parsed.notes ? { notes: parsed.notes } : {}),
            ...(parsed.whatsappConsent ? { whatsappConsentAt: new Date() } : {}),
          },
        });
      }

      // Also update customer profile phone if provided
      if (parsed.contactPhone) {
        await tx.customerProfile.upsert({
          where: { userId: user.id },
          create: { userId: user.id, phone: parsed.contactPhone },
          update: { phone: parsed.contactPhone },
        });
      }

      // 6. Create the Appointment
      const appointmentId = randomUUID();
      bookingRef = `SS-${appointmentId.slice(0, 8).toUpperCase()}`;

      await tx.appointment.create({
        data: {
          id: appointmentId,
          salonId: parsed.salonId,
          branchId: parsed.branchId,
          customerUserId: user.id,
          salonCustomerId: salonCustomer.id,
          assignedUserId: assignedStaffId,
          serviceName: combinedServiceNames,
          durationMinutes: totalDuration,
          pricePaise: totalPricePaise,
          startsAt,
          status: 'confirmed',
          recurrenceKey: bookingRef,
          checklist: services.flatMap((s) => s.checklist),
        },
      });

      // 7. Audit Logging
      await tx.auditEvent.create({
        data: {
          salonId: parsed.salonId,
          branchId: parsed.branchId,
          actorUserId: user.id,
          action: 'appointment.customer_booked',
          targetType: 'Appointment',
          targetId: appointmentId,
          outcome: 'allowed',
          metadata: {
            bookingReference: bookingRef,
            serviceCount: services.length,
            totalPricePaise,
            totalDuration,
          },
        },
      });
    }, { timeout: 15000 });

    await invalidateCustomer(user.id);
    revalidatePath('/customer', 'layout');
    revalidatePath('/customer/bookings');
    return {
      message: `Your appointment is confirmed! Reference: ${bookingRef}`,
      bookingReference: bookingRef,
    };
  } catch (error) {
    return { error: saveError(error, 'customer.book') };
  }
}

export async function cancelCustomerAppointment(_: FormState, formData: FormData): Promise<FormState> {
  try {
    await requireSameOrigin();
    const user = await requireCustomerUser();
    await rateLimit('customer-cancel', user.id, 20);

    const appointmentId = z.string().uuid().parse(formData.get('appointmentId'));
    const reason = z.string().max(200).optional().parse(formData.get('reason') || undefined);

    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM app."Appointment" WHERE id=${appointmentId}::uuid AND "customerUserId"=${user.id}::uuid FOR UPDATE`;
      const appt = await tx.appointment.findFirst({
        where: { id: appointmentId, customerUserId: user.id },
        select: { id: true, salonId: true, branchId: true, startsAt: true, status: true },
      });

      if (!appt) throw new DomainError('Booking not found or already cancelled.');
      if (!['pending', 'confirmed'].includes(appt.status)) {
        throw new DomainError(`Cannot cancel an appointment that is already ${appt.status.replace('_', ' ')}.`);
      }

      if (appt.startsAt <= new Date()) throw new DomainError('Only upcoming appointments can be changed.');
      await tx.appointment.update({
        where: { id: appointmentId },
        data: { status: 'cancelled' },
      });

      await tx.auditEvent.create({
        data: {
          salonId: appt.salonId,
          branchId: appt.branchId,
          actorUserId: user.id,
          action: 'appointment.customer_cancelled',
          targetType: 'Appointment',
          targetId: appointmentId,
          outcome: 'allowed',
          metadata: { reason: reason || 'Customer self-cancellation' },
        },
      });
    });

    await invalidateCustomer(user.id);
    revalidatePath('/customer', 'layout');
    revalidatePath('/customer/bookings');
    return { message: 'Your appointment has been cancelled successfully.' };
  } catch (error) {
    return { error: saveError(error, 'customer.cancel') };
  }
}

export async function rescheduleCustomerAppointment(_: FormState, formData: FormData): Promise<FormState> {
  try {
    await requireSameOrigin();
    const user = await requireCustomerUser();
    await rateLimit('customer-reschedule', user.id, 20);

    const appointmentId = z.string().uuid().parse(formData.get('appointmentId'));
    const newStartsAtStr = z.string().datetime({ offset: true }).parse(formData.get('newStartsAt'));
    const newStartsAt = new Date(newStartsAtStr);

    if (newStartsAt.getTime() <= Date.now() + 15 * 60000) {
      throw new DomainError('Please choose a new time slot in the future.');
    }

    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM app."Appointment" WHERE id=${appointmentId}::uuid AND "customerUserId"=${user.id}::uuid FOR UPDATE`;
      const appt = await tx.appointment.findFirst({
        where: { id: appointmentId, customerUserId: user.id },
        select: { id: true, salonId: true, branchId: true, assignedUserId: true, startsAt: true, durationMinutes: true, status: true },
      });

      if (!appt) throw new DomainError('Booking not found.');
      if (!['pending', 'confirmed'].includes(appt.status)) {
        throw new DomainError(`Cannot reschedule an appointment that is already ${appt.status.replace('_', ' ')}.`);
      }

      if (appt.startsAt <= new Date()) throw new DomainError('Only upcoming appointments can be changed.');
      const date = new Date(newStartsAt.getTime() + 330 * 60000).toISOString().slice(0, 10);
      const slots = await getCustomerBookingAvailability(appt.salonId, appt.branchId, appt.durationMinutes, appt.assignedUserId ?? undefined, date, { client: tx, excludeAppointmentId: appointmentId });
      const slot = slots.find(s => s.isoString === newStartsAt.toISOString() && s.available);
      if (!slot || !appt.assignedUserId) throw new DomainError('The selected time slot is no longer available.');

      await tx.appointment.update({
        where: { id: appointmentId },
        data: { startsAt: newStartsAt },
      });

      await tx.auditEvent.create({
        data: {
          salonId: appt.salonId,
          branchId: appt.branchId,
          actorUserId: user.id,
          action: 'appointment.customer_rescheduled',
          targetType: 'Appointment',
          targetId: appointmentId,
          outcome: 'allowed',
          metadata: { newStartsAt: newStartsAt.toISOString() },
        },
      });
    });

    await invalidateCustomer(user.id);
    revalidatePath('/customer', 'layout');
    revalidatePath('/customer/bookings');
    return { message: 'Your appointment has been rescheduled.' };
  } catch (error) {
    return { error: saveError(error, 'customer.reschedule') };
  }
}

export async function submitCustomerFeedback(_: FormState, formData: FormData): Promise<FormState> {
  try {
    await requireSameOrigin();
    const user = await requireCustomerUser();
    await rateLimit('customer-feedback', user.id, 20);

    const appointmentId = z.string().uuid().parse(formData.get('appointmentId'));
    const rating = z.coerce.number().int().min(1).max(5).parse(formData.get('rating'));
    const comment = z.string().trim().max(1000).parse(formData.get('comment') || '');

    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM app."Appointment" WHERE id=${appointmentId}::uuid AND "customerUserId"=${user.id}::uuid FOR UPDATE`;
      const appt = await tx.appointment.findFirst({
        where: { id: appointmentId, customerUserId: user.id, status: 'completed' },
        select: { id: true, salonId: true },
      });
      if (!appt) throw new DomainError('Feedback is only available for your completed appointments.');

      const existing = await tx.feedback.findFirst({ where: { appointmentId } });
      if (existing) throw new DomainError('You have already submitted feedback for this visit.');

      await tx.feedback.create({
        data: {
          salonId: appt.salonId,
          appointmentId: appt.id,
          customerUserId: user.id,
          rating,
          comment: comment || '',
        },
      });

      await tx.auditEvent.create({
        data: {
          salonId: appt.salonId,
          actorUserId: user.id,
          action: 'feedback.submitted',
          targetType: 'Appointment',
          targetId: appt.id,
          outcome: 'allowed',
          metadata: { rating },
        },
      });
    });

    await invalidateCustomer(user.id);
    revalidatePath('/customer', 'layout');
    revalidatePath('/customer/bookings');
    return { message: 'Thank you for your feedback!' };
  } catch (error) {
    return { error: saveError(error, 'customer.feedback') };
  }
}

export async function updateCustomerProfile(_: FormState, formData: FormData): Promise<FormState> {
  try {
    await requireSameOrigin();
    const user = await requireCustomerUser();
    await rateLimit('customer-profile', user.id, 30);

    const displayName = z.string().trim().min(2).max(120).parse(formData.get('displayName'));
    const phone = z.string().trim().max(30).optional().parse(formData.get('phone') || undefined);

    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { displayName },
      });

      await tx.customerProfile.upsert({
        where: { userId: user.id },
        create: { userId: user.id, phone: phone || null },
        update: { phone: phone || null },
      });
    });

    await invalidateCustomer(user.id);
    revalidatePath('/customer', 'layout');
    revalidatePath('/customer/profile');
    return { message: 'Your profile has been updated.' };
  } catch (error) {
    return { error: saveError(error, 'customer.profile') };
  }
}
