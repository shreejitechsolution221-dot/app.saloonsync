# Mumbai transfer and billing verification — 31 October 2026

The local application now uses the Mumbai project, with its transaction pooler and a restricted runtime role. DIRECT_URL points to the new direct migration connection. The original Seoul project was used read-only and remains available as a fallback.

## Data verification

- 75 app/Auth data tables have matching full row-content digests, not just matching counts.
- 3 users, 2 salons, 4 branches, the existing invoice and all loyalty/history records were preserved.
- All 18 app migrations are applied on Mumbai. Seoul retains its original 17; the extra migration adds performance indexes. Auth-managed migration metadata was not overwritten.
- The 9,963 email-policy rows match exactly. They were reproduced by the migrations and independently hash-checked to avoid duplicate COPY inserts.
- The source has no extra public/application tables. Other schemas are provider-managed realtime/storage/Vault schemas. Storage has no buckets/objects, and Vault has no secrets.
- The existing verified TOTP factor is copied unchanged. A format-only check confirmed portable base32 material, so no project encryption key is needed for this factor. No secret value was printed, no factor was removed, and MFA was not disabled. GoTrue supports this portable format through its GetSecret fallback: https://github.com/supabase/auth/blob/master/internal/models/factor.go

## Live database write checks

These used the actual restricted Mumbai role and Prisma driver. Every diagnostic transaction was rolled back; they did not create lasting bills, payments or points.

| Check | Result |
|---|---|
| direct invoice, lines, cash payment and audit | Passed |
| atomic loyalty award | Passed |
| record payment on the copied invoice | Passed |
| overpayment rejected with a clear message | Passed |
| loyalty code and redemption | Passed |

The overpayment test reproduced Prisma's P2039 / PostgreSQL P0001 rejection, previously hidden by the generic save message. The app now explains that the payment exceeds the remaining balance. The payment drawer is recreated when its balance changes, preventing a previously entered amount from being reused against an updated balance. Other save failures log only safe operation/error codes, never SQL parameters or provider messages containing private values.

Loyalty awards and code redemption passed against the existing copied loyalty account. Additional awards preserve an existing membership label when the optional label is left blank.

## Billing interface

- Create direct bill opens in a right-side drawer. The old inline walk-in section is removed.
- /salon/billing#direct-bill still opens the drawer; closing it clears that hash so reopening works.
- Invoice cards now group the customer/date, service, bill/paid/balance figures, charge breakdown, receipt and payment actions.
- Record payment and completed-appointment invoicing use right-side drawers too.
- Loyalty management is linked from the billing desk; redeemed points are identified on invoice cards.

The portable PostgreSQL 17.11 tools are retained only under the ignored .cache/tools folder. No system database server was installed. The native snapshot is retained privately under .cache/region-transfer; it contains account backup data and must not be published.

After the region change, sign in again at http://localhost:3000/salon/login using the same account credentials. Public client bundles were rebuilt for the new project. Provider-level SMTP, redirect allowlists and signup-hook settings are not SQL table data and should still be checked in the Supabase dashboard. A signed-in browser checkout with the user's credentials was not performed; the live database paths above were verified using rollback-only checks.

## Per-table data content verification

| Table | Rows | Content matches |
|---|---:|---|
| app.Appointment | 2 | Yes |
| app.Attendance | 0 | Yes |
| app.AuditEvent | 26 | Yes |
| app.Branch | 4 | Yes |
| app.CalendarConnection | 0 | Yes |
| app.CalendarJob | 0 | Yes |
| app.Campaign | 0 | Yes |
| app.CashSession | 0 | Yes |
| app.CommissionEntry | 0 | Yes |
| app.ConsentRecord | 2 | Yes |
| app.CustomerProfile | 2 | Yes |
| app.DailyTask | 0 | Yes |
| app.EmailBlockedDomain | 9963 | Yes |
| app.Expense | 0 | Yes |
| app.Feedback | 0 | Yes |
| app.GiftCard | 0 | Yes |
| app.Invitation | 1 | Yes |
| app.InvitationBranchAccess | 1 | Yes |
| app.Invoice | 1 | Yes |
| app.InvoiceLine | 1 | Yes |
| app.LeaveRequest | 0 | Yes |
| app.LocationStock | 0 | Yes |
| app.LoyaltyAccount | 1 | Yes |
| app.LoyaltyEntry | 1 | Yes |
| app.LoyaltyRedemption | 0 | Yes |
| app.MembershipBranchAccess | 1 | Yes |
| app.MessageJob | 0 | Yes |
| app.Offer | 0 | Yes |
| app.Payment | 0 | Yes |
| app.PlatformPrivilege | 3 | Yes |
| app.PortfolioPhoto | 0 | Yes |
| app.Product | 0 | Yes |
| app.PurchaseLine | 0 | Yes |
| app.PurchaseOrder | 0 | Yes |
| app.RateLimit | 31 | Yes |
| app.Refund | 0 | Yes |
| app.RevenueTarget | 0 | Yes |
| app.Salon | 2 | Yes |
| app.SalonCustomer | 2 | Yes |
| app.SalonMembership | 3 | Yes |
| app.SalonSubscription | 0 | Yes |
| app.Service | 1 | Yes |
| app.ServiceProduct | 0 | Yes |
| app.Shift | 0 | Yes |
| app.StaffProfile | 1 | Yes |
| app.StockMovement | 0 | Yes |
| app.Supplier | 0 | Yes |
| app.TaskTemplate | 0 | Yes |
| app.User | 3 | Yes |
| auth.audit_log_entries | 0 | Yes |
| auth.custom_oauth_providers | 0 | Yes |
| auth.flow_state | 16 | Yes |
| auth.identities | 3 | Yes |
| auth.instances | 0 | Yes |
| auth.mfa_amr_claims | 8 | Yes |
| auth.mfa_challenges | 1 | Yes |
| auth.mfa_factors | 1 | Yes |
| auth.mfa_recovery_code_sets | 0 | Yes |
| auth.mfa_recovery_codes | 0 | Yes |
| auth.oauth_authorizations | 0 | Yes |
| auth.oauth_client_states | 0 | Yes |
| auth.oauth_clients | 0 | Yes |
| auth.oauth_consents | 0 | Yes |
| auth.one_time_tokens | 0 | Yes |
| auth.refresh_tokens | 14 | Yes |
| auth.saml_providers | 0 | Yes |
| auth.saml_relay_states | 0 | Yes |
| auth.scim_tokens | 0 | Yes |
| auth.scim_users | 0 | Yes |
| auth.sessions | 8 | Yes |
| auth.sso_domains | 0 | Yes |
| auth.sso_providers | 0 | Yes |
| auth.users | 3 | Yes |
| auth.webauthn_challenges | 0 | Yes |
| auth.webauthn_credentials | 0 | Yes |
