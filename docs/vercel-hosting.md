# Vercel hosting and Redis

Import this repository into Vercel as a Next.js project and select Node.js 24.
The build generates Prisma Client before compiling Next.js. No Vercel CLI
dependency is required for Git deployments. `@vercel/functions` manages the
existing PostgreSQL pool when Vercel suspends a function instance.

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
