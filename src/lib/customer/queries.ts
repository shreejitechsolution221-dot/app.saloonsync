import 'server-only';
import { db } from '@/lib/db';
import { createHash } from 'node:crypto';
import { cached } from '@/server/cache';
import { settings } from '@/lib/salon/layout-data';
import type { Prisma } from '@/generated/prisma/client';
import type {
  CustomerSalonSummary,
  CustomerSalonDetail,
  CustomerBookingItem,
  TimeSlot,
  CustomerLoyaltyInfo,
  CustomerOfferItem,
} from './types';

async function loadCustomerDashboardData(userId?: string) {
  const [user, profile, appointments, salons, offers, salonCustomers] = await Promise.all([
    userId
      ? db.user.findUnique({
          where: { id: userId },
          select: { id: true, displayName: true, mobileNumber: true },
        })
      : Promise.resolve(null),
    userId
      ? db.customerProfile.findUnique({
          where: { userId },
          select: { phone: true },
        })
      : Promise.resolve(null),
    userId
      ? db.appointment.findMany({
          where: { customerUserId: userId },
          orderBy: { startsAt: 'desc' },
          include: {
            salon: { select: { id: true, name: true, slug: true } },
            branch: { select: { id: true, name: true, address: true, phone: true } },
            assignedMembership: {
              select: {
                user: { select: { displayName: true } },
              },
            },
          },
        })
      : Promise.resolve([]),
    db.salon.findMany({
      where: { status: 'active' },
      take: 4,
      include: {
        branches: { where: { status: 'active' }, select: { id: true, name: true, address: true, phone: true } },
        services: { where: { active: true }, select: { id: true, name: true, category: true, durationMinutes: true, pricePaise: true }, take: 6 },
      },
    }),
    loadActiveOffers(2),
    userId
      ? db.salonCustomer.findMany({
          where: { userId },
          select: { id: true, salonId: true },
        })
      : Promise.resolve([]),
  ]);

  const upcomingBooking = appointments
    .filter((a) => ['pending', 'confirmed', 'checked_in', 'in_service'].includes(a.status) && a.startsAt >= new Date(Date.now() - 4 * 3600000))
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())[0];

  const recentPastBookings = appointments
    .filter((a) => ['completed', 'confirmed'].includes(a.status) && a.startsAt < new Date() && a.id !== upcomingBooking?.id)
    .slice(0, 3);

  // Check loyalty points across salons
  const loyaltyAccounts = salonCustomers.length
    ? await db.loyaltyAccount.findMany({
        where: {
          customerId: { in: salonCustomers.map((c) => c.id) },
        },
      })
    : [];

  const salonMap = new Map(salons.map((s) => [s.id, s.name]));

  const ratings = await salonRatings(salons.map(s => s.id));
  const featuredSalons: CustomerSalonSummary[] = salons.map((s) => {
    const minPrice = s.services.length
      ? Math.min(...s.services.map((srv) => srv.pricePaise))
      : 35000;
    return {
      id: s.id,
      name: s.name,
      slug: s.slug,
      status: s.status,
      rating: ratings.get(s.id)?.rating ?? 0,
      reviewCount: ratings.get(s.id)?.count ?? 0,
      branches: s.branches,
      services: s.services,
      startingPricePaise: minPrice,
    };
  });

  return {
    user: {
      id: user?.id ?? userId,
      displayName: user?.displayName ?? 'Valued Guest',
      phone: profile?.phone || user?.mobileNumber || '',
    },
    upcomingBooking: upcomingBooking
      ? {
          id: upcomingBooking.id,
          startsAt: upcomingBooking.startsAt.toISOString(),
          status: upcomingBooking.status as CustomerBookingItem['status'],
          serviceName: upcomingBooking.serviceName,
          durationMinutes: upcomingBooking.durationMinutes,
          pricePaise: upcomingBooking.pricePaise,
          salon: upcomingBooking.salon,
          branch: upcomingBooking.branch,
          assignedStaff: upcomingBooking.assignedMembership?.user
            ? { id: upcomingBooking.assignedUserId ?? '', displayName: upcomingBooking.assignedMembership.user.displayName }
            : null,
        }
      : null,
    recentPastBookings: recentPastBookings.map((b) => ({
      id: b.id,
      startsAt: b.startsAt.toISOString(),
      status: b.status as CustomerBookingItem['status'],
      serviceName: b.serviceName,
      durationMinutes: b.durationMinutes,
      pricePaise: b.pricePaise,
      salon: b.salon,
      branch: b.branch,
      assignedStaff: b.assignedMembership?.user
        ? { id: b.assignedUserId ?? '', displayName: b.assignedMembership.user.displayName }
        : null,
    })),
    featuredSalons,
    loyaltyPoints: loyaltyAccounts.reduce((acc, curr) => acc + curr.points, 0),
    activeOffers: offers.map((o) => ({
      id: o.id,
      code: o.code,
      name: o.name,
      kind: o.kind as 'percentage' | 'fixed',
      value: o.value,
      expiresAt: o.expiresAt.toISOString(),
      salonName: salonMap.get(o.salonId) || 'Partner Salon',
    })),
  };
}

async function loadExploreSalonsData(filters?: {
  query?: string;
  category?: string;
  branchId?: string;
  sort?: string;
}) {
  const salons = await db.salon.findMany({
    where: {
      status: 'active',
      ...(filters?.query
        ? {
            OR: [
              { name: { contains: filters.query, mode: 'insensitive' } },
              { branches: { some: { name: { contains: filters.query, mode: 'insensitive' } } } },
              { services: { some: { name: { contains: filters.query, mode: 'insensitive' } } } },
            ],
          }
        : {}),
      ...(filters?.branchId ? { branches: { some: { id: filters.branchId } } } : {}),
      ...(filters?.category && filters.category !== 'All'
        ? { services: { some: { category: { equals: filters.category, mode: 'insensitive' }, active: true } } }
        : {}),
    },
    include: {
      branches: { where: { status: 'active' }, select: { id: true, name: true, address: true, phone: true } },
      services: {
        where: {
          active: true,
          ...(filters?.category && filters.category !== 'All'
            ? { category: { equals: filters.category, mode: 'insensitive' } }
            : {}),
        },
        select: { id: true, name: true, category: true, durationMinutes: true, pricePaise: true },
        take: 10,
      },
    },
  });

  const categories = [
    'All',
    'Hair',
    'Grooming',
    'Color',
    'Spa',
    'Facial',
  ];

  const ratings = await salonRatings(salons.map(s => s.id));
  let result: CustomerSalonSummary[] = salons.map((s) => {
    const minPrice = s.services.length
      ? Math.min(...s.services.map((srv) => srv.pricePaise))
      : 35000;
    return {
      id: s.id,
      name: s.name,
      slug: s.slug,
      status: s.status,
      rating: ratings.get(s.id)?.rating ?? 0,
      reviewCount: ratings.get(s.id)?.count ?? 0,
      branches: s.branches,
      services: s.services,
      startingPricePaise: minPrice,
    };
  });

  if (filters?.sort === 'price_low') {
    result.sort((a, b) => a.startingPricePaise - b.startingPricePaise);
  } else if (filters?.sort === 'rating') {
    result.sort((a, b) => b.rating - a.rating);
  }

  return {
    salons: result,
    categories,
    totalCount: result.length,
  };
}

async function loadSalonProfileData(salonSlugOrId: string): Promise<CustomerSalonDetail | null> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(salonSlugOrId);
  const salon = await db.salon.findFirst({
    where: isUuid ? { id: salonSlugOrId, status: 'active' } : { slug: salonSlugOrId, status: 'active' },
    include: {
      branches: { where: { status: 'active' }, select: { id: true, name: true, address: true, phone: true } },
      services: {
        where: { active: true },
        select: {
          id: true,
          name: true,
          category: true,
          durationMinutes: true,
          pricePaise: true,
          kind: true,
          checklist: true,
          eligibleUserIds: true,
        },
        orderBy: [{ category: 'asc' }, { pricePaise: 'asc' }],
      },
      memberships: {
        where: { status: 'active', role: { in: ['owner', 'admin', 'manager', 'staff'] }, user: { disabledAt: null } },
        include: {
          user: { select: { displayName: true } },
        },
      },
    },
  });

  if (!salon) return null;
  const ratings = await salonRatings([salon.id]);

  return {
    id: salon.id,
    name: salon.name,
    slug: salon.slug,
    status: salon.status,
    rating: ratings.get(salon.id)?.rating ?? 0,
    reviewCount: ratings.get(salon.id)?.count ?? 0,
    branches: salon.branches,
    services: salon.services,
    openingHour: settings(salon.settings).openingHour,
    closingHour: settings(salon.settings).closingHour,
    staff: salon.memberships.map((m) => ({
      id: m.id,
      userId: m.userId,
      displayName: m.user.displayName,
      role: m.role,
    })),
  };
}

async function loadCustomerBookings(userId: string) {
  const appointments = await db.appointment.findMany({
    where: { customerUserId: userId },
    orderBy: { startsAt: 'desc' },
    include: {
      salon: { select: { id: true, name: true, slug: true } },
      branch: { select: { id: true, name: true, address: true, phone: true } },
      assignedMembership: {
        select: {
          user: { select: { displayName: true } },
        },
      },
    },
  });

  const feedbackRows = await db.feedback.findMany({
    where: { customerUserId: userId },
    select: { appointmentId: true, rating: true, comment: true },
  });
  const feedbackMap = new Map(feedbackRows.map((f) => [f.appointmentId, { rating: f.rating, comment: f.comment }]));

  const mapped: CustomerBookingItem[] = appointments.map((a) => ({
    id: a.id,
    startsAt: a.startsAt.toISOString(),
    status: a.status as CustomerBookingItem['status'],
    serviceName: a.serviceName,
    durationMinutes: a.durationMinutes,
    pricePaise: a.pricePaise,
    recurrenceKey: a.recurrenceKey,
    salon: a.salon,
    branch: a.branch,
    assignedStaff: a.assignedMembership?.user
      ? { id: a.assignedUserId ?? '', displayName: a.assignedMembership.user.displayName }
      : null,
    feedback: feedbackMap.get(a.id) ?? null,
  }));

  const upcoming = mapped.filter((a) =>
    ['pending', 'confirmed', 'checked_in', 'in_service'].includes(a.status),
  ).sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  const past = mapped.filter((a) =>
    ['completed', 'cancelled', 'no_show'].includes(a.status),
  );

  return { upcoming, past };
}

export async function getCustomerBookingAvailability(
  salonId: string,
  branchId: string,
  serviceDurationMinutes: number,
  selectedStaffUserId?: string,
  targetDateStr?: string, // "YYYY-MM-DD"
  options: { client?: Prisma.TransactionClient; serviceIds?: string[]; excludeAppointmentId?: string } = {},
): Promise<TimeSlot[]> {
  const client = options.client ?? db;
  const dateStr = targetDateStr || new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
  const day = new Date(dateStr + 'T00:00:00+05:30');
  if (!Number.isFinite(day.getTime()) || new Date(day.getTime() + 330 * 60000).toISOString().slice(0, 10) !== dateStr || !Number.isInteger(serviceDurationMinutes) || serviceDurationMinutes < 5 || serviceDurationMinutes > 480) return [];
  const branch = await client.branch.findFirst({ where: { id: branchId, salonId, status: 'active', salon: { status: 'active' } }, select: { id: true, salon: { select: { settings: true } } } });
  if (!branch) return [];
  const rules = settings(branch.salon.settings);
  const { openingHour, closingHour } = rules;
  const services = options.serviceIds?.length ? await client.service.findMany({ where: { id: { in: options.serviceIds }, salonId, active: true }, select: { eligibleUserIds: true } }) : [];
  if (options.serviceIds?.length && services.length !== options.serviceIds.length) return [];
  const slotStepMinutes = 30;

  // Find active staff for this branch and salon
  const staffMemberships = await client.salonMembership.findMany({
    where: {
      salonId,
      status: 'active',
      role: { in: ['owner', 'admin', 'manager', 'staff'] },
      user: { disabledAt: null },
      ...(selectedStaffUserId ? { userId: selectedStaffUserId } : {}),
      OR: [
        { branchScope: 'all' },
        { branches: { some: { branchId } } },
      ],
    },
    select: { userId: true },
  });

  const eligibleUserIds = staffMemberships.map((s) => s.userId).filter(id => services.every(s => !s.eligibleUserIds.length || s.eligibleUserIds.includes(id)));

  // Day window in IST (+05:30)
  const dayStartUtc = new Date(`${dateStr}T00:00:00+05:30`);
  const dayEndUtc = new Date(`${dateStr}T23:59:59+05:30`);

  // Check every branch where these stylists work, including visits crossing midnight.
  const dayAppointments = await client.appointment.findMany({
    where: {
      salonId,
      assignedUserId: { in: eligibleUserIds },
      ...(options.excludeAppointmentId ? { id: { not: options.excludeAppointmentId } } : {}),
      status: { notIn: ['cancelled', 'no_show'] },
      startsAt: { gte: new Date(dayStartUtc.getTime() - 480 * 60000), lte: dayEndUtc },
    },
    select: {
      id: true,
      startsAt: true,
      durationMinutes: true,
      assignedUserId: true,
    },
  });

  // Fetch staff approved leave on this day
  const leaves = await client.leaveRequest.findMany({
    where: {
      salonId,
      status: 'approved',
      userId: { in: eligibleUserIds },
      startsAt: { lte: dayEndUtc },
      endsAt: { gte: dayStartUtc },
    },
    select: { userId: true, startsAt: true, endsAt: true },
  });

  const shifts = rules.requireShift ? await client.shift.findMany({ where: { salonId, branchId, userId: { in: eligibleUserIds }, cancelledAt: null, startsAt: { lte: dayEndUtc }, endsAt: { gte: dayStartUtc } }, select: { userId: true, startsAt: true, endsAt: true } }) : [];
  const slots: TimeSlot[] = [];
  const now = new Date();

  // Generate slots from openingHour to closingHour
  for (let hour = openingHour; hour < closingHour; hour++) {
    for (let minute = 0; minute < 60; minute += slotStepMinutes) {
      const minutePad = minute < 10 ? `0${minute}` : `${minute}`;
      const hourPad = hour < 10 ? `0${hour}` : `${hour}`;
      const slotLocalStr = `${dateStr}T${hourPad}:${minutePad}:00+05:30`;
      const slotStartTime = new Date(slotLocalStr);
      const slotEndTime = new Date(slotStartTime.getTime() + serviceDurationMinutes * 60000);

      // Check if slot end exceeds closing time
      const closingTimeUtc = new Date(`${dateStr}T${closingHour}:00:00+05:30`);
      if (slotEndTime > closingTimeUtc) {
        continue;
      }

      // Past time slots are unavailable
      if (slotStartTime <= new Date(now.getTime() + 15 * 60000)) {
        continue;
      }

      // Determine available staff for this slot
      const availableStaff = eligibleUserIds.filter((staffId) => {
        if (rules.requireShift && !shifts.some(s => s.userId === staffId && s.startsAt <= slotStartTime && s.endsAt >= slotEndTime)) return false;
        // Check leave
        const onLeave = leaves.some(
          (l) => l.userId === staffId && l.startsAt < slotEndTime && l.endsAt > slotStartTime,
        );
        if (onLeave) return false;

        // Check appointment conflicts
        const hasConflict = dayAppointments.some((appt) => {
          if (appt.assignedUserId && appt.assignedUserId !== staffId) return false;
          const apptStart = appt.startsAt;
          const apptEnd = new Date(apptStart.getTime() + appt.durationMinutes * 60000);
          return apptStart < slotEndTime && apptEnd > slotStartTime;
        });

        return !hasConflict;
      });

      const isAvailable = availableStaff.length > 0;
      const hour12 = hour % 12 === 0 ? 12 : hour % 12;
      const ampm = hour < 12 ? 'AM' : 'PM';
      const timeStr = `${hour12}:${minutePad} ${ampm}`;

      slots.push({
        timeStr,
        isoString: slotStartTime.toISOString(),
        available: isAvailable,
        reason: isAvailable ? undefined : 'Fully booked',
        availableStaffIds: availableStaff,
      });
    }
  }

  return slots;
}

async function loadCustomerLoyaltyOffers(userId?: string) {
  const salonCustomers = userId
    ? await db.salonCustomer.findMany({
        where: { userId },
        select: { id: true, salonId: true },
      })
    : [];

  const [loyaltyAccounts, offers, salons] = await Promise.all([
    salonCustomers.length
      ? db.loyaltyAccount.findMany({
          where: { customerId: { in: salonCustomers.map((c) => c.id) } },
        })
      : Promise.resolve([]),
    loadActiveOffers(),
    db.salon.findMany({
      where: { status: 'active' },
      select: { id: true, name: true },
    }),
  ]);

  const salonMap = new Map(salons.map((s) => [s.id, s.name]));

  const loyaltySummary: CustomerLoyaltyInfo[] = loyaltyAccounts.map((l) => ({
    points: l.points,
    membershipName: l.membershipName || 'SaloonSync Club Member',
    referralCode: l.referralCode,
    salonName: salonMap.get(l.salonId) || 'Partner Salon',
  }));

  const activeOffers: CustomerOfferItem[] = offers.map((o) => ({
    id: o.id,
    code: o.code,
    name: o.name,
    kind: o.kind as 'percentage' | 'fixed',
    value: o.value,
    expiresAt: o.expiresAt.toISOString(),
    salonName: salonMap.get(o.salonId) || 'Partner Salon',
  }));

  return { loyaltySummary, activeOffers };
}

// Serialized DTOs only; private entries always include the customer ID.
export function getCustomerDashboardData(userId?: string) { return cached(`customer:v1:${userId ?? "guest"}:dashboard`, 15, () => loadCustomerDashboardData(userId)); }
export function getExploreSalonsData(filters?: Parameters<typeof loadExploreSalonsData>[0]) { const hash = createHash("sha256").update(JSON.stringify(filters ?? {})).digest("hex"); return cached(`customer:v1:explore:${hash}`, 30, () => loadExploreSalonsData(filters)); }
export function getSalonProfileData(salonSlugOrId: string) { return cached(`customer:v1:salon:${salonSlugOrId}`, 30, () => loadSalonProfileData(salonSlugOrId)); }
export function getCustomerBookings(userId: string) { return cached(`customer:v1:${userId}:bookings`, 15, () => loadCustomerBookings(userId)); }
export function getCustomerLoyaltyOffers(userId?: string) { return cached(`customer:v1:${userId ?? "guest"}:offers`, 15, () => loadCustomerLoyaltyOffers(userId)); }

async function salonRatings(salonIds: string[]) {
  if (!salonIds.length) return new Map<string, { rating: number; count: number }>();
  const rows = await db.feedback.groupBy({ by: ['salonId'], where: { salonId: { in: salonIds } }, _avg: { rating: true }, _count: { rating: true } });
  return new Map(rows.map(row => [row.salonId, { rating: Math.round((row._avg.rating ?? 0) * 10) / 10, count: row._count.rating }]));
}

async function loadActiveOffers(take?: number) {
  const salons = await db.salon.findMany({ where: { status: 'active' }, select: { id: true } });
  return db.offer.findMany({ where: { active: true, salonId: { in: salons.map(s => s.id) }, expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' }, ...(take ? { take } : {}) });
}
