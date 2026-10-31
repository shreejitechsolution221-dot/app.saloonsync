-- A backend-only role: tenancy remains enforced by the server authorization layer.
-- Unlike the provisioning role, it cannot bypass RLS, change schema, write Auth
-- identities, or modify/delete audit history. No credentials live in migrations.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='saloonsync_runtime') THEN
    CREATE ROLE saloonsync_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='saloonsync_runtime' AND (rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb)) THEN
    RAISE EXCEPTION 'Runtime role must have no elevated privileges';
  END IF;
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO saloonsync_runtime', current_database());
END $$;
GRANT USAGE ON SCHEMA app, auth TO saloonsync_runtime;
GRANT SELECT(email, deleted_at) ON auth.users TO saloonsync_runtime;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['User','Salon','Branch','SalonMembership','MembershipBranchAccess','PlatformPrivilege','CustomerProfile','SalonCustomer','Invitation','InvitationBranchAccess','ConsentRecord','Appointment','RateLimit','SalonSubscription'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON app.%I TO saloonsync_runtime',t);
    EXECUTE format('CREATE POLICY backend_runtime ON app.%I TO saloonsync_runtime USING (true) WITH CHECK (true)',t);
  END LOOP;
END $$;
GRANT DELETE ON app."MembershipBranchAccess" TO saloonsync_runtime;
GRANT SELECT, INSERT ON app."AuditEvent" TO saloonsync_runtime;
CREATE POLICY backend_runtime ON app."AuditEvent" TO saloonsync_runtime USING (true) WITH CHECK (true);
-- Deliberately no grants for migration history, domain-policy administration,
-- Auth credential writes, schema creation, or browser Data API roles.
