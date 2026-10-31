# Salon workspace implementation — 29 October 2026

Historical core-release notes: the later feature expansion supersedes the feature gaps, branch restrictions and test counts below. See [current feature coverage](feature-coverage.md) and [integration setup](integration-setup.md).

The salon app now follows the supplied sidebar/calendar reference while retaining the existing Saloonsync authentication experience. Production pages read real database data; sample names appear only in the rendering test and its screenshots.

## Routes and feature boundaries

| Route | Implemented behavior |
|---|---|
| `/salon` | Today’s scoped visits, customer/team counts, branch list and quick actions |
| `/salon/appointments` | Date navigation, day/list views, staff columns, booking creation, rescheduling, check-in, start, complete, cancellation and no-show |
| `/salon/customers` | Create and search salon-local customer profiles with phone and notes |
| `/salon/services` | Service creation, categories, duration and price; staff see services from assigned visits |
| `/salon/team` | Current members, branch scope, existing secure invitations and ownership transfer |
| `/salon/billing` | Invoice completed visits and record separate cash/UPI/card/transfer payments, including partial payments |
| `/salon/inventory` | Product catalog, stock thresholds, audited stock adjustments |
| `/salon/reports` | Last-30-day invoice, collection and booking summaries; inventory role receives stock-only reports |
| `/salon/settings` | Salon name, branch list and recent audit activity |

Each feature has its own route file. Shared presentation is in `src/components/salon`; workspace context, module policy and input validation are in `src/lib/salon`; mutations are in `src/server/salon-actions.ts`.

## Roles and tenant boundaries

Owner and admin have broad operational access; ownership transfer remains owner-only. Manager has operational access without invitation or ownership privileges. Receptionist has bookings, customers, service viewing and POS. Staff have assigned appointments and associated service catalog entries. Inventory and accountant presets have their respective module access, enforced on the server and reflected in navigation.

Global customer, billing, stock and reporting operations conservatively require an all-branch membership. Selected-branch members can use authorized booking and team views, but cannot access salon-wide financial/customer lists. Detailed delegated permissions and per-branch financial reports are not implemented.

Every action verifies origin and reloads the active user and membership through the server context. IDs supplied by forms are checked within the selected salon/branch. Appointment transitions use conditional updates; terminal visits cannot be reopened through these actions. Rescheduling preserves the booked service price and duration.

The workspace cookie remains shared within a browser profile. This does not add per-tab account sessions.

## Supabase database

Migrations `202610290009_salon_operations` and `202610290010_payment_lock` were applied successfully to the configured Supabase database. They add Service, Product, Invoice and Payment, extend salon-local customers and appointments, and add receptionist/inventory/accountant membership and invitation roles. Existing records are preserved.

Composite foreign keys prevent cross-salon customer, invoice and payment references. PostgreSQL triggers serialize writes per stylist/invoice to reject overlapping active bookings and overpayment. Stock cannot go negative. Money is stored in integer paise and entered/displayed in rupees. Bookings preserve service name, duration and price at creation; invoices preserve the corresponding completed-visit values.

New tables have RLS enabled and no policies for browser Data API roles. The existing backend-only runtime role has a permissive backend policy; tenant authorization therefore remains enforced by server checks, not by per-user RLS policies. Never expose runtime database credentials to a browser. The runtime cannot update invoices/payments or modify audit history. This is defense in depth, not a claim that the application is independently security-certified.

Read-only live verification: `npx tsx scripts/verify-salon-database.ts` checked all four tables, RLS, booking/payment triggers and immutable financial grants successfully.

## Verification

- 138 unit tests passed, including mutation origin checks, tenant lookup boundaries, staff restrictions, role visibility, validation, payment currency conversion and rendering.
- 27 PostgreSQL integration tests passed, including cross-tenant customer links, scheduling overlaps, adjacent slots, overpayments, browser-role denial and payment insertion with the restricted runtime role.
- 50 Playwright security checks passed across desktop/mobile, including anonymous access to all new routes, private API denial and cross-origin rejection.
- Desktop (1440px) and phone (390px) fixture screenshots were captured and visually reviewed; neither produced document overflow. These render the real calendar/shell with mocked data and actions, not an authenticated live booking workflow.
- The final production build, TypeScript compilation and Prisma schema validation passed.

A signed-in browser workflow using test owner/staff accounts is still needed to validate booking → completion → invoice → payment through the UI. No test accounts or fake appointments were inserted into the live database for these checks. Concurrency was tested through database constraints and serialized fixtures, not a live simultaneous-request load test.

## Explicit remaining scope

This is a core operational release, not every feature in the specification. Remaining items include a public customer self-booking flow, separate employee profiles without login, working hours and leave, configurable service eligibility, packages/add-ons, tax/discount/refund handling, supplier purchasing, notification delivery, exports, loyalty, marketing, calendar synchronization and broader delegated permissions. No card is charged by the payment-recording form.

List queries are bounded (calendar 300 visits/day, team 50 calendar columns, customer selector 500, customers/invoices 100, services/products 200); pagination and large-salon load testing remain necessary before claiming support for larger data volumes. Invoice totals currently equal booked service prices; taxes and discounts are not implied. Customer portal bookings are linked only when an appointment has a verified `customerUserId`; a salon-local walk-in record is not automatically attached to an email/login account.
