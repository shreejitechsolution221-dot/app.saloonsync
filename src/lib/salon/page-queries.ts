import { Prisma, type Service } from '@/generated/prisma/client';

export type WorkspaceChoice = {
  id: string; salonId: string; status: string; role: string; branchScope: string;
  salon: { name: string; status: string; branches: { id: string; name: string; address: string }[] };
};
export function workspaceChoicesQuery(userId: string) {
  return Prisma.sql`
    WITH memberships AS (
      SELECT id, "salonId", status, role, "branchScope", "createdAt"
      FROM app."SalonMembership" WHERE "userId" = ${userId}::uuid
      ORDER BY "createdAt", id LIMIT 100
    )
    SELECT m.id, m."salonId", m.status, m.role, m."branchScope",
      jsonb_build_object('name', s.name, 'status', s.status, 'branches', COALESCE((
        SELECT jsonb_agg(b ORDER BY b.name, b.id) FROM (
          SELECT b.id, b.name, b.address FROM app."Branch" b
          WHERE b."salonId" = m."salonId" AND b.status = 'active' AND m.status = 'active'
            AND (m."branchScope" = 'all' OR (m."branchScope" = 'selected' AND EXISTS (
              SELECT 1 FROM app."MembershipBranchAccess" g
              WHERE g."membershipId" = m.id AND g."salonId" = m."salonId" AND g."branchId" = b.id
            )))
          ORDER BY b.name, b.id LIMIT 50
        ) b
      ), '[]'::jsonb)) AS salon
    FROM memberships m JOIN app."Salon" s ON s.id = m."salonId"
    ORDER BY m."createdAt", m.id
  `;
}

export type CustomerBookingRow = {
  id: string; startsAt: Date; status: string; salon: { name: string }; branch: { name: string };
};
export function customerBookingsQuery(userId: string) {
  return Prisma.sql`
    SELECT a.id, a."startsAt", a.status, jsonb_build_object('name', s.name) AS salon,
      jsonb_build_object('name', b.name) AS branch
    FROM app."Appointment" a
    JOIN app."Salon" s ON s.id = a."salonId"
    JOIN app."Branch" b ON b.id = a."branchId" AND b."salonId" = a."salonId"
    WHERE a."customerUserId" = ${userId}::uuid
    ORDER BY a."startsAt" DESC LIMIT 30
  `;
}

export type ServiceCatalogRow = Pick<Service, 'id' | 'name' | 'category' | 'durationMinutes' | 'pricePaise' | 'active' | 'kind' | 'checklist' | 'commissionEligible' | 'commissionBps' | 'eligibleUserIds'>;
export function serviceCatalogQuery(scope: { salonId: string; userId: string; staff: boolean; administrator: boolean }) {
  return Prisma.sql`
    SELECT s.id, s.name, s.category, s."durationMinutes", s."pricePaise", s.active,
      s.kind, s.checklist, s."commissionEligible", s."commissionBps", s."eligibleUserIds"
    FROM app."Service" s
    WHERE s."salonId" = ${scope.salonId}::uuid AND (${scope.administrator} OR s.active)
      AND (NOT ${scope.staff} OR EXISTS (
        SELECT 1 FROM app."Appointment" a
        WHERE a."salonId" = s."salonId" AND a."assignedUserId" = ${scope.userId}::uuid
          AND a."serviceName" = s.name
      ))
    ORDER BY s.category LIMIT 200
  `;
}
