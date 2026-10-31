# PERF-01 database and pooling

IMPLEMENTED: `src/lib/performance/pool-config.ts` validates driver settings; `src/lib/db.ts` uses a real pg Pool supplied to PrismaPg. Prisma owns its disposal through `disposeExternalPool: true`. The existing development constructor cache remains. Each production module instance owns one client/pool; include separate worker processes and application replicas in the budget.

| Setting | Default | Accepted range |
| --- | ---: | ---: |
| DB_POOL_MAX | 5 | 1–100 |
| DB_CONNECT_TIMEOUT_MS | 5000 | 100–30000 |
| DB_IDLE_TIMEOUT_MS | 60000 | 1000–300000 |
| DB_MAX_LIFETIME_SECONDS | 600 | 60–86400 |
| DB_STATEMENT_TIMEOUT_MS | 15000 | 1000–120000 |

Invalid configuration fails startup without including supplied values in errors. Interactive transactions default to maxWait 5 seconds and timeout 15 seconds; existing explicit transaction overrides remain. Statement timeouts cancel database statements, unlike a JavaScript Promise.race that would abandon active work. They are not an end-to-end HTTP deadline or a cancellation guarantee for external providers. Validate these budgets against legitimate reporting/worker tasks before rollout.

Driver option references: [node-postgres client configuration](https://node-postgres.com/apis/client), [pool settings](https://node-postgres.com/apis/pool) and [Supabase timeout/session limitations](https://supabase.com/docs/guides/database/postgres/timeouts). Transaction-pool mode must not be substituted without revisiting session-level settings.

Retain the configured Supabase **session pooler** for this implementation. Direct connectivity is suitable for migration/admin work when reachable; session pooling supports session state/prepared statements; transaction pooling requires separate adapter/prepared-statement/session-state compatibility tests. No legacy `connection_limit` or `pgbouncer` flags are appended. Driver pool settings are passed as pg options. See [Supabase connection guidance](https://supabase.com/docs/guides/database/connecting-to-postgres) and [prepared statement guidance](https://supabase.com/kb/troubleshooting/disabling-prepared-statements-qL8lEL). Migration credentials stay outside the web runtime.

Before changing concurrency, establish the actual effective connection allowance, then require:

`max web instances × DB_POOL_MAX + worker processes × worker pool max + migration/operations/headroom <= effective database allowance`.

Example arithmetic only: 4 web instances × 5 + 2 workers × 3 + 10 headroom = 36. This is not a Supabase capacity claim or a recommendation to configure 36 connections. Session-pooler client limits and backend connection limits both need assessment. Reject a deployment scale setting that exceeds its approved budget.

## Query changes

IMPLEMENTED: appointments API retains tenant/branch/staff filters, projects three required fields, and fetches at most limit+1 (maximum 101). Keyset ordering is startsAt DESC, id DESC, with a lexicographic boundary instead of offset or a cursor-row lookup. Tokens are strict versioned base64url JSON, limited to 1024 characters, bound to tenant/branch/user. They are **not secrets or signed authorization grants**: arbitrary boundaries are harmless because every request independently authorizes and filters data. Existing response.appointments stays; nextCursor is additive. Empty final page has nextCursor=null. Invalid limits/tokens return 400. Time edits can move rows between pages; callers should refresh after mutations.

IMPLEMENTED: workspace selector projects rendered fields and only permitted active branches, with explicit 100-workspace/50-location display limits and notices. No tenant field is accepted as authorization.

DEFERRED: additional indexes. Existing Appointment(salonId,branchId,startsAt) supports tenant/location/date scanning; test the cost of id tie-break sorting at representative density before widening it. No migration or live EXPLAIN ANALYZE was run. Customer pagination, staff service-history EXISTS conversion and finance aggregate plans remain follow-up work. Use disposable PostgreSQL with production-like distributions, statement timeout and EXPLAIN (ANALYZE,BUFFERS); retain before/after plans and write-cost measurements. Never use production for uncontrolled plan or load experiments.
