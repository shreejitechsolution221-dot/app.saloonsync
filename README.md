# Saloonsync

PERF-01 implementation and limits: [baseline](docs/performance/PERF-01-BASELINE.md),
[database/pools](docs/performance/PERF-01-DATABASE.md),
[monitoring](docs/performance/PERF-01-MONITORING.md),
[load testing](docs/performance/PERF-01-LOAD-TESTING.md), and
[verification report](docs/performance/PERF-01-VERIFICATION.md).
Driver pool settings are configurable in `.env.example`; calculate the total web/worker
connection budget before scaling. Optional first-party Web Vitals collection is off by
default. `/api/metrics` requires a server-only `METRICS_SECRET` Bearer credential.
No new database migration or Redis service is required for this foundation.

Page-to-page navigation improvements and measured database lookup timings are
documented in [navigation performance](docs/performance/NAVIGATION.md).

Three portals, one Supabase identity system. Next.js App Router, strict
TypeScript, React, Tailwind, Zod, Prisma and PostgreSQL.

## Local setup

Use Node.js 24 LTS (`.nvmrc`) and npm. The system Node 25 is outside this
project's supported deployment range.

```sh
npm ci
cp .env.example .env.local
npm run db:generate
npm run db:migrate
npm run dev
```

On PowerShell, replace `cp` with `Copy-Item .env.example .env.local`.
Set the environment before migrations. Prisma loads `.env.local`; Next.js loads
it automatically. Never commit credentials. Open <http://localhost:3000>.
The webpack development/build option avoids an observed Windows sandbox
Turbopack child-process failure. No authentication is simulated when configuration
is missing: public forms render, but provider-dependent submission is disabled.

## Supabase configuration

Create separate development, preview and production projects. In each project:

1. Enable email/password sign-in and **Confirm email**. Configure the password
   minimum to match `AUTH_PASSWORD_MIN_LENGTH` (default 12). If enabling additional
   provider password rules, update the visible guidance to describe them.
2. Set Site URL to the exact application origin. Add the exact callback URLs
   `/auth/callback?next=/salon/onboarding`, `/auth/callback?next=/customer`,
   `/auth/callback?next=/salon`, and
   `/auth/callback?next=/auth/reset-password` under the appropriate origin.
   Use the provider-supported redirect matching settings and test every email
   template against its actual RedirectTo value. Avoid production wildcard URLs.
3. Keep the provider's PKCE-compatible confirmation and recovery email flows.
   Links must return to `/auth/callback` with a `code`. The browser that initiates
   signup/recovery must retain the verifier cookie. Do not replace this with an
   implicit-flow URL fragment template. Expired links can be requested again.
4. Configure supported custom SMTP and a verified sender for production delivery.
   Existing Resend integration was absent; Supabase owns verification/recovery
   email delivery. Invitations always provide a secure copy-and-share link.
   Optional delivery through Resend is available when `RESEND_API_KEY` and
   `EMAIL_FROM` are configured with a verified sender. Administrators must select
   “Send the invitation to this email address.” A successful API response means
   accepted for sending, not confirmed inbox delivery. On failure the invitation
   remains valid and its link is shown for private manual delivery. No real email
   is sent in automated tests.
5. Enable TOTP MFA. Platform access always requires an active `platform.manage`
   database grant and provider assurance level `aal2`. `/platform/mfa` supports
   authenticator enrollment and challenge; no platform signup exists.
6. Configure provider authentication rate limits and bot protection appropriate
   to the release. The application additionally applies shared database limits
   per hashed identity/action. Edge/IP controls should be configured in Vercel
   before public launch. Do not treat email-based limits as a complete bot defense.
7. Leave the `app` schema out of exposed Data API schemas. No browser reads
   application tables through the Supabase SDK. RLS is enabled with no Data API
   policies; anon/authenticated have no app schema grants. Never expose database
   credentials or a service-role/secret key through `NEXT_PUBLIC_` variables.

`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are public
provider connection settings. `DATABASE_URL` is a server-only pooled PostgreSQL
connection; `DIRECT_URL` is the migration/provisioning connection. Configure TLS
with proper CA verification; this application never disables certificate checks.
Use Supabase's documented connection strings for the selected pool mode and
include the app schema where required. Prisma's adapter explicitly selects app.
The small runtime pool (5 connections per instance) is defined in `src/lib/db.ts`.

## Database deployment and privileges

`npm run db:migrate` applies eight additive migrations. The first creates the private
application tables, indexes and foreign keys. The second adds checks, RLS,
provider identity linkage and deferred integrity triggers. The third constrains
appointment assignments to memberships of the same salon. The fourth adds private
platform subscription records and separate management privileges. These migrations target
a **new Supabase database**: `auth.users` must already exist. Existing unrelated
schemas/data are preserved. Never use migrate reset against shared environments.

Use a migration role separate from runtime credentials. The runtime role needs
only app-schema usage, CRUD on the business tables used by the server, INSERT
and SELECT on AuditEvent, and SELECT/INSERT/UPDATE on PlatformPrivilege for the
separately authorized platform operator-management actions. It needs no
DDL, database-role management or audit edits. Recovery's registered-account lookup
additionally needs auth schema USAGE and SELECT(email, deleted_at) on auth.users;
this access must remain server-only.
Because authorization is centralized in the server and app tables have no public
RLS policies, the private runtime role must bypass RLS for its granted app tables
(a separately provisioned BYPASSRLS role, or the table owner). Grant no unrelated
table privileges to that role. Keep those credentials exclusively server-side.
Apply default privilege restrictions to future migrations too. No application
function uses SECURITY DEFINER.

Run migrations in a single controlled release job using DIRECT_URL. Run the build
separately; it generates the client but does not migrate. For an existing populated
application, review and adapt the initial migration before use. Future changes
must expand, backfill and validate before removing old structures. Back up and
restore-test data before production rollout. Clean expired RateLimit rows in a
scheduled administrative maintenance job (do not retain hashed keys indefinitely).

## Platform provisioning

Have the intended administrator verify their email and sign in first, creating
the linked application User. Using restricted operator access and a provisioning
database connection, run:

```sh
npm run platform:grant -- <existing-provider-user-uuid> grant "Approved platform operator provisioning"
npm run platform:grant -- <existing-provider-user-uuid> revoke "Platform operator access removed"
```

The script uses DIRECT_URL, records a system audit event and never creates an
identity. It now grants/revokes the three named platform privileges together to
bootstrap a full platform administrator. Existing entry-only grants are not
automatically expanded by migration. Possession of operator database credentials is the controlled bootstrap
boundary. Public routes cannot call the script. Do not grant by email domain,
portal URL, user metadata or client-submitted role. MFA enrollment follows on the
first platform visit. Recovery of a lost factor is a controlled Supabase operator
process; no unauthenticated bypass is supplied.

## Legal and branding configuration

Salon-owner registration now also requires a salon name and mobile number with
country code. The server normalizes the number to international format and stores
both details against the new identity. The salon name prefills verified owner
onboarding; registration still does not create a salon before onboarding. Phone
collection does not imply SMS verification. The fifth migration adds nullable
columns and database validation without requiring changes to existing accounts.

Set `LEGAL_TERMS_URL`, `LEGAL_PRIVACY_URL` to finalized HTTPS documents, and
`LEGAL_DOCUMENT_VERSION` to the accepted terms version. Registration and salon
onboarding remain disabled without these settings. Consent is recorded on the
server against the configured version and portal purpose. No marketing consent
is collected. No legal agreement text has been invented.

The interface uses a text wordmark and an original code-drawn decorative
illustration. Replace the text wordmark with the supplied brand asset when
available; no logo file existed in the workspace. The layout uses warm ivory,
plum, serif headings, mobile form priority, visible focus and reduced motion.

## Workspaces and invitations

Successful login authenticates with Supabase, then protected routes perform fresh
database authorization. One active membership opens its salon; multiple show a
selector unless a still-authorized workspace has been selected; no membership
shows onboarding/invitation guidance. Disabled identities, suspended salons and
non-active memberships are denied. Workspace cookies never grant access.

Owners and all-branch salon administrators can issue scoped invitations according
to the permission matrix. Copy the one-time-displayed link and deliver it privately.
The 256-bit token travels in a URL fragment, is removed from the address, and is
stored in an HttpOnly same-site cookie for an hour. Only its SHA-256 hash is stored
in the database. Invitation validity is 72 hours; re-open the original link if
browser context expires. The intended recipient must authenticate and verify the
matching email before accepting. Existing active/suspended membership roles are
never overwritten. Invitations cannot grant owner; ownership uses the separate
transactional transfer form. Revoke and reissue to change a grant.

Customers use their existing identity without creating salons. Their profile and
booking queries always use their authenticated user ID. Salon-owned customer notes
are separate records and never copied into a global customer profile. Staff
appointment reads require both their assigned branch and assigned work.

## Verification

```sh
npm run db:validate
npm run typecheck
npm test
npm run test:integration
npx playwright install chromium
npm run test:e2e
npm run build
npm audit
```

The integration suite runs all migrations in a fresh in-memory PostgreSQL
instance via PGlite. Its auth.users table is a test fixture, not a credential
store. It does not require a provider account, production database, Docker or
emails. Browser tests expect the unconfigured local environment; do not point
them at production. Provider functions are mocked in unit tests.

PGlite validates real PostgreSQL constraints and triggers but does not reproduce
multi-connection deployment concurrency. Before release, run parallel invitation
acceptance, concurrent owner changes, and revocation races against disposable
network PostgreSQL, and exercise live provider email/MFA flows in a development
project with authorized test identities. See `docs/verification-report.md` for
verified results and remaining release checks.

## Vercel

Import this repository as Next.js, select Node.js 24 LTS, and use `npm run build`.
Set isolated environment variables for development, preview and production. Set
APP_ORIGIN to each deployed origin and register its callback URLs with the matching
Supabase project. Do not share production credentials with preview deployments.
Deploy only after controlled migrations succeed. No public site or production
database was created or modified during local implementation.

Architecture, ER diagram, role matrix and transaction design are in
`docs/authentication-design.md`.

Live password feedback, registered-account recovery, disposable-domain filtering,
the Supabase Auth hook activation step and login performance changes are documented
in `docs/authentication-improvements.md`.


### Restricted runtime database configuration

The local web app now uses DATABASE_URL with a restricted backend role. Provisioning DIRECT_URL is in the ignored `.env.migrations.local`, loaded only by Prisma configuration and operator scripts. Do not add it to web-runtime deployment variables. For a fresh environment, apply the eight migrations, then run `node --import tsx scripts/configure-runtime-db.ts`. See docs/security-review.md for role boundaries and verification limits.
