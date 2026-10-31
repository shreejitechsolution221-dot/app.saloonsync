# Feature coverage — 29 October 2026

This supersedes the remaining-scope and verification sections in salon-workspace-implementation.md. Reviewed against the supplied features.pdf and the additional feature list. Implemented means application code and database support; external integrations require the configuration described in integration-setup.md.

| Feature | Location and coverage |
| --- | --- |
| Business insights | Dashboard → Insights: revenue trends, busy hours, top services; calculated insights, not AI forecasts |
| Retention tracker | Customers → Retention: configurable inactive/rebooking intervals |
| Expenses and profit | Billing → Expenses and Reports: reviewed expenses and operating estimates |
| Revenue targets | Dashboard insights: daily, weekly, monthly targets |
| Staff commissions | Team performance: eligible completed-service commission snapshots |
| Remote monitoring | Dashboard: bookings, collections, activity; visible-page refresh every 30 seconds |
| Live queue | Appointments → Queue: check-in, waiting time, assigned staff |
| Recurring appointments | New appointment: atomic series, up to 12 visits |
| WhatsApp actions | Opt-in confirmation, reminder, feedback and campaign jobs; approved Twilio templates and worker configuration required |
| Daily checklist | Dashboard tasks; templates in Settings → Tasks |
| Quick walk-in | Appointments → Walk-in: minimal customer entry |
| No-shows | Appointments → No-shows; configurable recent no-show booking limit |
| Attendance and shifts | Team → Attendance/Schedule: clock, breaks, history and overtime estimates |
| Leave | Team → Leave: requests, review, scheduling conflict checks; no self-approval |
| Personal performance | Team → Performance: completed services, feedback, estimated commission |
| Customer portfolio | Customer/visit detail: consent-gated private images; storage configuration required |
| Service checklists | Service templates and visit completion steps |
| Barcode scanning | Inventory/POS barcode lookup with keyboard or USB scanner; no camera scanner |
| Service stock usage | Inventory → Usage: configured recipes, opt-in deduction on completion |
| Purchase approvals | Inventory → Purchases: approval and once-only receipt; single-product request form |
| Expense management | Categories, receipts, approval; private storage required for receipt images |
| Cash reconciliation | Billing → Cash: opening balance, recorded cash, closing variance |
| Feedback | Marketing feedback and expiring, single-use completed-visit links |
| Personalized offers | Marketing offers and consent-based campaign queue; no autonomous AI targeting |
| Rebooking suggestions | Retention lists and configured rebooking message templates |

## Workspace, profile and access

Settings includes personal profile, locations, business rules, tasks and integrations. The workspace selector filters by authorized location or all authorized locations. Reports can combine all active salon businesses currently owned by the signed-in user, with fresh ownership checks. Location stock, financial records and customer visibility respect authorized branch scope.

URLs identify resources; they never establish identity or grant access. Every server request verifies the authenticated session, active membership, role and resource scope. Different browser profiles/devices may have different accounts. Tabs in one browser profile share its login and workspace cookies; independent simultaneous accounts in the same profile are not implemented. Database runtime credentials and service-role keys remain server-only. New feature tables have RLS and deny browser roles; backend authorization supplies tenant isolation. This is not independent security certification.

## Other PDF coverage and remaining work

Implemented core modules include appointments, customers, catalog, staff/invitations, invoices and partial payments, printable receipts, refunds, retail product sales, inventory movements/transfers, suppliers, reports/CSV, audit activity and preset role/branch permissions. Staff records can be created without login. Customer records include birthday, tags, consent and visit history. Loyalty includes manually managed points, referral codes and membership labels. Gift cards use hashed redemption codes. Google Calendar has one-way secondary-calendar sync and retryable jobs; ICS export is available.

The following broader roadmap items are **not complete**: public self-service booking, prepaid multi-visit entitlement accounting, recurring membership billing, multi-service/product checkout baskets, arbitrary custom permission builders, AI assistant/predictive forecasting, platform subscription checkout, camera barcode scanning and provider delivery-status webhooks. A service marked package/add-on is a catalog classification, not prepaid entitlement accounting. Calendar OAuth and WhatsApp delivery have not been exercised with live provider credentials.

Operating profit is an estimate from recorded revenue, refund allocation and approved expenses, not statutory accounts. Enter costs to make it useful. Commission snapshots do not implement payroll or automatically reverse after discounts/refunds. Attendance overtime is an estimate, not wage calculation. Business hours currently use the application's India time conventions rather than per-location timezones.

## Verification boundaries

183 unit tests, 47 PostgreSQL integration tests and 128 production-browser access checks passed, including cross-tenant references, overlap/leave checks, immutable ledgers, overpayment/refund protection, location stock consistency and atomic multi-product deductions. The Node 24 production build and Prisma schema validation passed. Responsive fixture screens cover 13 feature views at desktop/phone sizes without document overflow. Fixtures render real views with mock data and do not prove a signed-in browser workflow. Read-only live checks verified the 28 new tables and combined reporting across two currently owned businesses; a measured dashboard query took 234 ms (one measurement, not a load benchmark).

Migrations 202610290012, 202610290013 and 202610290014 were applied to Supabase. No fake customer or financial records were inserted into the live database. Signed-in owner/staff acceptance testing and simultaneous-request production load testing remain necessary before a public launch.
