# PERF-01 load testing

IMPLEMENTED: dependency-free, read-only Node harness `scripts/performance/load.mjs` (Node 24 recommended). Supports smoke (1 VU/10 s), small (25/60 s), medium (100/60 s), stress (200/60 s), soak (25/600 s). All requests have a 15-second fetch timeout and 200 ms pacing. Per-scenario histogram storage is bounded, not one allocation per response. Reports RPS, error %, mean and p50/p95/p99 **bucket upper bounds**, not exact percentiles. Redirects fail authenticated scenarios rather than counting a login page as success. Exits nonzero at >=1% failure or an empty scenario.

PowerShell smoke:

```powershell
$env:PERF_BASE_URL='http://localhost:3105'
$env:PERF_ENVIRONMENT='local production build; no dedicated business dataset'
node scripts/performance/load.mjs
```

Only liveness is exercised by default. For an **approved dedicated test account and tenant**, set PERF_COOKIE through a secure environment injection, PERF_SALON_ID and PERF_BRANCH_ID. The harness then adds GET /salon, paginated appointments (limit 25), and the same API without credentials (expected 401). Never paste cookies into docs, checked-in scripts or shell history. These read-only scenarios still produce auth/provider/database traffic; dedicated fixtures and operator approval are required. No public salon listing, public service browsing or availability endpoint exists here, so no fictional scenario is added.

Non-local targets require PERF_APPROVED_ORIGIN equal to the exact approved origin. Stress and soak additionally require PERF_EXTENDED_APPROVED=yes after operator approval. Do not point even smoke at production/shared Supabase without approval. This harness does not implement write/booking load or cleanup. Use isolated scheduling inventory for future booking concurrency tests.

Record alongside any results: commit/source snapshot, Node/Next versions, build mode, dataset cardinality/distribution, database region/tier/effective limits, number of app/worker instances, pool settings, cache/queue configuration, traffic mix, duration, warm-up and load-generator resources. Correlate CPU/memory, pg pool/waiting, slow query logs and database CPU/IO. Queue/cache metrics remain unavailable until implemented. Preserve failed runs too.

SLO targets remain unverified: cached dashboard p95 <200 ms (no cache yet), availability <400 ms (no public API yet), customer list <300 ms, booking write <600 ms, and error <1% for a defined steady workload. Do not infer these from a health-only smoke run or test duration.

DEFERRED: 1,000 and 10,000 concurrent-user tests. They require approved isolated infrastructure, a verified pool budget, representative datasets/fixtures, phased ramps, abort thresholds and load-generator sizing. Do not run them automatically on shared Supabase. Check auth-provider limits separately from business query throughput.
