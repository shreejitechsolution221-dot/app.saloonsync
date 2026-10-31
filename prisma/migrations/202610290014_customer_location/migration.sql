BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
ALTER TABLE app."SalonCustomer" ADD COLUMN "originBranchId" uuid;
ALTER TABLE app."SalonCustomer" ADD CONSTRAINT customer_origin_branch_fk FOREIGN KEY("originBranchId","salonId") REFERENCES app."Branch"(id,"salonId");
CREATE INDEX "SalonCustomer_salonId_originBranchId_idx" ON app."SalonCustomer"("salonId","originBranchId");
UPDATE app."SalonCustomer" c SET "originBranchId"=coalesce((SELECT a."branchId" FROM app."Appointment" a WHERE a."salonCustomerId"=c.id AND a."salonId"=c."salonId" ORDER BY a."createdAt",a.id LIMIT 1),(SELECT b.id FROM app."Branch" b WHERE b."salonId"=c."salonId" AND b.status='active' ORDER BY b."createdAt",b.id LIMIT 1));
COMMIT;
