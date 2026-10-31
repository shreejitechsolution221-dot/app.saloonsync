# Workspace performance improvements — 29 October 2026

Follow-up: [navigation improvements and measured profile/workspace concurrency](performance/NAVIGATION.md).

## Changes

Removed the `/salon/loading.tsx` fallback, including the “Getting your workspace ready…” screen. This removes the interstitial; it does not disguise outstanding network or database work with a different spinner.

The request-scoped workspace resolver now uses one parameterized PostgreSQL statement for current active membership, active salon and permitted active branches. The prior chain loaded memberships, reloaded the chosen membership with relations, and separately fetched branches. Supabase identity verification and current disabled-account checks are retained. Workspace selection still requires an authorized cookie or exactly one active membership. There is no cross-request cache of user permissions or private data.

Calendar views fetch appointments and staff. Customer/service booking choices load only on `/salon/appointments/new`, when the user explicitly opens booking creation. That link disables prefetch so a background prefetch does not reintroduce the expensive option-list query. Calendar and overview appointment queries select only rendered fields.

Migration `202610290011_workspace_query_indexes` was applied to Supabase. Added indexes:

- Appointment: salon + date, salon + assigned user + date, salon + local customer.
- SalonCustomer: salon + display name (ordering, not arbitrary substring search acceleration).
- Payment: invoice ID (balances and invoice payment history).

No records, credentials, role grants or RLS policies were changed by this migration. The prior generated-client cache fix remains in place; `npm run dev` regenerates Prisma before startup.

## Measurement

`scripts/benchmark-workspace.ts` compares the old database lookup chain with the new query using existing data and read-only requests. It verifies both return the same allowed branch IDs without printing identity or customer data.

Measured over three warmed samples against the configured Supabase instance:

| Lookup | Median |
|---|---:|
| Previous | 806 ms |
| Optimized | 202 ms |

This is about 75% less time for the workspace database lookup. It is not a full-page benchmark, a load test or a guarantee across networks. Authentication, rendering, browser navigation and development compilation are excluded. The benchmark preceded index application, so the measured improvement comes from consolidating the lookup rather than a claimed index speedup.

## Verification and operational notes

- 141 unit tests passed; the calendar rendering test was rerun after adding assertions that customer/service option queries are not executed.
- 36 database integration tests passed. The added query tests cover multi-workspace selection, revoked membership, disabled account, suspended salon/branches, forged cookies, SQL injection, foreign branch grants and invalid branch scopes.
- Production build and TypeScript compilation passed. All 52 desktop/mobile access-control checks passed.
- A separate production-mode smoke check confirmed `/salon`, `/salon/appointments` and `/salon/appointments/new` return the expected HTTP 307 login redirect for an anonymous browser, without the removed loading text or error screen. The temporary production smoke-test server was stopped afterward; the existing development server remains available on port 3000.
- A production deployment should run the build/start scripts, not `next dev`; development mode compiles routes on demand and has additional overhead.
- No private-data authorization checks were removed to improve timings. Signed-in browser checkout and sustained multi-user load testing remain separate verification work.
