-- Application data is private. The browser uses Supabase Auth, never this schema.
REVOKE ALL ON SCHEMA app FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON SCHEMA app FROM anon;
    REVOKE ALL ON ALL TABLES IN SCHEMA app FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON SCHEMA app FROM authenticated;
    REVOKE ALL ON ALL TABLES IN SCHEMA app FROM authenticated;
  END IF;
END $$;

ALTER TABLE app."User" ADD CONSTRAINT provider_identity_fk FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE RESTRICT;
ALTER TABLE app."Salon" ADD CONSTRAINT salon_status CHECK (status IN ('active','suspended','closed'));
ALTER TABLE app."Branch" ADD CONSTRAINT branch_status CHECK (status IN ('active','suspended','closed'));
ALTER TABLE app."SalonMembership" ADD CONSTRAINT membership_role CHECK (role IN ('owner','admin','manager','staff')),
  ADD CONSTRAINT membership_status CHECK (status IN ('invited','active','suspended','revoked')),
  ADD CONSTRAINT membership_scope CHECK ("branchScope" IN ('all','selected')),
  ADD CONSTRAINT owner_scope CHECK (role <> 'owner' OR "branchScope" = 'all');
ALTER TABLE app."Invitation" ADD CONSTRAINT invitation_role CHECK (role IN ('admin','manager','staff')),
  ADD CONSTRAINT invitation_scope CHECK ("branchScope" IN ('all','selected')),
  ADD CONSTRAINT invitation_lifetime CHECK ("expiresAt" > "createdAt"),
  ADD CONSTRAINT invitation_acceptance CHECK (("acceptedAt" IS NULL) = ("acceptedBy" IS NULL)),
  ADD CONSTRAINT invitation_terminal CHECK (NOT ("acceptedAt" IS NOT NULL AND "revokedAt" IS NOT NULL)),
  ADD CONSTRAINT invitation_email CHECK ("intendedEmail" = lower(trim("intendedEmail"))),
  ADD CONSTRAINT invitation_hash CHECK ("tokenHash" ~ '^[a-f0-9]{64}$');
ALTER TABLE app."PlatformPrivilege" ADD CONSTRAINT privilege_status CHECK (status IN ('active','revoked')),
  ADD CONSTRAINT privilege_revocation CHECK ((status = 'revoked') = ("revokedAt" IS NOT NULL)),
  ADD CONSTRAINT privilege_name CHECK (privilege IN ('platform.manage'));
ALTER TABLE app."AuditEvent" ADD CONSTRAINT audit_branch_tenant CHECK ("branchId" IS NULL OR "salonId" IS NOT NULL),
  ADD CONSTRAINT audit_metadata_size CHECK (metadata IS NULL OR octet_length(metadata::text) <= 4096);
ALTER TABLE app."Appointment" ADD CONSTRAINT booking_status CHECK (status IN ('confirmed','completed','cancelled'));
ALTER TABLE app."RateLimit" ADD CONSTRAINT positive_count CHECK (count > 0);

-- RLS is defense in depth; no Data API policies are granted for private tables.
DO $$ DECLARE t record; BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='app' LOOP
    EXECUTE format('ALTER TABLE app.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;

CREATE FUNCTION app.lock_membership_salon() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW."salonId" <> OLD."salonId" OR NEW."userId" <> OLD."userId") THEN
    RAISE EXCEPTION 'Membership identity and tenant are immutable';
  END IF;
  IF TG_OP = 'DELETE' THEN
    PERFORM id FROM app."Salon" WHERE id=OLD."salonId" FOR UPDATE;
    RETURN OLD;
  END IF;
  PERFORM id FROM app."Salon" WHERE id=NEW."salonId" FOR UPDATE;
  RETURN NEW;
END $$;
CREATE TRIGGER serialize_memberships BEFORE INSERT OR UPDATE OR DELETE ON app."SalonMembership"
  FOR EACH ROW EXECUTE FUNCTION app.lock_membership_salon();

CREATE FUNCTION app.check_salon_owner() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE tenant uuid;
BEGIN
  IF TG_TABLE_NAME = 'Salon' THEN tenant := NEW.id;
  ELSIF TG_OP = 'DELETE' THEN tenant := OLD."salonId";
  ELSE tenant := NEW."salonId"; END IF;
  IF EXISTS (SELECT 1 FROM app."Salon" WHERE id=tenant AND status <> 'closed')
    AND NOT EXISTS (SELECT 1 FROM app."SalonMembership" m JOIN app."User" u ON u.id=m."userId"
      WHERE m."salonId"=tenant AND m.role='owner' AND m.status='active' AND u."disabledAt" IS NULL) THEN
    RAISE EXCEPTION 'A salon requires an active owner';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER preserve_owner AFTER INSERT OR UPDATE OR DELETE ON app."SalonMembership"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION app.check_salon_owner();
CREATE CONSTRAINT TRIGGER salon_requires_owner AFTER INSERT OR UPDATE ON app."Salon"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION app.check_salon_owner();

CREATE FUNCTION app.protect_owner_disablement() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE tenant uuid;
BEGIN
  IF NEW."disabledAt" IS NOT NULL AND OLD."disabledAt" IS NULL THEN
    FOR tenant IN SELECT "salonId" FROM app."SalonMembership" WHERE "userId"=NEW.id AND role='owner' AND status='active' ORDER BY "salonId" LOOP
      PERFORM id FROM app."Salon" WHERE id=tenant FOR UPDATE;
      IF EXISTS (SELECT 1 FROM app."Salon" WHERE id=tenant AND status <> 'closed') AND NOT EXISTS (
        SELECT 1 FROM app."SalonMembership" m JOIN app."User" u ON u.id=m."userId"
        WHERE m."salonId"=tenant AND m.role='owner' AND m.status='active' AND m."userId"<>NEW.id AND u."disabledAt" IS NULL
      ) THEN RAISE EXCEPTION 'Transfer ownership before disabling this user'; END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER protect_owner_user BEFORE UPDATE ON app."User" FOR EACH ROW EXECUTE FUNCTION app.protect_owner_disablement();

-- Deferred scope checks let a transaction create membership/invitation then grants.
CREATE FUNCTION app.check_membership_scope() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE member_id uuid; scope text;
BEGIN
  IF TG_TABLE_NAME='SalonMembership' THEN
    IF TG_OP='DELETE' THEN RETURN NULL; END IF; member_id:=NEW.id;
  ELSIF TG_OP='DELETE' THEN member_id:=OLD."membershipId";
  ELSE member_id:=NEW."membershipId"; END IF;
  SELECT "branchScope" INTO scope FROM app."SalonMembership" WHERE id=member_id;
  IF scope='selected' AND NOT EXISTS(SELECT 1 FROM app."MembershipBranchAccess" WHERE "membershipId"=member_id) THEN
    RAISE EXCEPTION 'Selected branch scope requires a branch';
  END IF;
  IF scope='all' AND EXISTS(SELECT 1 FROM app."MembershipBranchAccess" WHERE "membershipId"=member_id) THEN
    RAISE EXCEPTION 'All branch scope must not contain selected grants';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER membership_scope_check AFTER INSERT OR UPDATE ON app."SalonMembership"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION app.check_membership_scope();
CREATE CONSTRAINT TRIGGER membership_grants_check AFTER INSERT OR UPDATE OR DELETE ON app."MembershipBranchAccess"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION app.check_membership_scope();

CREATE FUNCTION app.check_invitation_scope() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE invitation_id uuid; scope text;
BEGIN
  IF TG_TABLE_NAME='Invitation' THEN
    IF TG_OP='DELETE' THEN RETURN NULL; END IF; invitation_id:=NEW.id;
  ELSIF TG_OP='DELETE' THEN invitation_id:=OLD."invitationId";
  ELSE invitation_id:=NEW."invitationId"; END IF;
  SELECT "branchScope" INTO scope FROM app."Invitation" WHERE id=invitation_id;
  IF scope='selected' AND NOT EXISTS(SELECT 1 FROM app."InvitationBranchAccess" WHERE "invitationId"=invitation_id) THEN
    RAISE EXCEPTION 'Selected invitation scope requires a branch';
  END IF;
  IF scope='all' AND EXISTS(SELECT 1 FROM app."InvitationBranchAccess" WHERE "invitationId"=invitation_id) THEN
    RAISE EXCEPTION 'All invitation scope must not contain selected grants';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER invitation_scope_check AFTER INSERT OR UPDATE ON app."Invitation"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION app.check_invitation_scope();
CREATE CONSTRAINT TRIGGER invitation_grants_check AFTER INSERT OR UPDATE OR DELETE ON app."InvitationBranchAccess"
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION app.check_invitation_scope();

CREATE FUNCTION app.invitation_terminal() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."acceptedAt" IS NOT NULL OR OLD."revokedAt" IS NOT NULL THEN
    RAISE EXCEPTION 'A terminal invitation is immutable';
  END IF;
  IF NEW."salonId"<>OLD."salonId" OR NEW."tokenHash"<>OLD."tokenHash" OR NEW."intendedEmail"<>OLD."intendedEmail"
    OR NEW.role<>OLD.role OR NEW."branchScope"<>OLD."branchScope" OR NEW."invitedBy"<>OLD."invitedBy" OR NEW."expiresAt"<>OLD."expiresAt" THEN
    RAISE EXCEPTION 'Invitation grant is immutable; revoke and reissue';
  END IF;
  IF NEW."acceptedAt" IS NOT NULL AND OLD."expiresAt" <= now() THEN RAISE EXCEPTION 'Invitation expired'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER invitation_terminal_check BEFORE UPDATE ON app."Invitation" FOR EACH ROW EXECUTE FUNCTION app.invitation_terminal();

-- No SECURITY DEFINER functions. Revoke implicit public function execution.
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app FROM PUBLIC;
