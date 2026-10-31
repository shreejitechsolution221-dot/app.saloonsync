# PERF-01 baseline — 29 October 2026

## Scope and evidence

VERIFIED: `D:\GlowDesk` does not exist. Work targets `D:\work\app.saloonsync`. No Git metadata is available in this checkout, so a Git diff cannot establish pre-existing changes. Read AGENTS.md, README, package.json, schema, migrations, authorization, API handlers, worker implementations and existing tests/docs. No secrets are copied into this report.

This is one Next.js 16.4.3 App Router application using React 19.3.1, npm/package-lock.json, Prisma/client/adapter-pg 7.10.1 and pg 8.23.1. There is no pnpm workspace, NestJS backend, four-app monorepo, Redis integration, BullMQ installation or service worker. Existing functionality is implemented through server components, server actions and route handlers. Do not scaffold the expected architecture over it.

## Existing foundation

- Supabase identity verification; fresh disabled-user, membership, salon, branch and permission checks. Platform privileges and MFA are independent. Workspace/location cookies select scope, never grant access.
- One module-level Prisma runtime client, constructor-aware development reuse/disconnect. Baseline pool: max 5, acquisition timeout 5 seconds, idle timeout 60 seconds; not configurable.
- Runtime URL classified without printing credentials: Supabase **session pooler**. Migration/provisioning connection is separate. Database tier, connection capacity, instance count and dataset size are unknown.
- Tenant-aware indexes already cover memberships, appointment dates/assignments, local customers, payments, invoices, inventory and audit history. Migration 11 already added workspace query indexes. No new indexes are justified without representative plans.
- Workspace authorization is consolidated into one parameterized SQL round trip and request-deduplicated with React.cache. Dashboard uses SQL aggregates, not full history retrieval, but includes correlated finance/stock aggregates requiring volume testing.
- Most business lists have 100/200/500-row caps. Customer UI stops at 100 without continuation. Appointment JSON API stops at 100 without continuation. Staff service-name history uses an unbounded distinct query. These are separate residual work items.
- Database-backed hashed rate limits coordinate application instances. Provider auth controls still matter; there is no general trusted-proxy/IP limiter.
- Booking overlap triggers take transaction-scoped advisory locks by tenant/stylist. Payments and integrity checks are database-backed. Real multi-connection race testing remains necessary.
- MessageJob and CalendarJob are existing PostgreSQL queues. Booking and message-job insertion share a database transaction. Workers use bounded claims, authorization/consent rechecks and failure recording. Uncertain message delivery requires reconciliation rather than blind retries.
- Server-rendered pages; independent resources frequently use Promise.all. Calendar avoids eager customer/service option fetching. Images use authenticated private proxy routes. No baseline bundle-size or Core Web Vitals measurement exists.
- Next security headers, private/no-store asset/API responses and 6 MB server-action limit exist. No shared PWA private-data cache exists.

## Actual HTTP workflows

Public auth/callback/recovery and token feedback; protected salon dashboard, appointments, customers, staff, billing, inventory, reports and settings; separate customer and platform portals. APIs include `/api/salons/[salonId]/branches/[branchId]/appointments`, `/api/customer/bookings/[bookingId]`, `/api/salon-report`, `/api/salon-calendar`, private portfolio/receipt assets, calendar OAuth, invitation context, and credential-protected internal calendar/communications workers. There is no public salon listing or public availability API to load-test.

## Missing or risky at baseline

No health/readiness endpoints, protected performance metrics, HTTP histograms, Web Vitals collector, Redis cache or dedicated load harness. Unexpected errors in the appointments API are mislabeled as access failures. There is no demonstrated production capacity or globally bounded pool budget. Request/worker deadlines and shutdown behavior need deployment-specific validation. README/email-confirmation behavior conflicts with the stated desired product policy: existing code requires provider confirmation. PERF-01 preserves that security control; changing provider policy requires coordinated auth regression work.

## Measured baseline

VERIFIED this run: 183 unit tests and 47 disposable PGlite integration tests pass before/relevant to changes. Existing `docs/workspace-performance.md` contains historical workspace lookup measurements; they are not a new PERF-01 before/after benchmark. NOT TESTED: live application load, query plans on a representative dataset, production connection capacity and p75 Web Vitals. No production database benchmark or migration was run.
