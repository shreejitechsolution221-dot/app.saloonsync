ALTER TABLE app."Invitation" ADD COLUMN "staffProfileId" UUID;
ALTER TABLE app."Invitation" ADD CONSTRAINT "Invitation_staffProfile_tenant_fk" FOREIGN KEY ("staffProfileId","salonId") REFERENCES app."StaffProfile"(id,"salonId");
CREATE INDEX "Invitation_staffProfileId_salonId_idx" ON app."Invitation"("staffProfileId","salonId");
