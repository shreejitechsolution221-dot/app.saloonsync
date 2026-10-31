-- Invoice and payment history stay immutable to the runtime role. Use a
-- transaction-scoped advisory lock rather than granting UPDATE for row locks.
CREATE OR REPLACE FUNCTION app.prevent_overpayment() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE total integer; paid bigint; BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW."invoiceId"::text,1));
 SELECT "totalPaise" INTO total FROM app."Invoice" WHERE id=NEW."invoiceId" AND "salonId"=NEW."salonId";
 SELECT coalesce(sum("amountPaise"),0) INTO paid FROM app."Payment" WHERE "invoiceId"=NEW."invoiceId";
 IF total IS NULL OR paid+NEW."amountPaise">total THEN RAISE EXCEPTION 'Payment exceeds outstanding balance'; END IF;
 RETURN NEW;
END $$;
