# PERF-01 architecture and capacity

IMPLEMENTED incrementally in the existing modular Next.js app. No new application, NestJS layer, microservices, sharding, cloud resources or production deployment.

The request path is Supabase identity → current database authorization → tenant/location query → private response. Request-local deduplication never substitutes for membership checks. The appointments API now supplies bounded continuation tokens. Next compression/security behavior remains; no additional compression stack is installed. Provider network timeouts/retries stay under their existing call-site rules. A universal HTTP timeout is deferred because abandoning a promise does not cancel committed writes.

## Jobs

PRESERVED: PostgreSQL MessageJob and CalendarJob queues, bounded claims using SKIP LOCKED, attempt/failure records, dedupe keys and tenant references. Booking plus notification publication already uses one transaction: no new dual-write queue hole is introduced. The existing scheduled credential-protected route handlers remain the execution mechanism. DEFERRED: BullMQ/Nest integration because neither Redis nor Nest exists here. Dedicated worker process concurrency, metrics, shutdown/drain, retention and recovery need separate operational acceptance. Do not blindly replay provider requests with uncertain delivery.

## Scaling stages

1. Use production build/start, validated small pg pools, current tenant indexes, bounded reads and protected monitoring. Measure dashboard finance/stock aggregates and real mobile Web Vitals. Inventory database tier, data size and connection limits. Add optional Redis only after the documented invalidation tests.
2. Add stateless replicas within the approved pool budget; current database-backed rate limits already coordinate auth actions. Preserve trusted proxy rules; never accept arbitrary forwarded client IP. Add centralized scraping/log retention and separate worker scheduling with claim/drain tests.
3. Increase database capacity only from evidence. Move expensive reports to authorized persisted jobs/read models when measured latency justifies it. Replica reads need an explicit primary/read-after-write policy for bookings, payments and permissions. Verify backup restore and recovery objectives.
4. At measured high tenant/data volume, establish retention/archival first. Partitioning or tenant database separation requires a documented migration/rollback plan, measured benefit and security review. No premature sharding.

## Deployment checks

Validate environment settings before rollout; configure METRICS_SECRET only server-side and scrape each instance privately. Set ENABLE_WEB_VITALS=true only when opting into first-party numeric telemetry. Size statement timeouts for legitimate reports. Keep DIRECT_URL/provisioning secrets out of the web runtime. No database migration is required by these changes.

NEXT_DIST_DIR optionally isolates build output (e.g. `.next-perf`) from an active dev server. Use the same directory for build and start; Next owns and may delete that directory. Default remains `.next`. Do not point this variable at a folder containing source or user data. Do not build and develop concurrently in the same output directory.

BLOCKED acceptance: no approved dedicated network PostgreSQL/Redis/load-test tenant or authenticated failing-page reproduction was supplied. Existing email-confirmation requirements are preserved despite the task's desired policy; change them only with coordinated provider and auth-flow tests.
