BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
-- AlterTable
ALTER TABLE app."Salon" ADD COLUMN     "settings" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE app."Branch" ADD COLUMN     "address" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "phone" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE app."SalonCustomer" ADD COLUMN     "birthday" DATE,
ADD COLUMN     "marketingConsentAt" TIMESTAMPTZ,
ADD COLUMN     "photoConsentAt" TIMESTAMPTZ,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "whatsappConsentAt" TIMESTAMPTZ;

-- AlterTable
ALTER TABLE app."Appointment" ADD COLUMN     "checkedInAt" TIMESTAMPTZ,
ADD COLUMN     "checklist" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "completedAt" TIMESTAMPTZ,
ADD COLUMN     "completedSteps" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN     "recurrenceKey" TEXT,
ADD COLUMN     "stockRecipe" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE app."Service" ADD COLUMN     "checklist" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "commissionEligible" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "eligibleUserIds" UUID[] DEFAULT ARRAY[]::UUID[],
ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'service';

-- AlterTable
ALTER TABLE app."Product" ADD COLUMN     "barcode" TEXT,
ADD COLUMN     "costPaise" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE app."Invoice" ADD COLUMN     "basePaise" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "branchId" UUID,
ADD COLUMN     "discountPaise" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "taxBps" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "taxPaise" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE app."StaffProfile" (
    "id" UUID NOT NULL,
    "salonId" UUID NOT NULL,
    "displayName" TEXT NOT NULL,
    "userId" UUID,
    "jobTitle" TEXT NOT NULL,
    "commissionBps" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "StaffProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE app."Expense" (
    "id" UUID NOT NULL,
    "salonId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "submittedBy" UUID NOT NULL,
    "approvedBy" UUID,
    "category" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "receiptReference" TEXT NOT NULL DEFAULT '',
    "incurredAt" TIMESTAMPTZ NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE app."CashSession" (
    "id" UUID NOT NULL,
    "salonId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "openedBy" UUID NOT NULL,
    "businessDate" DATE NOT NULL,
    "openingPaise" INTEGER NOT NULL,
    "countedPaise" INTEGER,
    "expectedPaise" INTEGER,
    "closedAt" TIMESTAMPTZ,
    "closedBy" UUID,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "CashSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE app."LeaveRequest" (
    "id" UUID NOT NULL,
    "salonId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "startsAt" TIMESTAMPTZ NOT NULL,
    "endsAt" TIMESTAMPTZ NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewedBy" UUID,
    "reviewedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE app."Attendance" (
    "id" UUID NOT NULL,
    "salonId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "clockedInAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clockedOutAt" TIMESTAMPTZ,
    "breakStartedAt" TIMESTAMPTZ,
    "breakMinutes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE app."Shift" (
    "id" UUID NOT NULL,
    "salonId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "startsAt" TIMESTAMPTZ NOT NULL,
    "endsAt" TIMESTAMPTZ NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE app."RevenueTarget" (
    "id" UUID NOT NULL,
    "salonId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "period" TEXT NOT NULL,
    "startsOn" DATE NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "RevenueTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE app."TaskTemplate" (
    "id" UUID NOT NULL,
    "salonId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "TaskTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE app."DailyTask" (
    "id" UUID NOT NULL,
    "salonId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "templateId" UUID NOT NULL,
    "businessDate" DATE NOT NULL,
    "completedBy" UUID,
    "completedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "DailyTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE app."CommissionEntry" (
    "id" UUID NOT NULL,
    "salonId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "appointmentId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "basePaise" INTEGER NOT NULL,
    "rateBps" INTEGER NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "CommissionEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE app."ServiceProduct" (
    "id" UUID NOT NULL,
    "salonId" UUID NOT NULL,
    "serviceId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ServiceProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE app."StockMovement" (
    "id" UUID NOT NULL,
    "salonId" UUID NOT NULL,
    "branchId" UUID,
    "productId" UUID NOT NULL,
    "appointmentId" UUID,
    "purchaseOrderId" UUID,
    "actorUserId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE app."Supplier" (
    "id" UUID NOT NULL,
    "salonId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE app."PurchaseOrder" (
    "id" UUID NOT NULL,
    "salonId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "requestedBy" UUID NOT NULL,
    "approvedBy" UUID,
    "receivedAt" TIMESTAMPTZ,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE app."PurchaseLine" (
    "id" UUID NOT NULL,
    "salonId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitCostPaise" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "PurchaseLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE app."Refund" (
    "id" UUID NOT NULL,
    "salonId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "approvedBy" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE app."InvoiceLine" (
    "id" UUID NOT NULL,
    "salonId" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPricePaise" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE app."Feedback" (
    "id" UUID NOT NULL,
    "salonId" UUID NOT NULL,
    "appointmentId" UUID NOT NULL,
    "customerUserId" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE app."PortfolioPhoto" (
    "id" UUID NOT NULL,
    "salonId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "appointmentId" UUID,
    "objectPath" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "consentedAt" TIMESTAMPTZ NOT NULL,
    "uploadedBy" UUID NOT NULL,
    "caption" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "PortfolioPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE app."Campaign" (
    "id" UUID NOT NULL,
    "salonId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE app."MessageJob" (
    "id" UUID NOT NULL,
    "salonId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "appointmentId" UUID,
    "campaignId" UUID,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "providerMessageId" TEXT,
    "lastError" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "MessageJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE app."Offer" (
    "id" UUID NOT NULL,
    "salonId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE app."LoyaltyAccount" (
    "id" UUID NOT NULL,
    "salonId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "membershipName" TEXT NOT NULL DEFAULT '',
    "referralCode" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "LoyaltyAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE app."LoyaltyEntry" (
    "id" UUID NOT NULL,
    "salonId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "points" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "actorUserId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "LoyaltyEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE app."GiftCard" (
    "id" UUID NOT NULL,
    "salonId" UUID NOT NULL,
    "codeHash" TEXT NOT NULL,
    "lastFour" TEXT NOT NULL,
    "initialPaise" INTEGER NOT NULL,
    "balancePaise" INTEGER NOT NULL,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "GiftCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffProfile_salonId_userId_key" ON app."StaffProfile"("salonId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffProfile_id_salonId_key" ON app."StaffProfile"("id", "salonId");

-- CreateIndex
CREATE INDEX "Expense_salonId_branchId_incurredAt_idx" ON app."Expense"("salonId", "branchId", "incurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "Expense_id_salonId_key" ON app."Expense"("id", "salonId");

-- CreateIndex
CREATE UNIQUE INDEX "CashSession_salonId_branchId_businessDate_key" ON app."CashSession"("salonId", "branchId", "businessDate");

-- CreateIndex
CREATE UNIQUE INDEX "CashSession_id_salonId_key" ON app."CashSession"("id", "salonId");

-- CreateIndex
CREATE INDEX "LeaveRequest_salonId_userId_startsAt_endsAt_idx" ON app."LeaveRequest"("salonId", "userId", "startsAt", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveRequest_id_salonId_key" ON app."LeaveRequest"("id", "salonId");

-- CreateIndex
CREATE INDEX "Attendance_salonId_userId_clockedInAt_idx" ON app."Attendance"("salonId", "userId", "clockedInAt");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_id_salonId_key" ON app."Attendance"("id", "salonId");

-- CreateIndex
CREATE INDEX "Shift_salonId_branchId_startsAt_idx" ON app."Shift"("salonId", "branchId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "Shift_id_salonId_key" ON app."Shift"("id", "salonId");

-- CreateIndex
CREATE UNIQUE INDEX "RevenueTarget_salonId_branchId_period_startsOn_key" ON app."RevenueTarget"("salonId", "branchId", "period", "startsOn");

-- CreateIndex
CREATE UNIQUE INDEX "RevenueTarget_id_salonId_key" ON app."RevenueTarget"("id", "salonId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskTemplate_id_salonId_key" ON app."TaskTemplate"("id", "salonId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyTask_salonId_branchId_templateId_businessDate_key" ON app."DailyTask"("salonId", "branchId", "templateId", "businessDate");

-- CreateIndex
CREATE UNIQUE INDEX "DailyTask_id_salonId_key" ON app."DailyTask"("id", "salonId");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionEntry_appointmentId_key" ON app."CommissionEntry"("appointmentId");

-- CreateIndex
CREATE INDEX "CommissionEntry_salonId_userId_createdAt_idx" ON app."CommissionEntry"("salonId", "userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CommissionEntry_id_salonId_key" ON app."CommissionEntry"("id", "salonId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceProduct_salonId_serviceId_productId_key" ON app."ServiceProduct"("salonId", "serviceId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceProduct_id_salonId_key" ON app."ServiceProduct"("id", "salonId");

-- CreateIndex
CREATE INDEX "StockMovement_salonId_productId_createdAt_idx" ON app."StockMovement"("salonId", "productId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StockMovement_appointmentId_productId_key" ON app."StockMovement"("appointmentId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "StockMovement_id_salonId_key" ON app."StockMovement"("id", "salonId");

-- CreateIndex
CREATE INDEX "Supplier_salonId_name_idx" ON app."Supplier"("salonId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_id_salonId_key" ON app."Supplier"("id", "salonId");

-- CreateIndex
CREATE INDEX "PurchaseOrder_salonId_branchId_status_idx" ON app."PurchaseOrder"("salonId", "branchId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_id_salonId_key" ON app."PurchaseOrder"("id", "salonId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseLine_salonId_orderId_productId_key" ON app."PurchaseLine"("salonId", "orderId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseLine_id_salonId_key" ON app."PurchaseLine"("id", "salonId");

-- CreateIndex
CREATE INDEX "Refund_salonId_invoiceId_idx" ON app."Refund"("salonId", "invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_id_salonId_key" ON app."Refund"("id", "salonId");

-- CreateIndex
CREATE INDEX "InvoiceLine_salonId_invoiceId_idx" ON app."InvoiceLine"("salonId", "invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceLine_id_salonId_key" ON app."InvoiceLine"("id", "salonId");

-- CreateIndex
CREATE UNIQUE INDEX "Feedback_appointmentId_key" ON app."Feedback"("appointmentId");

-- CreateIndex
CREATE INDEX "Feedback_salonId_createdAt_idx" ON app."Feedback"("salonId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Feedback_id_salonId_key" ON app."Feedback"("id", "salonId");

-- CreateIndex
CREATE UNIQUE INDEX "PortfolioPhoto_objectPath_key" ON app."PortfolioPhoto"("objectPath");

-- CreateIndex
CREATE INDEX "PortfolioPhoto_salonId_customerId_idx" ON app."PortfolioPhoto"("salonId", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "PortfolioPhoto_id_salonId_key" ON app."PortfolioPhoto"("id", "salonId");

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_id_salonId_key" ON app."Campaign"("id", "salonId");

-- CreateIndex
CREATE UNIQUE INDEX "MessageJob_dedupeKey_key" ON app."MessageJob"("dedupeKey");

-- CreateIndex
CREATE INDEX "MessageJob_status_nextAttemptAt_idx" ON app."MessageJob"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "MessageJob_salonId_createdAt_idx" ON app."MessageJob"("salonId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MessageJob_id_salonId_key" ON app."MessageJob"("id", "salonId");

-- CreateIndex
CREATE UNIQUE INDEX "Offer_salonId_code_key" ON app."Offer"("salonId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Offer_id_salonId_key" ON app."Offer"("id", "salonId");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyAccount_salonId_customerId_key" ON app."LoyaltyAccount"("salonId", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyAccount_salonId_referralCode_key" ON app."LoyaltyAccount"("salonId", "referralCode");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyAccount_id_salonId_key" ON app."LoyaltyAccount"("id", "salonId");

-- CreateIndex
CREATE INDEX "LoyaltyEntry_salonId_customerId_createdAt_idx" ON app."LoyaltyEntry"("salonId", "customerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyEntry_id_salonId_key" ON app."LoyaltyEntry"("id", "salonId");

-- CreateIndex
CREATE UNIQUE INDEX "GiftCard_codeHash_key" ON app."GiftCard"("codeHash");

-- CreateIndex
CREATE INDEX "GiftCard_salonId_createdAt_idx" ON app."GiftCard"("salonId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "GiftCard_id_salonId_key" ON app."GiftCard"("id", "salonId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_salonId_barcode_key" ON app."Product"("salonId", "barcode");

ALTER TABLE app."Appointment" ADD COLUMN "commissionEligible" boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX "Product_id_salonId_key" ON app."Product"(id,"salonId");
ALTER TABLE app."StaffProfile" ADD CONSTRAINT "StaffProfile_salon_fk" FOREIGN KEY ("salonId") REFERENCES app."Salon"(id);
ALTER TABLE app."StaffProfile" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON app."StaffProfile" TO saloonsync_runtime;
CREATE POLICY backend_runtime ON app."StaffProfile" TO saloonsync_runtime USING (true) WITH CHECK (true);
ALTER TABLE app."Expense" ADD CONSTRAINT "Expense_salon_fk" FOREIGN KEY ("salonId") REFERENCES app."Salon"(id);
ALTER TABLE app."Expense" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON app."Expense" TO saloonsync_runtime;
CREATE POLICY backend_runtime ON app."Expense" TO saloonsync_runtime USING (true) WITH CHECK (true);
ALTER TABLE app."CashSession" ADD CONSTRAINT "CashSession_salon_fk" FOREIGN KEY ("salonId") REFERENCES app."Salon"(id);
ALTER TABLE app."CashSession" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON app."CashSession" TO saloonsync_runtime;
CREATE POLICY backend_runtime ON app."CashSession" TO saloonsync_runtime USING (true) WITH CHECK (true);
ALTER TABLE app."LeaveRequest" ADD CONSTRAINT "LeaveRequest_salon_fk" FOREIGN KEY ("salonId") REFERENCES app."Salon"(id);
ALTER TABLE app."LeaveRequest" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON app."LeaveRequest" TO saloonsync_runtime;
CREATE POLICY backend_runtime ON app."LeaveRequest" TO saloonsync_runtime USING (true) WITH CHECK (true);
ALTER TABLE app."Attendance" ADD CONSTRAINT "Attendance_salon_fk" FOREIGN KEY ("salonId") REFERENCES app."Salon"(id);
ALTER TABLE app."Attendance" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON app."Attendance" TO saloonsync_runtime;
CREATE POLICY backend_runtime ON app."Attendance" TO saloonsync_runtime USING (true) WITH CHECK (true);
ALTER TABLE app."Shift" ADD CONSTRAINT "Shift_salon_fk" FOREIGN KEY ("salonId") REFERENCES app."Salon"(id);
ALTER TABLE app."Shift" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON app."Shift" TO saloonsync_runtime;
CREATE POLICY backend_runtime ON app."Shift" TO saloonsync_runtime USING (true) WITH CHECK (true);
ALTER TABLE app."RevenueTarget" ADD CONSTRAINT "RevenueTarget_salon_fk" FOREIGN KEY ("salonId") REFERENCES app."Salon"(id);
ALTER TABLE app."RevenueTarget" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON app."RevenueTarget" TO saloonsync_runtime;
CREATE POLICY backend_runtime ON app."RevenueTarget" TO saloonsync_runtime USING (true) WITH CHECK (true);
ALTER TABLE app."TaskTemplate" ADD CONSTRAINT "TaskTemplate_salon_fk" FOREIGN KEY ("salonId") REFERENCES app."Salon"(id);
ALTER TABLE app."TaskTemplate" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON app."TaskTemplate" TO saloonsync_runtime;
CREATE POLICY backend_runtime ON app."TaskTemplate" TO saloonsync_runtime USING (true) WITH CHECK (true);
ALTER TABLE app."DailyTask" ADD CONSTRAINT "DailyTask_salon_fk" FOREIGN KEY ("salonId") REFERENCES app."Salon"(id);
ALTER TABLE app."DailyTask" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON app."DailyTask" TO saloonsync_runtime;
CREATE POLICY backend_runtime ON app."DailyTask" TO saloonsync_runtime USING (true) WITH CHECK (true);
ALTER TABLE app."CommissionEntry" ADD CONSTRAINT "CommissionEntry_salon_fk" FOREIGN KEY ("salonId") REFERENCES app."Salon"(id);
ALTER TABLE app."CommissionEntry" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON app."CommissionEntry" TO saloonsync_runtime;
CREATE POLICY backend_runtime ON app."CommissionEntry" TO saloonsync_runtime USING (true) WITH CHECK (true);
ALTER TABLE app."ServiceProduct" ADD CONSTRAINT "ServiceProduct_salon_fk" FOREIGN KEY ("salonId") REFERENCES app."Salon"(id);
ALTER TABLE app."ServiceProduct" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON app."ServiceProduct" TO saloonsync_runtime;
CREATE POLICY backend_runtime ON app."ServiceProduct" TO saloonsync_runtime USING (true) WITH CHECK (true);
ALTER TABLE app."StockMovement" ADD CONSTRAINT "StockMovement_salon_fk" FOREIGN KEY ("salonId") REFERENCES app."Salon"(id);
ALTER TABLE app."StockMovement" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON app."StockMovement" TO saloonsync_runtime;
CREATE POLICY backend_runtime ON app."StockMovement" TO saloonsync_runtime USING (true) WITH CHECK (true);
ALTER TABLE app."Supplier" ADD CONSTRAINT "Supplier_salon_fk" FOREIGN KEY ("salonId") REFERENCES app."Salon"(id);
ALTER TABLE app."Supplier" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON app."Supplier" TO saloonsync_runtime;
CREATE POLICY backend_runtime ON app."Supplier" TO saloonsync_runtime USING (true) WITH CHECK (true);
ALTER TABLE app."PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_salon_fk" FOREIGN KEY ("salonId") REFERENCES app."Salon"(id);
ALTER TABLE app."PurchaseOrder" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON app."PurchaseOrder" TO saloonsync_runtime;
CREATE POLICY backend_runtime ON app."PurchaseOrder" TO saloonsync_runtime USING (true) WITH CHECK (true);
ALTER TABLE app."PurchaseLine" ADD CONSTRAINT "PurchaseLine_salon_fk" FOREIGN KEY ("salonId") REFERENCES app."Salon"(id);
ALTER TABLE app."PurchaseLine" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON app."PurchaseLine" TO saloonsync_runtime;
CREATE POLICY backend_runtime ON app."PurchaseLine" TO saloonsync_runtime USING (true) WITH CHECK (true);
ALTER TABLE app."Refund" ADD CONSTRAINT "Refund_salon_fk" FOREIGN KEY ("salonId") REFERENCES app."Salon"(id);
ALTER TABLE app."Refund" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON app."Refund" TO saloonsync_runtime;
CREATE POLICY backend_runtime ON app."Refund" TO saloonsync_runtime USING (true) WITH CHECK (true);
ALTER TABLE app."InvoiceLine" ADD CONSTRAINT "InvoiceLine_salon_fk" FOREIGN KEY ("salonId") REFERENCES app."Salon"(id);
ALTER TABLE app."InvoiceLine" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON app."InvoiceLine" TO saloonsync_runtime;
CREATE POLICY backend_runtime ON app."InvoiceLine" TO saloonsync_runtime USING (true) WITH CHECK (true);
ALTER TABLE app."Feedback" ADD CONSTRAINT "Feedback_salon_fk" FOREIGN KEY ("salonId") REFERENCES app."Salon"(id);
ALTER TABLE app."Feedback" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON app."Feedback" TO saloonsync_runtime;
CREATE POLICY backend_runtime ON app."Feedback" TO saloonsync_runtime USING (true) WITH CHECK (true);
ALTER TABLE app."PortfolioPhoto" ADD CONSTRAINT "PortfolioPhoto_salon_fk" FOREIGN KEY ("salonId") REFERENCES app."Salon"(id);
ALTER TABLE app."PortfolioPhoto" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON app."PortfolioPhoto" TO saloonsync_runtime;
CREATE POLICY backend_runtime ON app."PortfolioPhoto" TO saloonsync_runtime USING (true) WITH CHECK (true);
ALTER TABLE app."Campaign" ADD CONSTRAINT "Campaign_salon_fk" FOREIGN KEY ("salonId") REFERENCES app."Salon"(id);
ALTER TABLE app."Campaign" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON app."Campaign" TO saloonsync_runtime;
CREATE POLICY backend_runtime ON app."Campaign" TO saloonsync_runtime USING (true) WITH CHECK (true);
ALTER TABLE app."MessageJob" ADD CONSTRAINT "MessageJob_salon_fk" FOREIGN KEY ("salonId") REFERENCES app."Salon"(id);
ALTER TABLE app."MessageJob" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON app."MessageJob" TO saloonsync_runtime;
CREATE POLICY backend_runtime ON app."MessageJob" TO saloonsync_runtime USING (true) WITH CHECK (true);
ALTER TABLE app."Offer" ADD CONSTRAINT "Offer_salon_fk" FOREIGN KEY ("salonId") REFERENCES app."Salon"(id);
ALTER TABLE app."Offer" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON app."Offer" TO saloonsync_runtime;
CREATE POLICY backend_runtime ON app."Offer" TO saloonsync_runtime USING (true) WITH CHECK (true);
ALTER TABLE app."LoyaltyAccount" ADD CONSTRAINT "LoyaltyAccount_salon_fk" FOREIGN KEY ("salonId") REFERENCES app."Salon"(id);
ALTER TABLE app."LoyaltyAccount" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON app."LoyaltyAccount" TO saloonsync_runtime;
CREATE POLICY backend_runtime ON app."LoyaltyAccount" TO saloonsync_runtime USING (true) WITH CHECK (true);
ALTER TABLE app."LoyaltyEntry" ADD CONSTRAINT "LoyaltyEntry_salon_fk" FOREIGN KEY ("salonId") REFERENCES app."Salon"(id);
ALTER TABLE app."LoyaltyEntry" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON app."LoyaltyEntry" TO saloonsync_runtime;
CREATE POLICY backend_runtime ON app."LoyaltyEntry" TO saloonsync_runtime USING (true) WITH CHECK (true);
ALTER TABLE app."GiftCard" ADD CONSTRAINT "GiftCard_salon_fk" FOREIGN KEY ("salonId") REFERENCES app."Salon"(id);
ALTER TABLE app."GiftCard" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON app."GiftCard" TO saloonsync_runtime;
CREATE POLICY backend_runtime ON app."GiftCard" TO saloonsync_runtime USING (true) WITH CHECK (true);
ALTER TABLE app."Expense" ADD CONSTRAINT "Expense_branch_fk" FOREIGN KEY ("branchId","salonId") REFERENCES app."Branch"(id,"salonId");
ALTER TABLE app."CashSession" ADD CONSTRAINT "CashSession_branch_fk" FOREIGN KEY ("branchId","salonId") REFERENCES app."Branch"(id,"salonId");
ALTER TABLE app."LeaveRequest" ADD CONSTRAINT "LeaveRequest_branch_fk" FOREIGN KEY ("branchId","salonId") REFERENCES app."Branch"(id,"salonId");
ALTER TABLE app."Attendance" ADD CONSTRAINT "Attendance_branch_fk" FOREIGN KEY ("branchId","salonId") REFERENCES app."Branch"(id,"salonId");
ALTER TABLE app."Shift" ADD CONSTRAINT "Shift_branch_fk" FOREIGN KEY ("branchId","salonId") REFERENCES app."Branch"(id,"salonId");
ALTER TABLE app."RevenueTarget" ADD CONSTRAINT "RevenueTarget_branch_fk" FOREIGN KEY ("branchId","salonId") REFERENCES app."Branch"(id,"salonId");
ALTER TABLE app."DailyTask" ADD CONSTRAINT "DailyTask_branch_fk" FOREIGN KEY ("branchId","salonId") REFERENCES app."Branch"(id,"salonId");
ALTER TABLE app."CommissionEntry" ADD CONSTRAINT "CommissionEntry_branch_fk" FOREIGN KEY ("branchId","salonId") REFERENCES app."Branch"(id,"salonId");
ALTER TABLE app."StockMovement" ADD CONSTRAINT "StockMovement_branch_fk" FOREIGN KEY ("branchId","salonId") REFERENCES app."Branch"(id,"salonId");
ALTER TABLE app."PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_branch_fk" FOREIGN KEY ("branchId","salonId") REFERENCES app."Branch"(id,"salonId");
ALTER TABLE app."Refund" ADD CONSTRAINT "Refund_branch_fk" FOREIGN KEY ("branchId","salonId") REFERENCES app."Branch"(id,"salonId");
ALTER TABLE app."StaffProfile" ADD CONSTRAINT "StaffProfile_member_fk" FOREIGN KEY ("salonId","userId") REFERENCES app."SalonMembership"("salonId","userId");
ALTER TABLE app."LeaveRequest" ADD CONSTRAINT "LeaveRequest_member_fk" FOREIGN KEY ("salonId","userId") REFERENCES app."SalonMembership"("salonId","userId");
ALTER TABLE app."Attendance" ADD CONSTRAINT "Attendance_member_fk" FOREIGN KEY ("salonId","userId") REFERENCES app."SalonMembership"("salonId","userId");
ALTER TABLE app."Shift" ADD CONSTRAINT "Shift_member_fk" FOREIGN KEY ("salonId","userId") REFERENCES app."SalonMembership"("salonId","userId");
ALTER TABLE app."CommissionEntry" ADD CONSTRAINT "CommissionEntry_member_fk" FOREIGN KEY ("salonId","userId") REFERENCES app."SalonMembership"("salonId","userId");
ALTER TABLE app."ServiceProduct" ADD CONSTRAINT "ServiceProduct_serviceId_tenant_fk" FOREIGN KEY ("serviceId","salonId") REFERENCES app."Service"(id,"salonId");
ALTER TABLE app."ServiceProduct" ADD CONSTRAINT "ServiceProduct_productId_tenant_fk" FOREIGN KEY ("productId","salonId") REFERENCES app."Product"(id,"salonId");
ALTER TABLE app."StockMovement" ADD CONSTRAINT "StockMovement_productId_tenant_fk" FOREIGN KEY ("productId","salonId") REFERENCES app."Product"(id,"salonId");
ALTER TABLE app."StockMovement" ADD CONSTRAINT "StockMovement_appointmentId_tenant_fk" FOREIGN KEY ("appointmentId","salonId") REFERENCES app."Appointment"(id,"salonId");
ALTER TABLE app."StockMovement" ADD CONSTRAINT "StockMovement_purchaseOrderId_tenant_fk" FOREIGN KEY ("purchaseOrderId","salonId") REFERENCES app."PurchaseOrder"(id,"salonId");
ALTER TABLE app."PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierId_tenant_fk" FOREIGN KEY ("supplierId","salonId") REFERENCES app."Supplier"(id,"salonId");
ALTER TABLE app."PurchaseLine" ADD CONSTRAINT "PurchaseLine_orderId_tenant_fk" FOREIGN KEY ("orderId","salonId") REFERENCES app."PurchaseOrder"(id,"salonId");
ALTER TABLE app."PurchaseLine" ADD CONSTRAINT "PurchaseLine_productId_tenant_fk" FOREIGN KEY ("productId","salonId") REFERENCES app."Product"(id,"salonId");
ALTER TABLE app."Refund" ADD CONSTRAINT "Refund_invoiceId_tenant_fk" FOREIGN KEY ("invoiceId","salonId") REFERENCES app."Invoice"(id,"salonId");
ALTER TABLE app."InvoiceLine" ADD CONSTRAINT "InvoiceLine_invoiceId_tenant_fk" FOREIGN KEY ("invoiceId","salonId") REFERENCES app."Invoice"(id,"salonId");
ALTER TABLE app."CommissionEntry" ADD CONSTRAINT "CommissionEntry_appointmentId_tenant_fk" FOREIGN KEY ("appointmentId","salonId") REFERENCES app."Appointment"(id,"salonId");
ALTER TABLE app."Feedback" ADD CONSTRAINT "Feedback_appointmentId_tenant_fk" FOREIGN KEY ("appointmentId","salonId") REFERENCES app."Appointment"(id,"salonId");
ALTER TABLE app."PortfolioPhoto" ADD CONSTRAINT "PortfolioPhoto_customerId_tenant_fk" FOREIGN KEY ("customerId","salonId") REFERENCES app."SalonCustomer"(id,"salonId");
ALTER TABLE app."PortfolioPhoto" ADD CONSTRAINT "PortfolioPhoto_appointmentId_tenant_fk" FOREIGN KEY ("appointmentId","salonId") REFERENCES app."Appointment"(id,"salonId");
ALTER TABLE app."MessageJob" ADD CONSTRAINT "MessageJob_customerId_tenant_fk" FOREIGN KEY ("customerId","salonId") REFERENCES app."SalonCustomer"(id,"salonId");
ALTER TABLE app."MessageJob" ADD CONSTRAINT "MessageJob_appointmentId_tenant_fk" FOREIGN KEY ("appointmentId","salonId") REFERENCES app."Appointment"(id,"salonId");
ALTER TABLE app."MessageJob" ADD CONSTRAINT "MessageJob_campaignId_tenant_fk" FOREIGN KEY ("campaignId","salonId") REFERENCES app."Campaign"(id,"salonId");
ALTER TABLE app."DailyTask" ADD CONSTRAINT "DailyTask_templateId_tenant_fk" FOREIGN KEY ("templateId","salonId") REFERENCES app."TaskTemplate"(id,"salonId");
ALTER TABLE app."LoyaltyAccount" ADD CONSTRAINT "LoyaltyAccount_customerId_tenant_fk" FOREIGN KEY ("customerId","salonId") REFERENCES app."SalonCustomer"(id,"salonId");
ALTER TABLE app."LoyaltyEntry" ADD CONSTRAINT "LoyaltyEntry_customerId_tenant_fk" FOREIGN KEY ("customerId","salonId") REFERENCES app."SalonCustomer"(id,"salonId");

ALTER TABLE app."Invoice" ADD CONSTRAINT invoice_branch_fk FOREIGN KEY("branchId","salonId") REFERENCES app."Branch"(id,"salonId");
UPDATE app."Invoice" i SET "branchId"=a."branchId", "basePaise"=i."totalPaise" FROM app."Appointment" a WHERE a.id=i."appointmentId";
ALTER TABLE app."Invoice" ADD CONSTRAINT invoice_calculation CHECK("basePaise">=0 AND "discountPaise" BETWEEN 0 AND "basePaise" AND "taxBps" BETWEEN 0 AND 3000 AND "taxPaise"=round(("basePaise"-"discountPaise")::numeric*"taxBps"/10000) AND "totalPaise"="basePaise"-"discountPaise"+"taxPaise");
ALTER TABLE app."StaffProfile" ADD CHECK("commissionBps" BETWEEN 0 AND 10000);
ALTER TABLE app."Service" ADD CHECK(kind IN ('service','package','addon'));
ALTER TABLE app."Product" ADD CHECK("costPaise">=0);
ALTER TABLE app."Expense" ADD CHECK("amountPaise">0 AND status IN ('pending','approved','rejected') AND method IN ('cash','upi','card','transfer'));
ALTER TABLE app."CashSession" ADD CHECK("openingPaise">=0 AND ("countedPaise" IS NULL OR "countedPaise">=0) AND (("closedAt" IS NULL AND "countedPaise" IS NULL AND "expectedPaise" IS NULL AND "closedBy" IS NULL) OR ("closedAt" IS NOT NULL AND "countedPaise" IS NOT NULL AND "expectedPaise" IS NOT NULL AND "closedBy" IS NOT NULL)));
ALTER TABLE app."LeaveRequest" ADD CHECK("startsAt"<"endsAt" AND status IN ('pending','approved','rejected'));
ALTER TABLE app."Shift" ADD CHECK("startsAt"<"endsAt");
ALTER TABLE app."Attendance" ADD CHECK("breakMinutes">=0 AND ("clockedOutAt" IS NULL OR "clockedOutAt">="clockedInAt") AND ("breakStartedAt" IS NULL OR "clockedOutAt" IS NULL));
CREATE UNIQUE INDEX attendance_one_open ON app."Attendance"("salonId","userId") WHERE "clockedOutAt" IS NULL;
ALTER TABLE app."RevenueTarget" ADD CHECK("amountPaise">0 AND period IN ('daily','weekly','monthly'));
ALTER TABLE app."CommissionEntry" ADD CHECK("basePaise">=0 AND "rateBps" BETWEEN 0 AND 10000 AND "amountPaise"=floor("basePaise"::numeric*"rateBps"/10000));
ALTER TABLE app."ServiceProduct" ADD CHECK(quantity>0);
ALTER TABLE app."StockMovement" ADD CHECK(quantity<>0);
ALTER TABLE app."PurchaseOrder" ADD CHECK(status IN ('pending','approved','rejected','received'));
ALTER TABLE app."PurchaseLine" ADD CHECK(quantity>0 AND "unitCostPaise">=0);
ALTER TABLE app."Refund" ADD CHECK("amountPaise">0 AND method IN ('cash','upi','card','transfer'));
ALTER TABLE app."InvoiceLine" ADD CHECK(quantity>0 AND "unitPricePaise">=0);
ALTER TABLE app."Feedback" ADD CHECK(rating BETWEEN 1 AND 5);
ALTER TABLE app."PortfolioPhoto" ADD CHECK(kind IN ('before','after'));
ALTER TABLE app."MessageJob" ADD CHECK(attempts>=0 AND status IN ('queued','processing','sent','failed','configuration_required'));
ALTER TABLE app."Offer" ADD CHECK(kind IN ('percentage','fixed') AND value>0 AND (kind<>'percentage' OR value<=10000));
ALTER TABLE app."LoyaltyAccount" ADD CHECK(points>=0);
ALTER TABLE app."GiftCard" ADD CHECK("initialPaise">0 AND "balancePaise" BETWEEN 0 AND "initialPaise");
CREATE FUNCTION app.leave_booking_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.status='approved' THEN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW."salonId"::text||NEW."userId"::text,0));
  IF EXISTS(SELECT 1 FROM app."Appointment" a WHERE a."salonId"=NEW."salonId" AND a."assignedUserId"=NEW."userId" AND a.status NOT IN ('cancelled','no_show') AND a."startsAt"<NEW."endsAt" AND a."startsAt"+make_interval(mins=>a."durationMinutes")>NEW."startsAt") THEN RAISE EXCEPTION 'Reschedule conflicting appointments before approving leave'; END IF;
  IF EXISTS(SELECT 1 FROM app."LeaveRequest" l WHERE l.id<>NEW.id AND l."salonId"=NEW."salonId" AND l."userId"=NEW."userId" AND l.status='approved' AND l."startsAt"<NEW."endsAt" AND l."endsAt">NEW."startsAt") THEN RAISE EXCEPTION 'Approved leave overlaps'; END IF;
 END IF;
 IF TG_OP='UPDATE' AND OLD.status<>'pending' AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'Reviewed leave is immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER leave_booking_guard BEFORE INSERT OR UPDATE ON app."LeaveRequest" FOR EACH ROW EXECUTE FUNCTION app.leave_booking_guard();
UPDATE app."Appointment" SET "completedAt"="updatedAt" WHERE status='completed';
UPDATE app."Appointment" SET "checkedInAt"="updatedAt" WHERE status IN ('checked_in','in_service');
CREATE FUNCTION app.booking_operations_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW."assignedUserId" IS NOT NULL AND NEW.status NOT IN ('cancelled','no_show') THEN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW."salonId"::text||NEW."assignedUserId"::text,0));
  IF EXISTS(SELECT 1 FROM app."LeaveRequest" l WHERE l."salonId"=NEW."salonId" AND l."userId"=NEW."assignedUserId" AND l.status='approved' AND l."startsAt"<NEW."startsAt"+make_interval(mins=>NEW."durationMinutes") AND l."endsAt">NEW."startsAt") THEN RAISE EXCEPTION 'Team member is on approved leave'; END IF;
 END IF;
 IF cardinality(NEW."completedSteps")<>(SELECT count(DISTINCT x) FROM unnest(NEW."completedSteps") x) OR EXISTS(SELECT 1 FROM unnest(NEW."completedSteps") x WHERE x<0 OR x>=cardinality(NEW.checklist)) THEN RAISE EXCEPTION 'Invalid service checklist'; END IF;
 IF TG_OP='UPDATE' AND OLD.status IN ('completed','cancelled','no_show') AND (to_jsonb(NEW)-ARRAY['feedbackTokenHash','feedbackTokenExpiresAt','updatedAt']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['feedbackTokenHash','feedbackTokenExpiresAt','updatedAt']) THEN RAISE EXCEPTION 'Terminal appointments are immutable'; END IF;
 IF NEW.status='checked_in' AND NEW."checkedInAt" IS NULL THEN NEW."checkedInAt":=clock_timestamp(); END IF;
 IF NEW.status='completed' THEN
  IF cardinality(NEW."completedSteps")<>cardinality(NEW.checklist) THEN RAISE EXCEPTION 'Complete service checklist first'; END IF;
  IF NEW."completedAt" IS NULL THEN NEW."completedAt":=clock_timestamp(); END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER booking_operations_guard BEFORE INSERT OR UPDATE ON app."Appointment" FOR EACH ROW EXECUTE FUNCTION app.booking_operations_guard();
CREATE FUNCTION app.refund_balance_guard() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE paid bigint; refunded bigint; BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW."invoiceId"::text,1));
 SELECT coalesce(sum("amountPaise"),0) INTO paid FROM app."Payment" WHERE "invoiceId"=NEW."invoiceId" AND "salonId"=NEW."salonId";
 SELECT coalesce(sum("amountPaise"),0) INTO refunded FROM app."Refund" WHERE "invoiceId"=NEW."invoiceId" AND "salonId"=NEW."salonId";
 IF NEW."amountPaise"+refunded>paid THEN RAISE EXCEPTION 'Refund exceeds collected amount'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER refund_balance_guard BEFORE INSERT ON app."Refund" FOR EACH ROW EXECUTE FUNCTION app.refund_balance_guard();
CREATE FUNCTION app.protect_operational_history() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_TABLE_NAME='CashSession' AND OLD."closedAt" IS NOT NULL AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'Closed cash session is immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER cash_session_history BEFORE UPDATE ON app."CashSession" FOR EACH ROW EXECUTE FUNCTION app.protect_operational_history();
ALTER TABLE app."Payment" DROP CONSTRAINT IF EXISTS "Payment_method_check";
ALTER TABLE app."Payment" ADD CONSTRAINT "Payment_method_check" CHECK(method IN ('cash','upi','card','transfer','gift_card'));
-- Older invoice callers remain valid during a rolling deploy.
CREATE FUNCTION app.invoice_legacy_base() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW."basePaise"=0 AND NEW."totalPaise">0 AND NEW."taxPaise"=0 AND NEW."taxBps"=0 AND NEW."discountPaise"=0 THEN NEW."basePaise":=NEW."totalPaise"; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER invoice_legacy_base BEFORE INSERT ON app."Invoice" FOR EACH ROW EXECUTE FUNCTION app.invoice_legacy_base();

CREATE UNIQUE INDEX cash_one_open ON app."CashSession"("salonId","branchId") WHERE "closedAt" IS NULL;

ALTER TABLE app."SalonCustomer" ALTER COLUMN tags SET NOT NULL;
ALTER TABLE app."Appointment" ALTER COLUMN checklist SET NOT NULL, ALTER COLUMN "completedSteps" SET NOT NULL;
ALTER TABLE app."Service" ALTER COLUMN checklist SET NOT NULL, ALTER COLUMN "eligibleUserIds" SET NOT NULL;

ALTER TABLE app."Invoice" ALTER COLUMN "appointmentId" DROP NOT NULL;
ALTER TABLE app."InvoiceLine" ADD COLUMN "productId" uuid, ADD COLUMN "unitCostPaise" integer NOT NULL DEFAULT 0 CHECK("unitCostPaise">=0);
ALTER TABLE app."InvoiceLine" ADD CONSTRAINT invoice_line_product_fk FOREIGN KEY("productId","salonId") REFERENCES app."Product"(id,"salonId");
ALTER TABLE app."SalonMembership" DROP CONSTRAINT membership_role;
ALTER TABLE app."SalonMembership" ADD CONSTRAINT membership_role CHECK(role IN ('owner','admin','manager','staff','receptionist','inventory','accountant','cashier'));
ALTER TABLE app."Invitation" DROP CONSTRAINT invitation_role;
ALTER TABLE app."Invitation" ADD CONSTRAINT invitation_role CHECK(role IN ('admin','manager','staff','receptionist','inventory','accountant','cashier'));
CREATE UNIQUE INDEX "StockMovement_purchaseOrderId_productId_key" ON app."StockMovement"("purchaseOrderId","productId");

ALTER TABLE app."Appointment" ADD COLUMN "feedbackTokenHash" text, ADD COLUMN "feedbackTokenExpiresAt" timestamptz;
CREATE UNIQUE INDEX "Appointment_feedbackTokenHash_key" ON app."Appointment"("feedbackTokenHash");
ALTER TABLE app."Feedback" ALTER COLUMN "customerUserId" DROP NOT NULL;

ALTER TABLE app."Expense" ADD COLUMN "receiptPath" text;
ALTER TABLE app."Shift" ADD COLUMN "cancelledAt" timestamptz;
CREATE TABLE app."CalendarConnection"(id uuid PRIMARY KEY,"salonId" uuid NOT NULL REFERENCES app."Salon"(id),"userId" uuid NOT NULL,"calendarId" text NOT NULL,"accessTokenEncrypted" text NOT NULL,"refreshTokenEncrypted" text,"expiresAt" timestamptz NOT NULL,"cursorAt" timestamptz NOT NULL DEFAULT '1970-01-01T00:00:00Z',"cursorId" uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','disabled')),"lastError" text,"createdAt" timestamptz NOT NULL DEFAULT now(),"updatedAt" timestamptz NOT NULL,UNIQUE("salonId","userId"),UNIQUE(id,"salonId"),FOREIGN KEY("salonId","userId") REFERENCES app."SalonMembership"("salonId","userId"));
CREATE TABLE app."CalendarJob"(id uuid PRIMARY KEY,"salonId" uuid NOT NULL REFERENCES app."Salon"(id),"connectionId" uuid NOT NULL,"appointmentId" uuid NOT NULL,"sourceUpdatedAt" timestamptz NOT NULL,status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','processing','synced','failed')),attempts integer NOT NULL DEFAULT 0 CHECK(attempts>=0),"nextAttemptAt" timestamptz NOT NULL DEFAULT now(),"lastError" text,"createdAt" timestamptz NOT NULL DEFAULT now(),"updatedAt" timestamptz NOT NULL,UNIQUE("connectionId","appointmentId"),FOREIGN KEY("connectionId","salonId") REFERENCES app."CalendarConnection"(id,"salonId"),FOREIGN KEY("appointmentId","salonId") REFERENCES app."Appointment"(id,"salonId"));
CREATE INDEX "CalendarJob_status_nextAttemptAt_idx" ON app."CalendarJob"(status,"nextAttemptAt");
ALTER TABLE app."CalendarConnection" ENABLE ROW LEVEL SECURITY;
ALTER TABLE app."CalendarJob" ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE ON app."CalendarConnection",app."CalendarJob" TO saloonsync_runtime;
CREATE POLICY backend_runtime ON app."CalendarConnection" TO saloonsync_runtime USING(true) WITH CHECK(true);
CREATE POLICY backend_runtime ON app."CalendarJob" TO saloonsync_runtime USING(true) WITH CHECK(true);
ALTER TABLE app."Expense" ADD CONSTRAINT "Expense_submittedBy_actor_fk" FOREIGN KEY ("salonId","submittedBy") REFERENCES app."SalonMembership"("salonId","userId");
ALTER TABLE app."Expense" ADD CONSTRAINT "Expense_approvedBy_actor_fk" FOREIGN KEY ("salonId","approvedBy") REFERENCES app."SalonMembership"("salonId","userId");
ALTER TABLE app."CashSession" ADD CONSTRAINT "CashSession_openedBy_actor_fk" FOREIGN KEY ("salonId","openedBy") REFERENCES app."SalonMembership"("salonId","userId");
ALTER TABLE app."CashSession" ADD CONSTRAINT "CashSession_closedBy_actor_fk" FOREIGN KEY ("salonId","closedBy") REFERENCES app."SalonMembership"("salonId","userId");
ALTER TABLE app."LeaveRequest" ADD CONSTRAINT "LeaveRequest_reviewedBy_actor_fk" FOREIGN KEY ("salonId","reviewedBy") REFERENCES app."SalonMembership"("salonId","userId");
ALTER TABLE app."DailyTask" ADD CONSTRAINT "DailyTask_completedBy_actor_fk" FOREIGN KEY ("salonId","completedBy") REFERENCES app."SalonMembership"("salonId","userId");
ALTER TABLE app."StockMovement" ADD CONSTRAINT "StockMovement_actorUserId_actor_fk" FOREIGN KEY ("salonId","actorUserId") REFERENCES app."SalonMembership"("salonId","userId");
ALTER TABLE app."PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_requestedBy_actor_fk" FOREIGN KEY ("salonId","requestedBy") REFERENCES app."SalonMembership"("salonId","userId");
ALTER TABLE app."PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_approvedBy_actor_fk" FOREIGN KEY ("salonId","approvedBy") REFERENCES app."SalonMembership"("salonId","userId");
ALTER TABLE app."Refund" ADD CONSTRAINT "Refund_approvedBy_actor_fk" FOREIGN KEY ("salonId","approvedBy") REFERENCES app."SalonMembership"("salonId","userId");
ALTER TABLE app."PortfolioPhoto" ADD CONSTRAINT "PortfolioPhoto_uploadedBy_actor_fk" FOREIGN KEY ("salonId","uploadedBy") REFERENCES app."SalonMembership"("salonId","userId");
ALTER TABLE app."Campaign" ADD CONSTRAINT "Campaign_createdBy_actor_fk" FOREIGN KEY ("salonId","createdBy") REFERENCES app."SalonMembership"("salonId","userId");
ALTER TABLE app."LoyaltyEntry" ADD CONSTRAINT "LoyaltyEntry_actorUserId_actor_fk" FOREIGN KEY ("salonId","actorUserId") REFERENCES app."SalonMembership"("salonId","userId");
ALTER TABLE app."Feedback" ADD CONSTRAINT feedback_identity_fk FOREIGN KEY("customerUserId") REFERENCES app."User"(id);
CREATE FUNCTION app.expense_history_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF OLD.status<>'pending' AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'Reviewed expenses are immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER expense_history_guard BEFORE UPDATE ON app."Expense" FOR EACH ROW EXECUTE FUNCTION app.expense_history_guard();
CREATE FUNCTION app.purchase_history_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF OLD.status IN ('received','rejected') AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'Finalized purchase history is immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER purchase_history_guard BEFORE UPDATE ON app."PurchaseOrder" FOR EACH ROW EXECUTE FUNCTION app.purchase_history_guard();

ALTER TABLE app."Expense" ADD CHECK((status='pending' AND "approvedBy" IS NULL) OR (status<>'pending' AND "approvedBy" IS NOT NULL));
ALTER TABLE app."LeaveRequest" ADD CHECK((status='pending' AND "reviewedBy" IS NULL AND "reviewedAt" IS NULL) OR (status<>'pending' AND "reviewedBy" IS NOT NULL AND "reviewedAt" IS NOT NULL AND "reviewedBy"<>"userId"));
ALTER TABLE app."PurchaseOrder" ADD CHECK((status='received')=("receivedAt" IS NOT NULL)), ADD CHECK(status NOT IN ('approved','received') OR "approvedBy" IS NOT NULL);

COMMIT;
