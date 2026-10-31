# PERF-01 implementation report — 29 October 2026

This report separates implemented foundation from operational acceptance. PERF-01 is not a claim that every production-scale phase is complete.

## 1. Baseline findings — VERIFIED

Current workspace is Saloonsync, one npm/Next.js app, Prisma 7/pg/Supabase, with existing authorization, tenant indexes, advisory booking locks and PostgreSQL job queues. No NestJS/Redis/four-app monorepo exists; D:\GlowDesk is absent. See BASELINE.md for actual routes, query risks and measurement gaps. No Git metadata is available to compare the working tree with a commit.

## 2. Files changed — IMPLEMENTED

- UI: `src/app/salon/select-workspace/page.tsx`, `src/components/web-vitals.tsx`, `src/app/layout.tsx`.
- Database/performance: `src/lib/db.ts`; new `src/lib/performance/{pool-config,pagination,http,vitals,tenant-cache}.ts`.
- API: existing appointments route under `src/app/api/salons/[salonId]/branches/[branchId]/appointments/route.ts`; new `src/app/api/v1/{health,ready,web-vitals}/route.ts` and `src/app/api/metrics/route.ts`.
- Tests: updated `tests/unit/{api,db-cache,operations-views}.test.ts`; added `tests/unit/{performance,workspace-selector,web-vitals,tenant-cache}.test.ts`.
- Operations: `scripts/performance/load.mjs`, `.env.example`, `next.config.ts`, `.gitignore`, README.md, seven PERF-01 documents and `health-smoke.json`.
- Next automatically updated `tsconfig.json` and generated `next-env.d.ts` for the isolated build directory. The latter follows the active build/dev directory. Generated Prisma output is refreshed by the existing build script.

No dependency, lockfile, database schema or migration change was required. No infrastructure was provisioned.

## 3. Database optimization — IMPLEMENTED / VERIFIED

Bounded projected selector queries and stable keyset pagination for appointment JSON API. Existing tenant/date indexes retained; no speculative redundant indexes added. Disposable database suite validates existing constraints/rollback/scope behavior. NOT TESTED: representative EXPLAIN ANALYZE, network PostgreSQL race/fault/pool exhaustion under load.

## 4. Prisma/pooling — IMPLEMENTED / VERIFIED

Driver-owned pg Pool with validated maximum/acquisition/idle/lifetime/statement timeouts, interactive transaction defaults, sanitized socket/slow-query events and pool gauges. Existing constructor-aware development reuse preserved. Session pooler retained; migration credentials remain separate. Pool budget documented. NOT TESTED: effective Supabase capacity, multi-replica saturation, graceful worker drain and live timeout fault injection.

## 5. Redis caching — IMPLEMENTED FOUNDATION / BLOCKED LIVE INTEGRATION

TenantCache abstraction has scoped hashed keys, strict serialization/schema bounds, TTLs, bounded local coalescing, circuit fallback, event counters and generation invalidation. Unit simulations cover isolation and invalidation races. No live business-response cache is enabled. Real Redis transport, durable invalidation recovery, generation-eviction policy and integration/outage tests remain required. A package-registry read failed with ENOTFOUND in the sandbox; no package was installed. No Redis environment/service was supplied.

## 6. Queue/worker changes — DEFERRED / EXISTING BEHAVIOR PRESERVED

Existing PostgreSQL queues and transactional booking/job publication retained. No BullMQ/Nest stack introduced. New queue telemetry, separate worker drain/concurrency/retention acceptance and delivery reconciliation are deferred.

## 7. API improvements — IMPLEMENTED / VERIFIED

Additive nextCursor for appointments; validated maximum limit 100; unique tie ordering; token tenant/branch/user binding; fresh authorization and staff predicates on every page. Unexpected failures now return sanitized 503 rather than 403; real authentication/authorization errors remain 401/403. Fixed-route timing/histograms and request IDs cover health/ready/appointments. Existing private response and security-header contracts remain.

## 8. Frontend improvements — IMPLEMENTED / PARTLY VERIFIED

Requested invitation/customer shortcuts removed from selector. Permitted active location names/addresses distinguish salons; missing addresses are explicit. Selector shows bounded-result notices. Opt-in Web Vitals client keeps the rest of the layout server-rendered, uses a stable callback and sends no private page/identity information. No loading interstitial was reintroduced.

All main protected routes and listed subpages were exercised anonymously on desktop/mobile; 29 business fixture render cases cover every dynamic business subsection plus primary reference views. Tests cannot reproduce signed-in failures tied to real account data without a dedicated account. No specific reproducible signed-in failure was identified. Do not interpret anonymous redirects or fixtures as proof that all authenticated actions work.

React review: stable list keys for added location rows; stable telemetry callback; no server-only import in the client boundary; no effect-based derived state, new render-time waterfall or additional heavy client library. Existing static-render test helpers emit React key warnings; they are not suppressed or presented as zero-warning checks.

## 9. Monitoring — IMPLEMENTED / PARTLY VERIFIED

Health independent of database; readiness detects required configuration and checked DB/schema failure; protected metrics; HTTP and Web Vitals histograms; pg total/idle/waiting/max; slow-query events. Collector validates origin, fields and body size, and locally caps ingestion. All aggregate state is bounded and has no identity labels. See MONITORING.md for Prometheus expressions and limitations. Full-route tracing, live queue/Redis telemetry and provider synthetic checks remain deferred.

## 10. Security and tenant isolation — VERIFIED WITH LIMITS

Unit and disposable database regressions cover authorization, branch/tenant scope, cache identity simulation, pagination scope/validation, private routes, metrics denial, readiness failures, schema/integrity and transaction behavior. Existing booking lock/trigger guarantees remain. No auth/CSRF/RLS control was removed. No secrets were printed, no production migration/deployment/load test or destructive operation occurred. NOT TESTED: real multi-connection booking races, Redis recovery, distributed worker shutdown and full provider account flows.

The requested policy says email confirmation is unnecessary; current code/provider documentation requires it. This performance change preserves that existing control and explicitly defers coordinated policy migration.

## 11. Commands and results

Final validation uses bundled Node 24.22.1, matching the supported >=22.12 <25 range. Initial checks used shell Node 25.2.1; supported-runtime reruns supersede those results.

| Check | Result |
| --- | --- |
| npm test | VERIFIED: 218 passing tests in 31 files |
| npm run test:integration | VERIFIED: 47 passing tests in two files; disposable PGlite |
| npm run typecheck | VERIFIED; stale incremental diagnostics cleared by removing only generated tsconfig.tsbuildinfo |
| npm run db:validate | VERIFIED: schema valid |
| npm run build | VERIFIED: Prisma generation and optimized Next build using NEXT_DIST_DIR=.next-perf |
| node --check scripts/performance/load.mjs | VERIFIED |
| npm run test:e2e -- tests/e2e/security-access.spec.ts --workers=2 | VERIFIED: 128 desktop/mobile tests on local production server |
| Full provider/authenticated business e2e and real multi-connection fault injection | NOT TESTED; dedicated fixtures required |
| npm ci / dependency audit | NOT RUN: no dependency changes; registry access unavailable in sandbox |
| lint / format:check | NOT AVAILABLE: no corresponding repository scripts |
| Live migration deployment/validation | NOT RUN: no migration changes; existing migrations tested in PGlite |

Sandbox builds initially failed with EPERM while making generated directories; outside-sandbox builds succeeded. Separate output avoids dev/build collisions. Browser checks initially waiting on a nonresponsive sandbox dev server were stopped and rerun successfully against the isolated production server. No test failure is concealed as success.

## 12. Measurements — LIMITED SMOKE ONLY

See `health-smoke.json` for the measured Node 24 local 1-VU, 10-second, read-only health run: 41 requests, zero failures, 4.07 paced RPS, p95 bucket upper bound 100 ms. Percentiles are histogram bucket upper bounds; RPS includes 200 ms pacing and concurrent access checks. No database load, business dataset, before/after optimization benchmark, saturation or production capacity is measured. No proposed SLO or Web Vitals target is marked achieved. Historical workspace lookup measurements are separate and not repeated here.

A single final `/api/v1/ready` request returned HTTP 200 through the configured runtime connection. This verifies basic connectivity/checked table access at that moment, not outage handling under real infrastructure faults. The temporary localhost:3105 verification server was stopped; the verified Node 24 production build is left on localhost:3000 for review using NEXT_DIST_DIR=.next-perf. Stop that local process before starting another server on the same port.

## 13. Incomplete/deferred items

Real Redis integration and durable invalidation; full-route telemetry/exporter; queue metrics/lifecycle acceptance; customer UI continuation; staff service-history query bounding; representative finance/stock plans; distributed pool/rate-limit fault tests; realistic mobile Web Vitals; authenticated business test fixtures and reproduction of account-specific page failures; supported provider email-policy migration. Stress/soak/1,000/10,000-user tests were not run.

## 14. Risks and deployment considerations

No migration is needed. Validate pool/statement budgets against legitimate reports; measure effective database limits before adding replicas. Keep metrics secret server-only and scrape every instance; process-local counters reset on restart. Web Vitals are opt-in untrusted diagnostic samples. The cache abstraction must not be wired into business routes until its documented cross-instance invalidation/timeout requirements are met. Keep build/start output directories consistent. Production must use supported Node and build/start rather than dev. No production deployment was performed.

## 15. Next recommended phase — DEFERRED OPERATOR ACCEPTANCE

Provision approved disposable network PostgreSQL/Redis and a dedicated multi-role/multi-tenant fixture account. Reproduce authenticated subpage failures, run realistic query plans and concurrency/fault tests, then wire the first non-sensitive catalog cache with durable invalidation. Establish measured endpoint/mobile baselines before selecting new indexes, report jobs or replica counts.
