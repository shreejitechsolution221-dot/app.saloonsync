-- An assignment must reference a membership in the appointment's own salon.
CREATE INDEX "Appointment_salonId_assignedUserId_idx" ON app."Appointment" ("salonId", "assignedUserId");
ALTER TABLE app."Appointment" ADD CONSTRAINT "Appointment_salonId_assignedUserId_fkey"
  FOREIGN KEY ("salonId", "assignedUserId") REFERENCES app."SalonMembership" ("salonId", "userId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
