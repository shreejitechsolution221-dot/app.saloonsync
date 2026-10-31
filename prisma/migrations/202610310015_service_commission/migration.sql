ALTER TABLE app."Service" ADD COLUMN "commissionBps" INTEGER;
ALTER TABLE app."Appointment" ADD COLUMN "commissionBps" INTEGER;
ALTER TABLE app."Service" ADD CONSTRAINT "Service_commissionBps_range" CHECK ("commissionBps" IS NULL OR "commissionBps" BETWEEN 0 AND 10000);
ALTER TABLE app."Appointment" ADD CONSTRAINT "Appointment_commissionBps_range" CHECK ("commissionBps" IS NULL OR "commissionBps" BETWEEN 0 AND 10000);
