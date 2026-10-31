ALTER TABLE app."Invoice" ADD COLUMN "salonCustomerId" UUID, ADD COLUMN "loyaltyPoints" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE app."Invoice" ADD CONSTRAINT invoice_customer_tenant_fk FOREIGN KEY ("salonCustomerId","salonId") REFERENCES app."SalonCustomer"(id,"salonId");
ALTER TABLE app."Invoice" ADD CONSTRAINT invoice_loyalty_points_check CHECK ("loyaltyPoints">=0 AND "loyaltyPoints"::bigint*100<="discountPaise");
CREATE TABLE app."LoyaltyRedemption" (
 "id" UUID PRIMARY KEY, "salonId" UUID NOT NULL, "customerId" UUID NOT NULL,
 "codeHash" TEXT NOT NULL UNIQUE, "points" INTEGER NOT NULL CHECK (points>0 AND points<=100000),
 "expiresAt" TIMESTAMPTZ NOT NULL, "redeemedAt" TIMESTAMPTZ, "invoiceId" UUID UNIQUE,
 "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT redemption_customer_fk FOREIGN KEY ("customerId","salonId") REFERENCES app."SalonCustomer"(id,"salonId"),
 CONSTRAINT redemption_invoice_fk FOREIGN KEY ("invoiceId","salonId") REFERENCES app."Invoice"(id,"salonId"),
 CONSTRAINT redemption_state_check CHECK (("redeemedAt" IS NULL)=("invoiceId" IS NULL))
);
CREATE INDEX "LoyaltyRedemption_salonId_customerId_idx" ON app."LoyaltyRedemption"("salonId","customerId");
ALTER TABLE app."LoyaltyRedemption" ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE ON app."LoyaltyRedemption" TO saloonsync_runtime;
CREATE POLICY backend_runtime ON app."LoyaltyRedemption" TO saloonsync_runtime USING (true) WITH CHECK (true);
