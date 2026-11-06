# SaloonSync project QA

## Scope

The audit covers environment loading, configuration consistency, verified database transport, live database/Auth/Redis connectivity, unit tests, SQL integration tests, TypeScript, lint, Prisma validation, the production build, desktop/mobile browser behavior and anonymous access boundaries. Secrets are never included in audit output.

Use Node 24 as pinned by `.node-version` and `.nvmrc`. The system shell had Node 25.2.1, outside the package's supported engine range; verification was performed with Node 24.22.1.

## Fixes

- HTTP origins now consistently support exact loopback hosts (`localhost`, `127.0.0.1` and `[::1]`) for local production tests. Remote HTTP, lookalike hostnames, userinfo, paths, query strings and fragments remain rejected. Authentication-cookie security uses the same loopback rules.
- Enabled certificate-verified TLS for the active local runtime database connection, preserving its existing project, role, database and password. The live TLS probe passed.
- Corrected the stale migration-only local environment target to match the active application/Auth project. The platform provisioning script now uses the same `.env.local`-first precedence as Prisma configuration.
- Added `npm run env:check` and `npm run env:check -- --live`. The checker uses Next.js's environment loading and expansion rules; detects missing values, duplicate keys, exposed public secrets, project mismatches, unsafe runtime logins, missing CA files, partial integrations and invalid worker secrets; and optionally probes configured services without printing credentials.
- Added optional `PLAYWRIGHT_CHANNEL` support so the suite can use an installed headless Edge browser when Playwright Chromium is unavailable.
- Fixed the small-screen header overflow by allowing its navigation to wrap.
- Updated ambiguous home-link selectors to target the actual portal cards. Keyboard assertions now include the password/OTP radio group. Long landing-page checks verify horizontal containment and reachable controls while allowing normal vertical scrolling. Card visibility tolerates fractional border positioning while requiring complete action visibility. Screenshots reset scrolling before capture so offscreen fixed elements do not appear inside full-page previews.
- Corrected stale security expectations: customer discovery is intentionally public; appointment and profile pages remain protected and guest discovery is tested for absence of personal appointments.
- Added explicit anonymous-access coverage for every platform-admin section and the elapsed-service worker.
- Browser screenshots now use per-test output directories instead of overwriting tracked design previews.

## Repeatable checks

| Check | Final evidence |
| --- | --- |
| Unit tests | 500 passed across 70 files, including same-project runtime provisioning checks |
| SQL integration tests | 63 passed across 3 files, using the complete migration chain |
| Browser suite | 238 desktop/mobile checks verified across the full run and final responsive rerun |
| Final responsive rerun | All 18 passed; resolves the full run's only two remaining failures from a brittle fractional bounding-box assertion |
| Build, TypeScript, lint, Prisma validation | Passed with Node 24 |
| Database, Auth and Redis connectivity | Passed; live database TLS confirmed |
| Environment release readiness | Approved remediation completed; live audit reports 0 errors and 0 warnings |

The last full browser run passed 236 of 238 cases. Its only failures were the desktop/mobile variants of the same fractional scroll-bound assertion. The final rerun exercised all 18 responsive cases with the corrected action-visibility assertion and passed; the other 220 browser cases were unchanged and passed in the full run. This is a combined verification result, not a claim that an additional full 238-case run was performed afterward.

```text
npm run lint
npm run typecheck
npm run db:validate
npm test
npm run test:integration
npm run build
npm run env:check
npm run env:check -- --live
```

For the browser suite, use Playwright Chromium (`npx playwright install chromium`) or an installed Edge channel. These PowerShell settings run against a local production build:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'msedge'
$env:PLAYWRIGHT_BASE_URL = 'http://127.0.0.1:3106'
$env:PLAYWRIGHT_SERVER_COMMAND = 'node node_modules/next/dist/bin/next start --port 3106 --hostname 127.0.0.1'
npm run test:e2e -- --workers=3 --reporter=line
```

The configured test origin must match the server origin. An isolated test origin also avoids disturbing a running development server. Screenshots and failed-test traces are written under the ignored `test-results` directory.

## Approved environment remediation completed

Read-only probes confirmed database connectivity with TLS, the registered-email lookup, Supabase Auth settings (HTTP 200) and Redis PING (HTTP 200).

The previous application database credential had `BYPASSRLS`, `CREATEROLE` and `CREATEDB`. Following explicit approval, a dedicated `saloonsync_web` login was provisioned with none of these privileges and no membership in the administrator role. It inherits only the existing backend runtime permission group. The local `DATABASE_URL` now uses this restricted login; `DIRECT_URL` remains separate for administrative migrations.

Migration `202611050019_platform_console` was applied successfully. All 19 migrations are now up to date. Runtime verification confirmed the platform table's RLS, SELECT/INSERT/UPDATE access, and a successful test insert that was rolled back without retaining records.

Completed commands and checks:

1. Applied the additive migration using Prisma migrate deploy.
2. Ran `scripts/configure-runtime-db.ts` against the explicitly selected active configuration. The script now verifies project/database identity before selecting the matching session pooler, retains one credential across bounded authentication-cache retries, verifies runtime permissions and certificate-validated client TLS, and updates the local connection only after those checks pass. Its temporary ignored credential file was removed after success.
3. Ran `npm run env:check -- --live`: database connection and registered-email lookup succeeded; client TLS was verified; Auth and Redis returned HTTP 200; the audit reported **0 errors and 0 warnings**.
4. Started a local production instance with the updated login: `/api/v1/health`, `/api/v1/ready` and `/customer` returned HTTP 200. Anonymous `/platform` access correctly redirected to login.

The migration and role changes were performed only after the user explicitly approved them. The earlier automatic-review block is resolved. Hosted deployment environment variables were not changed; this verification applies to the configured database and the local application's updated runtime connection.

For pooled connections, TLS is verified from the actual client TLS socket. `pg_stat_ssl` reflects the pooler-to-Postgres connection and cannot establish whether the application-to-pooler connection uses TLS.

Private storage, Google Calendar and WhatsApp integrations are unconfigured and reported as optional disabled capabilities, rather than test failures. They require real provider configuration before their live delivery flows can be tested.

## Verification limits

No real account was created, no email or customer notification was sent, and no production business record was modified. Browser tests verify public flows, invalid recovery handling, blocked signup, and access-denial behavior. Authenticated tenant operations and platform mutations are covered by unit tests and isolated SQL integration tests; a live signed-in owner/admin workflow requires dedicated test accounts and an approved test dataset.
