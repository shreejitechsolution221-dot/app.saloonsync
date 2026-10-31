# Connect Saloonsync to Supabase

The application integration is implemented and connected to the user-selected
Supabase project `danlbqamhuiaqspikazv`. Database connectivity and migration state
have been verified. Legal documents, delivery configuration and live account flows
still need completing before launch.

## Current status

- Three login experiences and shared authentication actions: implemented.
- Database schema, migrations and tenant authorization: implemented.
- All eight Prisma migrations have been applied to the selected project.
- Real sign-in, verification email, recovery and MFA: not verified with your project.
- `.env.local`: configured locally and ignored by Git. Credentials were not printed.
- The user superseded the earlier project selection with `danlbqamhuiaqspikazv`.
- Its corrected Auth URL and supplied publishable key have been verified against
  its public Auth settings. Email sign-in and email confirmation are enabled.
- The application's Prisma connection succeeds. All 16 app-schema tables,
  including migration history, have RLS enabled; eight migrations are complete.
- Verified TLS uses the public Supabase CA in `.certs/supabase-ca.crt`. Runtime
  URLs use verify-full/sslrootcert; prisma.config.ts translates migration-engine
  certificate options without disabling verification. Absolute local certificate
  paths must be replaced with deployment paths when deploying to another host.
- The connected Supabase MCP account does not currently have access to this new
  project. Database operations work through the separately supplied connection.

## 1. Select a project

Use the intended development Supabase project. Keep production separate. If the
existing project contains another application's data, inspect its schema before
applying this app's migrations. Do not reset it or recreate auth users.

## 2. Fill .env.local

Open `D:\work\app.saloonsync\.env.local` in your editor. Do not paste database
passwords or secret keys into chat.

| Variable | Value/source |
|---|---|
| NEXT_PUBLIC_SUPABASE_URL | Project URL from the project's Connect dialog/API settings |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Publishable API key; never use a secret/service-role key here |
| DATABASE_URL | Server PostgreSQL connection; use Session pooler for initial local development |
| DIRECT_URL | Migration/provisioning connection: Direct connection if reachable, otherwise Session pooler |
| APP_ORIGIN | `http://localhost:3000` locally |
| AUTH_PASSWORD_MIN_LENGTH | `12`; set the same minimum in Supabase |
| LEGAL_TERMS_URL | Actual finalized HTTPS service terms URL |
| LEGAL_PRIVACY_URL | Actual finalized HTTPS privacy notice URL |
| LEGAL_DOCUMENT_VERSION | The actual published service-terms version identifier |
| RESEND_API_KEY | Optional: invitation email delivery API key, server-only |
| EMAIL_FROM | Optional: sender on your verified Resend domain |

Copy database host, username and port from **Connect**; do not guess pooler hosts.
Replace the password placeholder with the database password, URL-encoding special
characters in the password. The database password is different from the API key.
Use TLS with certificate verification for hosted database connections. The app
selects its private `app` schema through the Prisma adapter.

Supabase Direct connection can require IPv6. Session pooler is an IPv4 alternative
for local development and migrations. For Vercel, use the appropriate serverless
pooling configuration. Provision restricted runtime credentials before production
as documented in README; keep migration/provisioning credentials separate.

## 3. Configure Supabase Authentication

In Authentication settings:

1. Enable email/password signup and email confirmations.
2. Set password minimum to 12, matching the app configuration. If you enable more
   password rules, update the visible password guidance to match.
3. Set Site URL to `http://localhost:3000` for the development project.
4. Add these permitted redirect URLs:

```text
http://localhost:3000/auth/callback?next=/salon/onboarding
http://localhost:3000/auth/callback?next=/customer
http://localhost:3000/auth/callback?next=/salon
http://localhost:3000/auth/callback?next=/auth/reset-password
```

Keep confirmation/recovery templates compatible with Supabase's PKCE code flow.
The app handles the returned `code` at `/auth/callback`. Open verification/reset
links in the same browser used to initiate the request. For deployment, add exact
HTTPS callback URLs for the deployed origin and set APP_ORIGIN accordingly.

5. Enable authenticator-app/TOTP MFA for platform users.
6. Configure custom SMTP with a verified sender for general users. Supabase's
   default email service is restricted to project-team addresses and is unsuitable
   for general customer verification/recovery delivery.
7. Leave `app` out of the Data API exposed schemas. Application tables are queried
   by the authorized Next.js server, not by the browser Data API.

## 4. Apply the existing migrations and restart

After the intended project is confirmed and connection settings are saved:

```powershell
Set-Location D:\work\app.saloonsync
npm run db:generate
npm run db:validate
npm run db:migrate
npm run build
npm start
```

Use Node.js 24 LTS. Stop the existing preview before starting another server on
port 3000. If Codex started the preview, ask it to apply migrations and restart
after the settings are saved; no need to run a duplicate server yourself.

`db:migrate` applies the eight existing additive migrations to the configured
database. Do not use a database reset command. `build` alone does not apply
migrations. Because production builds capture public environment settings,
rebuild and restart after changing provider connection values. During normal
development, `npm run dev` is available instead of build/start.

## 5. First accounts

- Salon owner: register at `/salon/register`, verify the email, then create the
  salon workspace. Legal documents must be configured for registration/onboarding.
- Customer: register at `/customer/register`. This does not create a salon.
- Staff/manager/admin: join the salon through an owner/admin-issued invitation.
- Platform operator: first obtain a verified identity, then use the controlled
  operator script with its UUID:

```powershell
npm run platform:grant -- <user-uuid> grant "Approved platform operator provisioning"
```

Sign in at `/platform/login`, then enroll/verify the authenticator when prompted.
The script requires operator database access through DIRECT_URL. Public account
creation never grants platform access.

## What needs no further coding

You do not need to rewrite Supabase clients, session handling, authentication
forms, authorization helpers or migrations. Project configuration, credentials,
legal/brand assets and live development-environment verification remain.

References: [Database connections](https://supabase.com/docs/guides/database/connecting-to-postgres),
[redirect configuration](https://supabase.com/docs/guides/auth/redirect-urls),
[SMTP configuration](https://supabase.com/docs/guides/auth/auth-smtp).


## Current least-privilege setup

The runtime connection has been switched to a dedicated restricted login. DIRECT_URL was moved from `.env.local` into ignored `.env.migrations.local` for CLI provisioning only. Email existence is exposed through a backend-only boolean function; runtime does not directly read Auth tables. See security-review.md for the current eight-migration setup and database-role details. The runtime role is a server credential, never a browser key; current server authorization remains mandatory for tenant isolation.
