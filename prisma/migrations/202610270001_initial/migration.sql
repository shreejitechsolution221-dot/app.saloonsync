-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "app";

-- CreateTable
CREATE TABLE "app"."User" (
    "id" UUID NOT NULL,
    "displayName" TEXT NOT NULL,
    "disabledAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."Salon" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "onboardingKey" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Salon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."Branch" (
    "id" UUID NOT NULL,
    "salonId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."SalonMembership" (
    "id" UUID NOT NULL,
    "salonId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "branchScope" TEXT NOT NULL DEFAULT 'all',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "SalonMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."MembershipBranchAccess" (
    "membershipId" UUID NOT NULL,
    "salonId" UUID NOT NULL,
    "branchId" UUID NOT NULL,

    CONSTRAINT "MembershipBranchAccess_pkey" PRIMARY KEY ("membershipId","branchId")
);

-- CreateTable
CREATE TABLE "app"."PlatformPrivilege" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "privilege" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "grantedBy" UUID,
    "grantedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMPTZ,

    CONSTRAINT "PlatformPrivilege_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."CustomerProfile" (
    "userId" UUID NOT NULL,
    "phone" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "CustomerProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "app"."SalonCustomer" (
    "id" UUID NOT NULL,
    "salonId" UUID NOT NULL,
    "userId" UUID,
    "displayName" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "SalonCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."Invitation" (
    "id" UUID NOT NULL,
    "salonId" UUID NOT NULL,
    "intendedEmail" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "branchScope" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "invitedBy" UUID NOT NULL,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "acceptedAt" TIMESTAMPTZ,
    "revokedAt" TIMESTAMPTZ,
    "acceptedBy" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."InvitationBranchAccess" (
    "invitationId" UUID NOT NULL,
    "salonId" UUID NOT NULL,
    "branchId" UUID NOT NULL,

    CONSTRAINT "InvitationBranchAccess_pkey" PRIMARY KEY ("invitationId","branchId")
);

-- CreateTable
CREATE TABLE "app"."ConsentRecord" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "documentType" TEXT NOT NULL,
    "documentVersion" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "acceptedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawnAt" TIMESTAMPTZ,

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."AuditEvent" (
    "id" UUID NOT NULL,
    "actorUserId" UUID,
    "salonId" UUID,
    "branchId" UUID,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "occurredAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."Appointment" (
    "id" UUID NOT NULL,
    "salonId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "customerUserId" UUID NOT NULL,
    "assignedUserId" UUID,
    "startsAt" TIMESTAMPTZ NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'confirmed',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app"."RateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "resetsAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "Salon_slug_key" ON "app"."Salon"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Salon_onboardingKey_key" ON "app"."Salon"("onboardingKey");

-- CreateIndex
CREATE INDEX "Branch_salonId_status_idx" ON "app"."Branch"("salonId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Branch_id_salonId_key" ON "app"."Branch"("id", "salonId");

-- CreateIndex
CREATE INDEX "SalonMembership_userId_status_idx" ON "app"."SalonMembership"("userId", "status");

-- CreateIndex
CREATE INDEX "SalonMembership_salonId_status_role_idx" ON "app"."SalonMembership"("salonId", "status", "role");

-- CreateIndex
CREATE UNIQUE INDEX "SalonMembership_salonId_userId_key" ON "app"."SalonMembership"("salonId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "SalonMembership_id_salonId_key" ON "app"."SalonMembership"("id", "salonId");

-- CreateIndex
CREATE INDEX "MembershipBranchAccess_branchId_salonId_idx" ON "app"."MembershipBranchAccess"("branchId", "salonId");

-- CreateIndex
CREATE INDEX "PlatformPrivilege_userId_status_idx" ON "app"."PlatformPrivilege"("userId", "status");

-- CreateIndex
CREATE INDEX "PlatformPrivilege_grantedBy_idx" ON "app"."PlatformPrivilege"("grantedBy");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformPrivilege_userId_privilege_key" ON "app"."PlatformPrivilege"("userId", "privilege");

-- CreateIndex
CREATE INDEX "SalonCustomer_salonId_userId_idx" ON "app"."SalonCustomer"("salonId", "userId");

-- CreateIndex
CREATE INDEX "SalonCustomer_userId_idx" ON "app"."SalonCustomer"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SalonCustomer_id_salonId_key" ON "app"."SalonCustomer"("id", "salonId");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "app"."Invitation"("tokenHash");

-- CreateIndex
CREATE INDEX "Invitation_salonId_intendedEmail_expiresAt_idx" ON "app"."Invitation"("salonId", "intendedEmail", "expiresAt");

-- CreateIndex
CREATE INDEX "Invitation_invitedBy_idx" ON "app"."Invitation"("invitedBy");

-- CreateIndex
CREATE INDEX "Invitation_acceptedBy_idx" ON "app"."Invitation"("acceptedBy");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_id_salonId_key" ON "app"."Invitation"("id", "salonId");

-- CreateIndex
CREATE INDEX "InvitationBranchAccess_branchId_salonId_idx" ON "app"."InvitationBranchAccess"("branchId", "salonId");

-- CreateIndex
CREATE UNIQUE INDEX "ConsentRecord_userId_documentType_documentVersion_purpose_key" ON "app"."ConsentRecord"("userId", "documentType", "documentVersion", "purpose");

-- CreateIndex
CREATE INDEX "AuditEvent_salonId_occurredAt_idx" ON "app"."AuditEvent"("salonId", "occurredAt");

-- CreateIndex
CREATE INDEX "AuditEvent_actorUserId_idx" ON "app"."AuditEvent"("actorUserId");

-- CreateIndex
CREATE INDEX "AuditEvent_branchId_salonId_idx" ON "app"."AuditEvent"("branchId", "salonId");

-- CreateIndex
CREATE INDEX "Appointment_salonId_branchId_startsAt_idx" ON "app"."Appointment"("salonId", "branchId", "startsAt");

-- CreateIndex
CREATE INDEX "Appointment_branchId_salonId_idx" ON "app"."Appointment"("branchId", "salonId");

-- CreateIndex
CREATE INDEX "Appointment_customerUserId_startsAt_idx" ON "app"."Appointment"("customerUserId", "startsAt");

-- CreateIndex
CREATE INDEX "RateLimit_resetsAt_idx" ON "app"."RateLimit"("resetsAt");

-- AddForeignKey
ALTER TABLE "app"."Branch" ADD CONSTRAINT "Branch_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "app"."Salon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."SalonMembership" ADD CONSTRAINT "SalonMembership_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "app"."Salon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."SalonMembership" ADD CONSTRAINT "SalonMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "app"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."MembershipBranchAccess" ADD CONSTRAINT "MembershipBranchAccess_membershipId_salonId_fkey" FOREIGN KEY ("membershipId", "salonId") REFERENCES "app"."SalonMembership"("id", "salonId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."MembershipBranchAccess" ADD CONSTRAINT "MembershipBranchAccess_branchId_salonId_fkey" FOREIGN KEY ("branchId", "salonId") REFERENCES "app"."Branch"("id", "salonId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."PlatformPrivilege" ADD CONSTRAINT "PlatformPrivilege_userId_fkey" FOREIGN KEY ("userId") REFERENCES "app"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."PlatformPrivilege" ADD CONSTRAINT "PlatformPrivilege_grantedBy_fkey" FOREIGN KEY ("grantedBy") REFERENCES "app"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."CustomerProfile" ADD CONSTRAINT "CustomerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "app"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."SalonCustomer" ADD CONSTRAINT "SalonCustomer_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "app"."Salon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."SalonCustomer" ADD CONSTRAINT "SalonCustomer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "app"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."Invitation" ADD CONSTRAINT "Invitation_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "app"."Salon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."Invitation" ADD CONSTRAINT "Invitation_invitedBy_fkey" FOREIGN KEY ("invitedBy") REFERENCES "app"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."Invitation" ADD CONSTRAINT "Invitation_acceptedBy_fkey" FOREIGN KEY ("acceptedBy") REFERENCES "app"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."InvitationBranchAccess" ADD CONSTRAINT "InvitationBranchAccess_invitationId_salonId_fkey" FOREIGN KEY ("invitationId", "salonId") REFERENCES "app"."Invitation"("id", "salonId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."InvitationBranchAccess" ADD CONSTRAINT "InvitationBranchAccess_branchId_salonId_fkey" FOREIGN KEY ("branchId", "salonId") REFERENCES "app"."Branch"("id", "salonId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."ConsentRecord" ADD CONSTRAINT "ConsentRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "app"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."AuditEvent" ADD CONSTRAINT "AuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "app"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."AuditEvent" ADD CONSTRAINT "AuditEvent_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "app"."Salon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."AuditEvent" ADD CONSTRAINT "AuditEvent_branchId_salonId_fkey" FOREIGN KEY ("branchId", "salonId") REFERENCES "app"."Branch"("id", "salonId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."Appointment" ADD CONSTRAINT "Appointment_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "app"."Salon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."Appointment" ADD CONSTRAINT "Appointment_branchId_salonId_fkey" FOREIGN KEY ("branchId", "salonId") REFERENCES "app"."Branch"("id", "salonId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app"."Appointment" ADD CONSTRAINT "Appointment_customerUserId_fkey" FOREIGN KEY ("customerUserId") REFERENCES "app"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
