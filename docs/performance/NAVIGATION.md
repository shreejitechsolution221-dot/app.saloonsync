# Salon navigation improvements — 29 October 2026

## Follow-up — 30 October 2026

The current stable implementation supersedes the profile/workspace query description below: `salonContext` now reads the projected profile and existing authorized workspace SQL together in one parameterized statement. Fresh provider identity verification still happens first; disabled users are rejected, missing profiles retain provisioning, and schema readiness and location-cookie validation remain. Only React request memoization is used for private authorization lookups. No Prisma preview features, schema changes, connection URL changes, TLS changes or migrations were applied.

The workspace selector and customer bookings use bounded SQL joins with explicit columns, eliminating Prisma's separate relation round trips. The selector checks membership, salon and branch grant tenant IDs. Customer bookings remain filtered by the verified customer ID. Staff service visibility uses an `EXISTS` predicate against their same-salon assigned appointments instead of downloading appointment history. Administrators retain the full bounded catalog. Directory, billing, supplier and purchase-line projections return only rendered fields. Team member names load concurrently with section data; purchase-order lines begin as soon as orders arrive while supplier/product selectors continue. Dependent attendance/shift and customer/consent reads retain their ordering.

Measured from local Node 24.22.1 to the configured Supabase Seoul (`ap-northeast-2`) session pooler, port 5432, with certificate-verified TLS, pool max 5, one benchmark process, five alternating warm samples per shape:

| Database read shape | Previous median | Current median | SQL queries before → after |
| --- | ---: | ---: | ---: |
| Profile + workspace, previously parallel | 183 ms | 183 ms | 2 → 1 |
| Workspace selector including locations | 614 ms | 205 ms | 3 → 1 |
| Customer bookings including salon/branch labels | 352 ms | 175 ms | 3 → 1 |

These are bounded read-only query measurements on existing data, not page-navigation, load, p75 or capacity measurements. The customer fixture may have fewer records than a busy real customer. Database tier, representative dataset size and production latency were not established. The context change reduces pool demand without demonstrating a latency improvement. Earlier cold connection/`SELECT 1` measurements of 1.6–2.1 seconds and warm reads around 170–328 ms indicate substantial network/connection overhead; this work does not establish that every query is below 200 ms. Login includes provider/network and security rate-limit dependencies that must not be bypassed.

Current verification: TypeScript checking, 229 unit tests and 54 disposable PostgreSQL integration tests, including disabled/foreign user handling, selected branch grants, scoped service visibility, bound parameters and concurrent query starts. An optimized production build is also checked. 128 anonymous desktop/mobile access checks passed and cover route protection, not signed-in business actions or authenticated transition timing. Existing React static-render test key warnings remain unrelated to these query changes.

Operator decisions: no environment change is required for this patch. For a materially lower remote latency floor, consider locating the API/application compute near the existing database, or evaluate a separately reviewed database-region migration. Do not change URLs or Supabase regions blindly. The current URL is a session pooler, not port-6543 transaction pooling; Prisma 7's pg adapter uses driver pool settings and unnamed statements here, so legacy URL flags are not a substitute for adapter configuration. The index proposal under `prisma/proposed-migrations/` remains review-only and was not executed.

## Changes

The salon context still verifies the provider identity with Supabase getUser before any tenant lookup. It then starts the current application profile/disabled-account check, schema readiness and tenant membership/location query concurrently. It waits for all checks before returning a context. The profile check is not cached across requests, and neither a cookie nor prefetched data grants mutation permission. React.cache reuses the verified identity within the same server render so the refactor does not add a second provider request.

Desktop/sidebar, mobile menu and subsection links now use a small NavigationLink client component. Full dynamic-page prefetch starts on hover or keyboard focus, rather than fetching all menu destinations on page load. Active destinations and expensive new-booking/export tabs do not warm. Existing Link/client-side navigation behavior remains. No full-page spinner/loading interstitial or shared business-response cache was added. Normal Next router invalidation and server-side authorization still apply; a prefetched page is a previously authorized snapshot, not a new authorization mechanism.

The administrator Services page loads the catalog and staff selector in parallel. Staff still see only active services matching their assigned visits; that dependency and all tenant filters are preserved.

## Measurement

`scripts/benchmark-navigation.ts` compares sequential versus concurrent profile + workspace reads with a single existing active membership. It performs only read-only bounded lookups, prints no identities or records, warms both paths and alternates order across five samples. It checks that both return the same authorized workspace/branches.

Measured with Node 24.22.1 against the configured runtime database:

| Database lookup portion | Median |
| --- | ---: |
| Sequential | 498 ms |
| Concurrent | 219 ms |

This is approximately 56% less elapsed time for those two database reads. It excludes Supabase session verification, page-specific queries, rendering, browser networking and navigation. It is not a claim of 56% faster complete page transitions, nor a capacity benchmark. Parallel reads use up to two pool connections for this portion; the configured pool limit remains unchanged. Raw sanitized results are in `navigation-benchmark.json`.

## Verification

Node 24 unit regressions verify that the workspace query starts while the profile check is pending, profile rejection still blocks the context, failed identity verification starts no tenant query, and setup/selector redirects remain. Services regressions verify concurrent administrator reads and unchanged staff visibility.

Validation passed: 224 unit tests in 33 files; 47 disposable PostgreSQL integration tests; 128 desktop/mobile route-access tests against the rebuilt local production server; typecheck and optimized production build. Existing static-render helper key warnings remain. Browser access tests verify security/route behavior, not authenticated navigation latency or prefetch timing.

Full signed-in browser transition timing still requires an authenticated test session. Slow page-specific report/stock queries and network distance to Supabase can still dominate some pages; this change does not hide those remaining costs. The local app is rebuilt and restarted in production mode, using the same isolated `.next-perf` output as PERF-01. Refresh an existing browser tab once after the rebuild to load its current client assets.
