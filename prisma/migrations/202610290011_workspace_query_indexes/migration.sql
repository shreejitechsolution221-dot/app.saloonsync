-- Cover tenant/day, personal calendars, customer visit counts and invoice
-- payment lookups. No records or permissions are changed by this migration.
CREATE INDEX "Appointment_salonId_startsAt_idx" ON app."Appointment" ("salonId", "startsAt");
CREATE INDEX "Appointment_salonId_assignedUserId_startsAt_idx" ON app."Appointment" ("salonId", "assignedUserId", "startsAt");
CREATE INDEX "Appointment_salonId_salonCustomerId_idx" ON app."Appointment" ("salonId", "salonCustomerId");
CREATE INDEX "SalonCustomer_salonId_displayName_idx" ON app."SalonCustomer" ("salonId", "displayName");
CREATE INDEX "Payment_invoiceId_idx" ON app."Payment" ("invoiceId");
