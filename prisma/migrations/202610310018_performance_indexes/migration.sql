-- Additive read-path indexes. Intended for the restored Mumbai database; the
-- Seoul fallback remains read-only. Before applying to a busy populated server,
-- build these with CREATE INDEX CONCURRENTLY outside a transaction instead.
CREATE INDEX IF NOT EXISTS "Invoice_scope_recent_idx" ON app."Invoice" ("salonId","branchId","createdAt" DESC,id DESC);
CREATE INDEX IF NOT EXISTS "Invoice_customer_idx" ON app."Invoice" ("salonId","salonCustomerId");
CREATE INDEX IF NOT EXISTS "Expense_scope_recent_idx" ON app."Expense" ("salonId","branchId","incurredAt" DESC,id DESC);
CREATE INDEX IF NOT EXISTS "CashSession_scope_recent_idx" ON app."CashSession" ("salonId","branchId","createdAt" DESC,id DESC);
CREATE INDEX IF NOT EXISTS "Refund_scope_recent_idx" ON app."Refund" ("salonId","branchId","createdAt" DESC,id DESC);
CREATE INDEX IF NOT EXISTS "Appointment_scope_status_recent_idx" ON app."Appointment" ("salonId","branchId",status,"startsAt" DESC,id DESC);
CREATE INDEX IF NOT EXISTS "LoyaltyAccount_scope_recent_idx" ON app."LoyaltyAccount" ("salonId","updatedAt" DESC,id DESC);
CREATE INDEX IF NOT EXISTS "LoyaltyEntry_customer_recent_idx" ON app."LoyaltyEntry" ("salonId","customerId","createdAt" DESC,id DESC);
CREATE INDEX IF NOT EXISTS "InvoiceLine_receipt_idx" ON app."InvoiceLine" ("salonId","invoiceId","createdAt",id);
CREATE INDEX IF NOT EXISTS "Service_checkout_idx" ON app."Service" ("salonId",active,name,id);
CREATE INDEX IF NOT EXISTS "StaffProfile_directory_idx" ON app."StaffProfile" ("salonId","displayName",id);
CREATE INDEX IF NOT EXISTS "Invitation_latest_profile_idx" ON app."Invitation" ("salonId","staffProfileId","createdAt" DESC);
