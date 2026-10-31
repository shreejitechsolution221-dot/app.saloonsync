import 'server-only';
import { cache } from 'react';
import { z } from 'zod';
import { db } from '@/lib/db';
import { cached, invalidate } from '@/server/cache';

export const settingsSchema = z
  .object({
    taxBps: z.number().int().min(0).max(3000).default(0),
    discountLimitBps: z.number().int().min(0).max(10000).default(0),
    noShowLimit: z.number().int().min(0).max(20).default(0),
    rebookingDays: z.number().int().min(1).max(365).default(42),
    retentionDays: z.number().int().min(7).max(365).default(90),
    automaticStockUsage: z.boolean().default(false),
    automatedMessages: z.boolean().default(false),
    requireShift: z.boolean().default(false),
    openingHour: z.number().int().min(0).max(23).default(9),
    closingHour: z.number().int().min(1).max(24).default(21),
  })
  .refine((v) => v.openingHour < v.closingHour);

export function settings(value: unknown) {
  return settingsSchema.parse(value ?? {});
}

export type CompactSalonSettings = z.infer<typeof settingsSchema>;

export type CompactService = {
  id: string;
  name: string;
  category: string;
  durationMinutes: number;
  pricePaise: number;
  active: boolean;
  kind: string;
};

export type CompactStaff = {
  id: string;
  userId: string | null;
  role: string;
  displayName: string;
};

export type CompactPlan = {
  planCode: string;
  status: string;
  currentPeriodEnd: string | null;
} | null;

export type SalonPermissions = {
  roles: Record<string, readonly string[]>;
};

export type SalonLayoutData = {
  salonId: string;
  salonName: string;
  settings: CompactSalonSettings;
  services: CompactService[];
  staff: CompactStaff[];
  plan: CompactPlan;
  permissions: SalonPermissions;
};

export function assertTenantIsolation(activeSalonId: string, requestedSalonId: string): void {
  if (!activeSalonId || !requestedSalonId || activeSalonId !== requestedSalonId) {
    throw new Error('Tenant isolation violation: requested salon does not match active session.');
  }
}

async function loadSalonLayoutDataFromDb(salonId: string): Promise<SalonLayoutData> {
  const salonPromise = db.salon?.findUnique
    ? db.salon.findUnique({
        where: { id: salonId },
        select: { name: true, settings: true },
      })
    : db.salon?.findUniqueOrThrow
      ? db.salon.findUniqueOrThrow({
          where: { id: salonId },
          select: { name: true, settings: true },
        })
      : Promise.resolve({ name: 'Salon', settings: {} });

  const servicesPromise = db.service?.findMany
    ? db.service.findMany({
        where: { salonId, active: true },
        select: {
          id: true,
          name: true,
          category: true,
          durationMinutes: true,
          pricePaise: true,
          active: true,
          kind: true,
        },
        orderBy: { name: 'asc' },
        take: 100,
      })
    : Promise.resolve([]);

  const staffPromise = db.salonMembership?.findMany
    ? db.salonMembership.findMany({
        where: { salonId, status: 'active', user: { disabledAt: null } },
        select: {
          id: true,
          userId: true,
          role: true,
          user: { select: { displayName: true } },
        },
        orderBy: { createdAt: 'asc' },
        take: 100,
      })
    : Promise.resolve([]);

  const subscriptionPromise = db.salonSubscription?.findUnique
    ? db.salonSubscription.findUnique({
        where: { salonId },
        select: { planCode: true, status: true, currentPeriodEnd: true },
      })
    : Promise.resolve(null);

  const [salon, services, staff, subscription] = await Promise.all([
    salonPromise,
    servicesPromise,
    staffPromise,
    subscriptionPromise,
  ]);

  if (!salon) {
    throw new Error(`Salon ${salonId} not found`);
  }

  return {
    salonId,
    salonName: salon.name ?? 'Salon',
    settings: settings(salon.settings),
    services: (services ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      category: s.category ?? 'General',
      durationMinutes: s.durationMinutes ?? 30,
      pricePaise: s.pricePaise,
      active: s.active ?? true,
      kind: s.kind ?? 'service',
    })),
    staff: (staff ?? []).map((m) => ({
      id: m.id,
      userId: m.userId,
      role: m.role,
      displayName: m.user?.displayName ?? 'Staff Member',
    })),
    plan: subscription
      ? {
          planCode: subscription.planCode,
          status: subscription.status,
          currentPeriodEnd: subscription.currentPeriodEnd
            ? (subscription.currentPeriodEnd instanceof Date
                ? subscription.currentPeriodEnd.toISOString()
                : String(subscription.currentPeriodEnd))
            : null,
        }
      : null,
    permissions: {
      roles: {
        owner: ['salon.settings.write', 'membership.invite', 'branch.manage', 'appointment.manage', 'appointment.assigned.read', 'ownership.transfer'],
        admin: ['salon.settings.write', 'membership.invite', 'branch.manage', 'appointment.manage', 'appointment.assigned.read'],
        manager: ['appointment.manage', 'appointment.assigned.read'],
        staff: ['appointment.assigned.read'],
        receptionist: ['appointment.manage', 'appointment.assigned.read'],
        inventory: [],
        accountant: [],
        cashier: [],
      },
    },
  };
}

/**
 * getSalonLayoutData:
 * Layered retrieval: React.cache (request-level) -> Redis (shared key salon:{salonId}:layout with TTL 600s) -> Postgres DB.
 */
export const getSalonLayoutData = cache(async (salonId: string): Promise<SalonLayoutData> => {
  if (!salonId) {
    throw new Error('salonId is required for layout data.');
  }
  const key = `salon:${salonId}:layout`;
  return cached<SalonLayoutData>(key, 600, () => loadSalonLayoutDataFromDb(salonId));
});

/**
 * getScopedSalonLayoutData:
 * Helper that strictly asserts tenant isolation before fetching cached layout data.
 */
export async function getScopedSalonLayoutData(
  context: { salonId: string },
  targetSalonId: string = context.salonId,
): Promise<SalonLayoutData> {
  assertTenantIsolation(context.salonId, targetSalonId);
  return getSalonLayoutData(context.salonId);
}

/**
 * invalidateSalonLayout:
 * Invalidates the shared layout data cache in Redis for a specific salon.
 * Never throws.
 */
export async function invalidateSalonLayout(salonId: string): Promise<void> {
  if (!salonId) return;
  await invalidate(`salon:${salonId}:layout`);
}
