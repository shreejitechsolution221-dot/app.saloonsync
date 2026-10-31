ALTER TABLE app."SalonCustomer" ADD COLUMN "phone" text;
ALTER TABLE app."Appointment" ALTER COLUMN "customerUserId" DROP NOT NULL;
ALTER TABLE app."Appointment" ADD COLUMN "salonCustomerId" uuid, ADD COLUMN "serviceName" text NOT NULL DEFAULT 'Salon visit', ADD COLUMN "durationMinutes" integer NOT NULL DEFAULT 60, ADD COLUMN "pricePaise" integer NOT NULL DEFAULT 0;
ALTER TABLE app."Appointment" ADD CONSTRAINT appointment_customer CHECK ("customerUserId" IS NOT NULL OR "salonCustomerId" IS NOT NULL), ADD CONSTRAINT appointment_duration CHECK ("durationMinutes" BETWEEN 5 AND 480), ADD CONSTRAINT appointment_price CHECK ("pricePaise" >= 0), ADD CONSTRAINT appointment_local_customer FOREIGN KEY ("salonCustomerId", "salonId") REFERENCES app."SalonCustomer"(id,"salonId");
ALTER TABLE app."Appointment" DROP CONSTRAINT booking_status;
ALTER TABLE app."Appointment" ADD CONSTRAINT booking_status CHECK (status IN ('confirmed','checked_in','in_service','completed','cancelled','no_show'));
CREATE TABLE app."Service" (id uuid PRIMARY KEY, "salonId" uuid NOT NULL REFERENCES app."Salon"(id), name text NOT NULL, category text NOT NULL, "durationMinutes" integer NOT NULL CHECK ("durationMinutes" BETWEEN 5 AND 480), "pricePaise" integer NOT NULL CHECK ("pricePaise">=0), active boolean NOT NULL DEFAULT true, "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL, UNIQUE(id,"salonId"));
CREATE INDEX "Service_salonId_active_idx" ON app."Service"("salonId",active);
CREATE TABLE app."Product" (id uuid PRIMARY KEY, "salonId" uuid NOT NULL REFERENCES app."Salon"(id), name text NOT NULL, sku text NOT NULL, stock integer NOT NULL DEFAULT 0 CHECK(stock>=0), "reorderAt" integer NOT NULL DEFAULT 5 CHECK("reorderAt">=0), "pricePaise" integer NOT NULL CHECK("pricePaise">=0), "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL, UNIQUE("salonId",sku));
CREATE INDEX "Product_salonId_name_idx" ON app."Product"("salonId",name);
CREATE UNIQUE INDEX "Appointment_id_salonId_key" ON app."Appointment"(id,"salonId");
CREATE TABLE app."Invoice" (id uuid PRIMARY KEY, "salonId" uuid NOT NULL REFERENCES app."Salon"(id), "appointmentId" uuid NOT NULL UNIQUE, "customerName" text NOT NULL, "serviceName" text NOT NULL, "totalPaise" integer NOT NULL CHECK("totalPaise">=0), "createdAt" timestamptz NOT NULL DEFAULT now(), UNIQUE(id,"salonId"), FOREIGN KEY("appointmentId","salonId") REFERENCES app."Appointment"(id,"salonId"));
CREATE INDEX "Invoice_salonId_createdAt_idx" ON app."Invoice"("salonId","createdAt");
CREATE TABLE app."Payment" (id uuid PRIMARY KEY, "salonId" uuid NOT NULL, "invoiceId" uuid NOT NULL, "amountPaise" integer NOT NULL CHECK("amountPaise">0), method text NOT NULL CHECK(method IN ('cash','upi','card','transfer')), "recordedAt" timestamptz NOT NULL DEFAULT now(), FOREIGN KEY("invoiceId","salonId") REFERENCES app."Invoice"(id,"salonId"));
CREATE INDEX "Payment_salonId_recordedAt_idx" ON app."Payment"("salonId","recordedAt");
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['Service','Product','Invoice','Payment'] LOOP
  EXECUTE format('ALTER TABLE app.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('GRANT SELECT, INSERT ON app.%I TO saloonsync_runtime',t);
  EXECUTE format('CREATE POLICY backend_runtime ON app.%I TO saloonsync_runtime USING (true) WITH CHECK (true)',t);
 END LOOP;
END $$;
GRANT UPDATE ON app."Service", app."Product" TO saloonsync_runtime;
-- Serialize all writes for a stylist, including callers outside the web app.
CREATE FUNCTION app.prevent_booking_overlap() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW."assignedUserId" IS NOT NULL AND NEW.status NOT IN ('cancelled','no_show') THEN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW."salonId"::text || NEW."assignedUserId"::text,0));
  IF EXISTS (SELECT 1 FROM app."Appointment" a WHERE a.id<>NEW.id AND a."salonId"=NEW."salonId" AND a."assignedUserId"=NEW."assignedUserId" AND a.status NOT IN ('cancelled','no_show') AND a."startsAt" < NEW."startsAt" + make_interval(mins=>NEW."durationMinutes") AND NEW."startsAt" < a."startsAt" + make_interval(mins=>a."durationMinutes")) THEN
   RAISE EXCEPTION 'This team member is already booked at that time';
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER booking_no_overlap BEFORE INSERT OR UPDATE ON app."Appointment" FOR EACH ROW EXECUTE FUNCTION app.prevent_booking_overlap();
CREATE FUNCTION app.prevent_overpayment() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE total integer; paid bigint; BEGIN
 SELECT "totalPaise" INTO total FROM app."Invoice" WHERE id=NEW."invoiceId" AND "salonId"=NEW."salonId" FOR UPDATE;
 SELECT coalesce(sum("amountPaise"),0) INTO paid FROM app."Payment" WHERE "invoiceId"=NEW."invoiceId";
 IF total IS NULL OR paid+NEW."amountPaise">total THEN RAISE EXCEPTION 'Payment exceeds outstanding balance'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER payment_balance BEFORE INSERT ON app."Payment" FOR EACH ROW EXECUTE FUNCTION app.prevent_overpayment();
ALTER TABLE app."SalonMembership" DROP CONSTRAINT membership_role;
ALTER TABLE app."SalonMembership" ADD CONSTRAINT membership_role CHECK(role IN ('owner','admin','manager','staff','receptionist','inventory','accountant'));
ALTER TABLE app."Invitation" DROP CONSTRAINT invitation_role;
ALTER TABLE app."Invitation" ADD CONSTRAINT invitation_role CHECK(role IN ('admin','manager','staff','receptionist','inventory','accountant'));
