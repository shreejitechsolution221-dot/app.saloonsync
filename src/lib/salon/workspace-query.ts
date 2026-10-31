import { Prisma } from '@/generated/prisma/client';

export type WorkspaceRow = {
  membershipId: string;
  salonId: string;
  role: string;
  branchScope: string;
  salonName: string;
  branches: { id: string; name: string }[];
};

export type WorkspaceContextRow = {
  id: string;
  displayName: string;
  mobileNumber: string | null;
  salonRegistrationName: string | null;
  disabledAt: Date | null;
  workspace: WorkspaceRow | null;
};

// Read the current profile and the same authorized workspace in one statement.
// A disabled or unassigned identity still returns its profile so the caller can
// preserve the existing forbidden/selector handling before rendering anything.
export function workspaceContextQuery(userId: string, selected?: string) {
  return Prisma.sql`
    SELECT u.id, u."displayName", u."mobileNumber", u."salonRegistrationName", u."disabledAt",
      CASE WHEN w."membershipId" IS NULL THEN NULL ELSE to_jsonb(w) END AS workspace
    FROM app."User" u
    LEFT JOIN LATERAL (${workspaceQuery(userId, selected)}) w ON true
    WHERE u.id = ${userId}::uuid
  `;
}

// One parameterized round trip for current membership, salon and allowed
// branches. A cookie only selects among memberships authorized by the query.
export function workspaceQuery(userId: string, selected?: string) {
  return Prisma.sql`
    WITH active AS (
      SELECT m.id AS "membershipId", m."salonId", m.role, m."branchScope", s.name AS "salonName"
      FROM app."SalonMembership" m
      JOIN app."Salon" s ON s.id = m."salonId" AND s.status = 'active'
      JOIN app."User" u ON u.id = m."userId" AND u."disabledAt" IS NULL
      WHERE m."userId" = ${userId}::uuid AND m.status = 'active'
    )
    SELECT a.*, COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', b.id, 'name', b.name) ORDER BY b.name, b.id)
      FROM app."Branch" b
      WHERE b."salonId" = a."salonId" AND b.status = 'active'
        AND (a."branchScope" = 'all' OR (a."branchScope" = 'selected' AND EXISTS (
          SELECT 1 FROM app."MembershipBranchAccess" g
          WHERE g."membershipId" = a."membershipId" AND g."salonId" = a."salonId" AND g."branchId" = b.id
        )))
    ), '[]'::jsonb) AS branches
    FROM active a
    WHERE a."salonId"::text = ${selected ?? ''} OR (SELECT count(*) FROM active) = 1
    LIMIT 1
  `;
}
