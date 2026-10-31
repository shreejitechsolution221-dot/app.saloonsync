ALTER TABLE app."PlatformPrivilege" DROP CONSTRAINT privilege_name;
ALTER TABLE app."PlatformPrivilege" ADD CONSTRAINT privilege_name CHECK (
  privilege IN ('platform.manage','platform.subscriptions.manage','platform.operators.manage')
);
-- Existing platform entry grants receive no additional powers automatically.
CREATE TABLE app."SalonSubscription" (
  id uuid PRIMARY KEY,
  "salonId" uuid NOT NULL UNIQUE REFERENCES app."Salon"(id) ON DELETE RESTRICT,
  "planCode" text NOT NULL CHECK (length(trim("planCode")) BETWEEN 1 AND 80),
  status text NOT NULL CHECK (status IN ('trialing','active','past_due','paused','canceled')),
  "currentPeriodEnd" timestamptz,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL
);
CREATE INDEX "SalonSubscription_status_currentPeriodEnd_idx" ON app."SalonSubscription" (status, "currentPeriodEnd");
ALTER TABLE app."SalonSubscription" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app."SalonSubscription" FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN REVOKE ALL ON app."SalonSubscription" FROM anon; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN REVOKE ALL ON app."SalonSubscription" FROM authenticated; END IF;
END $$;
