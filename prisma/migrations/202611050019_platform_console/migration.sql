BEGIN;
ALTER TABLE app."PlatformPrivilege" DROP CONSTRAINT privilege_name;
ALTER TABLE app."PlatformPrivilege" ADD CONSTRAINT privilege_name CHECK (privilege IN (
 'platform.manage','platform.subscriptions.manage','platform.operators.manage',
 'platform.salons.manage','platform.users.manage','platform.analytics.read','platform.support.manage',
 'platform.security.manage','platform.configuration.manage','platform.announcements.manage',
 'platform.jobs.manage','platform.health.read','platform.settings.manage'
));
CREATE TABLE app."PlatformRecord" (
 id UUID PRIMARY KEY, kind TEXT NOT NULL CHECK (kind IN ('ticket','plan','flag','template','policy','announcement','integration','job','incident','alert','settings','access','invitation','preference')),
 key TEXT NOT NULL UNIQUE, title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 160),
 status TEXT NOT NULL, "salonId" UUID REFERENCES app."Salon"(id) ON DELETE RESTRICT,
 "assigneeId" UUID REFERENCES app."User"(id) ON DELETE RESTRICT, payload JSONB NOT NULL DEFAULT '{}',
 version INTEGER NOT NULL DEFAULT 1 CHECK (version>0),
 "createdBy" UUID NOT NULL REFERENCES app."User"(id) ON DELETE RESTRICT, "updatedBy" UUID NOT NULL REFERENCES app."User"(id) ON DELETE RESTRICT,
 "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(), "updatedAt" TIMESTAMPTZ NOT NULL
);
CREATE INDEX "PlatformRecord_kind_status_updatedAt_idx" ON app."PlatformRecord"(kind,status,"updatedAt");
CREATE INDEX "PlatformRecord_salonId_kind_idx" ON app."PlatformRecord"("salonId",kind);
ALTER TABLE app."PlatformRecord" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app."PlatformRecord" FROM PUBLIC, anon, authenticated;
GRANT SELECT,INSERT,UPDATE ON app."PlatformRecord" TO saloonsync_runtime;
CREATE POLICY backend_runtime ON app."PlatformRecord" TO saloonsync_runtime USING (true) WITH CHECK (true);
-- Existing administrators must explicitly receive new permissions through platform:grant.

CREATE INDEX "Salon_createdAt_idx" ON app."Salon"("createdAt");
CREATE INDEX "AuditEvent_occurredAt_idx" ON app."AuditEvent"("occurredAt");
CREATE INDEX "Appointment_createdAt_idx" ON app."Appointment"("createdAt");
CREATE INDEX "Appointment_startsAt_idx" ON app."Appointment"("startsAt");
CREATE INDEX "PlatformRecord_assigneeId_kind_status_idx" ON app."PlatformRecord"("assigneeId",kind,status);
CREATE INDEX "PlatformRecord_createdBy_idx" ON app."PlatformRecord"("createdBy");
CREATE INDEX "PlatformRecord_updatedBy_idx" ON app."PlatformRecord"("updatedBy");
CREATE INDEX "AuditEvent_targetType_targetId_occurredAt_idx" ON app."AuditEvent"("targetType","targetId","occurredAt");
COMMIT;
