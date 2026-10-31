# Security review — 28 October 2026

Scope: local Next.js application, server actions, route handlers, authorization, recovery links, database role, and dependency audit. This is a bounded code and automated test review, not a guarantee that every vulnerability has been found.

## Confirmed fixes

- Direct `/auth/reset-password` requests require a current provider-verified, email-confirmed identity matching the HttpOnly recovery marker before the password form renders. Server-side password mutation retains its independent checks.
- PKCE callbacks establish recovery context only when the SDK reports a recovery exchange. A client-supplied next parameter cannot classify a normal sign-in as recovery. Recovery exchanges always route to reset, and normal exchanges clear stale recovery state.
- Password login and logout clear stale recovery/OTP/workspace state. Logout also clears invitation and portal context.
- Auth-flow route lookup uses own properties. `/auth/constructor`, `/auth/toString`, and `/auth/__proto__` are invalid routes instead of reaching inherited object properties.
- Platform signup is unavailable; platform pages/actions independently check current database grants and MFA. Salon and customer resource reads are scoped to authorized identity/membership/branch. There is no global platform role derived from editable metadata.
- Eight migrations are applied. All 17 existing app tables have RLS enabled. Local DATABASE_URL now uses a restricted saloonsync_web login inheriting the backend-only saloonsync_runtime role. Neither has BYPASSRLS, superuser, database-creation or role-creation authority. Application code still enforces tenant scope: the backend role's explicit policies allow server-side app operations and are not per-browser-user policies.
- Runtime has no schema creation, direct Auth-table access, Auth credential writes, or audit update/delete permission. Registered-email checks use a narrowly scoped boolean function with a fixed empty search_path, no dynamic SQL, and EXECUTE revoked from PUBLIC.
- Provisioning DIRECT_URL is isolated in ignored `.env.migrations.local`. Prisma CLI and provisioning scripts load that file; the web app loads `.env.local`. Never provide the provisioning credential to web deployment environments.
- Auth routes have no-store/no-referrer/noindex headers; framing is denied. Redirect destinations use an explicit allowlist. Mutation endpoints check same-origin requests. Recovery token shape accepts the provider's PKCE prefix without skipping provider validity/expiry checks.

## Runtime setup

Use the supported Node runtime. For a fresh environment run `npm run db:migrate`, then `node --import tsx scripts/configure-runtime-db.ts`. This checks the restricted connection before changing DATABASE_URL. The script does not rotate an already configured runtime login. Hosted poolers may cache password changes; explicit credential rotation needs a coordinated pooler-safe process.

Keep `.env.local` and `.env.migrations.local` private; both are gitignored. The email lookup migration owner must retain read access to the provider identity table. Provisioning is independent of public registration or consent and is not exposed by an HTTP route.

## Remaining limits

- Successful administrator login, MFA and real-email password recovery have not been completed using the user's credentials. Negative provider verification is tested without authenticating as the administrator.
- Hosted Supabase Reset Password template/redirect URLs and Before User Created hook activation cannot be confirmed from the current management connection. Repository templates and setup steps remain in docs/password-reset-setup.md and docs/authentication-improvements.md.
- Unknown-email recovery intentionally reveals account existence because the user explicitly requested “Email not found.” Login password errors remain generic. Changing this behavior requires a product decision.
- Subscription records remain manual; no payment-provider integration is present.
- New production deployments require their real HTTPS APP_ORIGIN and corresponding Supabase redirects. Localhost URLs are local only.

Validation results are recorded after the final runtime verification below.

## Final verification

- Production build and TypeScript check passed.
- 125 unit tests passed, including role/branch denial, disabled/unverified identities, MFA requirements, redirect allowlisting, callback recovery classification, and direct server-action checks.
- 22 PostgreSQL/PGlite integration tests passed, including database integrity, runtime privileges, RLS, and the restricted Auth existence function.
- 72 production desktop/mobile authentication and security browser checks passed in a single run. Anonymous protected pages redirect to login; protected APIs return 401; invalid routes return 404; cross-origin invitation writes return 403; reset forms are unavailable without valid recovery context.
- Full npm dependency audit reported zero known vulnerabilities at verification time. This does not rule out undisclosed vulnerabilities.
- The selected remote database has all eight migrations applied. Restricted runtime connection read and rolled-back write checks succeeded; the real app's unknown-email recovery flow and invalid-token rejection succeeded using it.

No real administrator password was changed or MFA enrollment completed as part of this audit. Successful account sign-in and email recovery still require the user's mailbox and authenticator.
