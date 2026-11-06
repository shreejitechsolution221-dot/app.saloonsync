# Vercel hosting and Redis

Import this repository into Vercel as a Next.js project and select Node.js 24.
The build generates Prisma Client before compiling Next.js. No Vercel CLI
dependency is required for Git deployments. `@vercel/functions` manages the
existing PostgreSQL pool when Vercel suspends a function instance.

Vercel builds use `.next`, matching `outputDirectory` in `vercel.json`.
Local production builds use `.next-production` to avoid overwriting an active
development build. `NEXT_DIST_DIR` overrides only the local directory; it is
ignored on Vercel so a local setting cannot break deployment packaging.
If deployment reports `NEXT_OUTPUT_DIR_MISSING`, deploy the commit containing
both configuration files rather than retrying an older deployment.

Configure the required values from `.env.example` separately for preview and
production. Set `APP_ORIGIN` to the exact HTTPS application origin. Configure
the identity provider's site URL and allowed callback URLs for that origin.
Never use production data or credentials for untrusted previews.

Connect Upstash Redis through Vercel Marketplace and set
`UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` on the project. Keep
these server-only. Place the Vercel function region close to PostgreSQL and
Redis using the project's Functions settings; do not assume the user's region
is the database's region. Redeploy after setting environment variables.

Use the database provider's pooled runtime URL for `DATABASE_URL` and its
migration connection for `DIRECT_URL`. Run `npm run db:migrate` from a trusted
release environment before deploying code that requires new schema changes.
Migrations deliberately do not run during every preview build. Budget
`DB_POOL_MAX` across all function instances and workers.

For Supabase, direct `db.<project>.supabase.co` endpoints may require IPv6.
On Vercel, the runtime uses an integration-provided `POSTGRES_PRISMA_URL` or
`POSTGRES_URL` pooler instead of a direct `DATABASE_URL` only when the pooler
matches the same project, database name, and database role. Otherwise it retains
the explicit URL; configure that project's Supavisor pooler URL yourself rather
than pointing authentication at a different database. Local URLs are unchanged.
If the integration also supplies direct URLs, set `SUPABASE_POOLER_HOST` to the
exact hostname from the project's Connect → Transaction pooler panel. On Vercel
only, this converts the direct URL in memory to that pooler on port 6543, uses
the same project, database and credentials, and enables verified TLS. No database
password needs to be copied or exposed. Only Supabase pooler domains are accepted.
The public CA in `certificates/supabase-ca.crt` is included in server functions
through `outputFileTracingIncludes`; keep it in the repository and do not disable
certificate verification when deploying. The certificate's fingerprint and
expiry are documented in `certificates/README.md`.

For hosted sign-in failures, verify `APP_ORIGIN` is the exact HTTPS site origin
(for this project, `https://app-saloonsync.vercel.app`), then redeploy; existing
deployments retain their previous environment values. Never bypass the origin
check. `/api/v1/ready` must return 200 before database-backed role checks can work.
Read Vercel logs for `auth.dependency_failed`: its stage and bounded error codes
identify origin, provider, or database failures without logging credentials or
SQL. Database failures are classified into fixed reasons such as network, TLS,
missing tables, and permissions. Apply missing migrations through the trusted
release workflow, and keep database passwords and connection strings out of chat.

The existing redirects are server-side and authorization remains fresh. Shared
Redis data must never replace membership or permission checks. Public routes
already avoid unnecessary session refreshes. Layout and customer queries use
Redis with scoped keys and invalidation. Concurrent reads of the same shared
key now share one pending lookup/query per instance, reducing database load on
cold cache bursts. Failed cache reads fall back to PostgreSQL without waiting
for another cache write timeout. Missing Redis credentials disable caching.

Validate with `npm run typecheck`, `npm test`, and `npm run build`. Measure
production navigation and `npm run db:latency` from the chosen hosting region
before claiming a latency improvement; local tests do not benchmark production.
