-- REVIEW-ONLY migration proposal. Not in Prisma's deployable migrations folder.
-- Do not run without representative EXPLAIN evidence and operator approval.
-- If adopted, add @@index([salonId, status, createdAt]) to the Prisma model too.
-- Candidate: active staff lookup filters salonId/status and orders by createdAt.
-- Existing (salonId,status,role) does not directly order across several roles.
-- This cannot fix network/TLS latency and may not help small memberships tables.
SET lock_timeout = '2s';
SET statement_timeout = '30s';
CREATE INDEX CONCURRENTLY IF NOT EXISTS "SalonMembership_salonId_status_createdAt_idx"
  ON app."SalonMembership" ("salonId", status, "createdAt");
-- Rollback, if ever adopted: DROP INDEX CONCURRENTLY app."SalonMembership_salonId_status_createdAt_idx";
-- No duplicate email/tenant/date indexes are proposed: User has no email column;
-- provider login uses Supabase Auth; RateLimit.key and User.id are primary keys;
-- membership(salonId,userId) is unique; appointment(salonId,branchId,startsAt),
-- appointment(salonId,startsAt) and appointment(salonId,assignedUserId,startsAt)
-- already exist in the schema. No workspace_id column exists in this project.
-- RLS audit (2026-10-30): 48 live app policies inspected; none call auth.uid().
-- No RLS rewrite or additional RLS-predicate index is justified by that audit.
-- For future statement-constant UID policies, prefer (SELECT auth.uid()) and
-- index the compared identity column. Preserve all existing policy conditions;
-- do not replace backend-role policies or server-side tenant authorization.
