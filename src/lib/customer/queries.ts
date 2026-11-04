import 'server-only';
import { db } from '@/lib/db';
import type {
  CustomerSalonSummary,
  CustomerSalonDetail,
  CustomerBookingItem,
  TimeSlot,
  CustomerLoyaltyInfo,
  CustomerOfferItem,
} from './types';

export async function getCustomerDashboardData(userId?: string) {
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
          take: 10,
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
    db.offer.findMany({
      where: { active: true, expiresAt: { gt: new Date() } },
      take: 2,
    }),
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
    .filter((a) => ['completed', 'confirmed'].includes(a.status) && a.id !== upcomingBooking?.id)
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

  const featuredSalons: CustomerSalonSummary[] = salons.map((s) => {
    const minPrice = s.services.length
      ? Math.min(...s.services.map((srv) => srv.pricePaise))
      : 35000;
    return {
      id: s.id,
      name: s.name,
      slug: s.slug,
      status: s.status,
      rating: 4.9,
      reviewCount: 38,
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

export async function getExploreSalonsData(filters?: {
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

  let result: CustomerSalonSummary[] = salons.map((s) => {
    const minPrice = s.services.length
      ? Math.min(...s.services.map((srv) => srv.pricePaise))
      : 35000;
    return {
      id: s.id,
      name: s.name,
      slug: s.slug,
      status: s.status,
      rating: 4.9,
      reviewCount: 38,
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

export async function getSalonProfileData(salonSlugOrId: string): Promise<CustomerSalonDetail | null> {
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
        where: { status: 'active' },
        include: {
          user: { select: { displayName: true } },
        },
      },
    },
  });

  if (!salon) return null;

  return {
    id: salon.id,
    name: salon.name,
    slug: salon.slug,
    status: salon.status,
    rating: 4.9,
    reviewCount: 42,
    branches: salon.branches,
    services: salon.services,
    staff: salon.memberships.map((m) => ({
      id: m.id,
      userId: m.userId,
      displayName: m.user.displayName,
      role: m.role,
    })),
  };
}

export async function getCustomerBookings(userId: string) {
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
): Promise<TimeSlot[]> {
  const dateStr = targetDateStr || new Date().toISOString().split('T')[0];
  const openingHour = 9; // 9:00 AM IST
  const closingHour = 20; // 8:00 PM IST
  const slotStepMinutes = 30;

  // Find active staff for this branch and salon
  const staffMemberships = await db.salonMembership.findMany({
    where: {
      salonId,
      status: 'active',
      ...(selectedStaffUserId ? { userId: selectedStaffUserId } : {}),
      OR: [
        { branchScope: 'all' },
        { branches: { some: { branchId } } },
      ],
    },
    select: { userId: true },
  });

  const eligibleUserIds = staffMemberships.map((s) => s.userId);

  // Day window in IST (+05:30)
  const dayStartUtc = new Date(`${dateStr}T00:00:00+05:30`);
  const dayEndUtc = new Date(`${dateStr}T23:59:59+05:30`);

  // Fetch appointments for this branch on this day to detect overlaps
  const dayAppointments = await db.appointment.findMany({
    where: {
      salonId,
      branchId,
      status: { notIn: ['cancelled', 'no_show'] },
      startsAt: { gte: dayStartUtc, lte: dayEndUtc },
    },
    select: {
      id: true,
      startsAt: true,
      durationMinutes: true,
      assignedUserId: true,
    },
  });

  // Fetch staff approved leave on this day
  const leaves = await db.leaveRequest.findMany({
    where: {
      salonId,
      status: 'approved',
      userId: { in: eligibleUserIds },
      startsAt: { lte: dayEndUtc },
      endsAt: { gte: dayStartUtc },
    },
    select: { userId: true, startsAt: true, endsAt: true },
  });

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

export async function getCustomerLoyaltyOffers(userId?: string) {
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
    db.offer.findMany({
      where: { active: true, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    }),
    db.salon.findMany({
      where: { status: 'active' },
      select: { id: true, name: true },
    }),
  ]);

  const salonMap = new Map(salons.map((s) => [s.id, s.name]));

  const loyaltySummary: CustomerLoyaltyInfo[] = loyaltyAccounts.map((l) => ({
    points: l.points,
    membershipName: l.membershipName || 'GlowDesk Club Member',
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
