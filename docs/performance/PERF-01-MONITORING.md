# PERF-01 monitoring

IMPLEMENTED:

- GET `/api/v1/health`: uncached process liveness, no database dependency.
- GET `/api/v1/ready`: 503 for missing required provider/database configuration, database/privilege failures or checked schema absence. Performs real uncached bounded reads of SalonMembership, SalonCustomer.originBranchId and LocationStock. It does not verify every migration/privilege, Supabase network reachability, external delivery, optional Redis, or worker health. Use deployment preflight for complete schema compatibility; provider synthetic monitoring is separate.
- GET `/api/metrics`: fails closed with 401 unless a server METRICS_SECRET of at least 32 characters matches a Bearer credential using constant-time comparison. Never put the credential in a query string/browser. Metrics are private/no-store.
- Fixed-template HTTP histograms for health, ready and appointments only: seconds, cumulative buckets, count/sum and 5xx error counts. X-Request-ID accepts a bounded safe identifier or generates a UUID. Server-Timing reports handler time. No raw paths, request parameters or identity labels.
- pg gauges: total, idle, waiting and configured maximum. Slow-query count/log event at >=500 ms; logs contain only event name and duration, never SQL/parameters. Idle socket failures produce a sanitized event. Waiting is a gauge, not a measured acquisition-wait histogram.
- Opt-in `useReportWebVitals` client sends LCP/INP/CLS name/value only, without credentials, IDs, DOM entries, URLs or referrer. Collector rejects unrecognized fields, non-finite/oversized values, cross-origin requests and bodies above 512 bytes. Per-process cap is 60 ingestion attempts/second, independent of existing security rate limits. Metrics expose bounded histograms: LCP/INP in milliseconds, CLS unitless.

All counters/histograms are process-local, reset on restart and require scraping **each replica**. Shared global module state contains only bounded aggregate telemetry, not user data. No paid exporter/storage is added. Web Vitals are unauthenticated untrusted browser samples; Origin checks are not proof of measurement authenticity. They inform diagnostics, not billing/security or independently verified SLO claims. Rate limits are local overload guards; apply trusted ingress limits in deployment. Collector stream timeouts depend on the HTTP platform.

## Dashboard examples (Prometheus-compatible)

| View | Expression |
| --- | --- |
| API p95 | `histogram_quantile(0.95, sum by (le,route)(rate(saloonsync_http_duration_seconds_bucket[5m])))` |
| API p50/p99 | Same expression with 0.50 / 0.99 |
| API RPS | `sum by(route)(rate(saloonsync_http_duration_seconds_count[5m]))` |
| 5xx fraction | `sum(rate(saloonsync_http_errors_total[5m])) / clamp_min(sum(rate(saloonsync_http_duration_seconds_count[5m])),0.001)` |
| Pool usage | `saloonsync_db_pool_total / saloonsync_db_pool_max` with idle/waiting alongside |
| Slow query rate | `rate(saloonsync_db_slow_queries_total[5m])` |
| Web Vital p75 | `histogram_quantile(0.75,sum by(le,name)(rate(saloonsync_web_vital_bucket[1h])))` |

Initial alert proposals (not benchmark claims): 5xx >1% for 5 minutes with meaningful traffic; appointment p95 >400 ms for 10 minutes; pool waiting >0 for 2 minutes; readiness repeatedly 503; slow-query count increasing unexpectedly. Evaluate LCP <=2500 ms, INP <=200 ms, CLS <=0.1 at p75 under specified production-like conditions. Histogram interpolation is approximate, especially with low traffic.

The cache abstraction exposes bounded event counters for its own hit/miss/error/invalidation/coalescing activity. It has no live business caller or Redis transport yet; zero counters are not proof of Redis health.

DEFERRED: full-route instrumentation, OpenTelemetry spans/exporter, queue depth/age/failures, live Redis availability panels, pool-acquire latency histogram and independent provider health probes. Queue backlog and repeated worker failure alerts should be added when that telemetry exists; no queue-health series is fabricated. Protect scrape transport, set finite log/metric retention and never expose private monitoring publicly.
