# Completed transfer

The migration and local cutover are complete. See [the verified result](MUMBAI_TRANSFER_RESULT.md). The procedure below is retained for reference; do not rerun restore against the populated Mumbai database. Portable tools are now available in .cache/tools/postgresql-client/pgsql/bin.

# Mumbai transfer: preserve accounts and application data

The new connection settings are staged in `.env.local` under `NEW_*`. The active
connection intentionally remains on Seoul until a verified copy is available.
The original runtime and migration settings are preserved in the ignored
`.env.local.seoul.bak` and `.env.migrations.local.seoul.bak` files.

Install the official PostgreSQL client tools (pg_dump and psql, matching or newer
than the source server major version). Add the installation's `bin` directory to
PATH. No passwords need to be pasted into a terminal. Commands below read them
from the local environment files and pass credentials through child-process
environment variables, not command-line arguments.

Before dumping, put the old app into a maintenance window and stop writes from
all app instances and scheduled jobs. The transfer script never writes to Seoul.
Keep the old project running as a fallback; do not delete or pause it yet.

From PowerShell in `D:\work\app.saloonsync`:

```powershell
pg_dump --version
psql --version
node --import tsx scripts/migrate-region.ts dump
node --import tsx scripts/migrate-region.ts restore
node --import tsx scripts/migrate-region.ts verify
$env:RUNTIME_TARGET='staged'
node --import tsx scripts/configure-runtime-db.ts
Remove-Item Env:RUNTIME_TARGET
```

Stop after any nonzero exit. The restore refuses a populated destination and runs
all app migrations only against the new direct connection. It imports a single
snapshot of `app` and `auth` data in a destination-only transaction. PostgreSQL
COPY preserves stored account/password data; it never rehashes passwords.
Migration metadata is retained from destination migrations. The seeded email
policy is skipped in the dump only if an exact source/destination policy hash
matches; otherwise restoration stops and requires transferring custom policy
rows. The 12 new performance indexes are created before data is loaded, and
ANALYZE runs afterward. The old database receives read-only dump/count queries.

The source contains an enrolled MFA factor. Follow Supabase's documented
project-to-project encryption-key transfer procedure and verify the existing
MFA enrollment in the new project. Do not disable MFA or replace accounts. Once
that provider configuration is complete, set the following attestation only in
`.env.local`:

```dotenv
MIGRATION_ENCRYPTION_KEY_COPIED=true
```

Then:

```powershell
node --import tsx scripts/migrate-region.ts cutover
npm run db:generate
npm run build
npm start
```

Cutover rechecks row counts and restricted runtime privileges before updating
DATABASE_URL, DIRECT_URL and the two public Auth settings. Prisma now reads the
local DIRECT_URL before the legacy migration-only override. Mumbai runtime uses
the transaction pooler on port 6543; migrations use the direct port 5432 URL.
With Prisma 7's pg adapter, DB_POOL_MAX=5 controls the actual pool; Prisma engine
URL options such as connection_limit do not control this pg Pool. No named
prepared statements or session-dependent tenant authorization are used.

Rebuild every deployed instance to replace the public Supabase URL/key in client
bundles. Existing project sessions require signing in again. Confirm password
login, email verification/recovery, platform MFA, each salon page, loyalty award,
product sale, payment, receipt and logout against Mumbai before ending maintenance.

## Provider settings to transfer/check

- Auth Site URL and exact callback/confirmation/recovery redirect allowlists.
- SMTP and email templates; signup hook `app.before_user_created`, password
  minimum and MFA settings. These are provider configuration, not table data.
- Root/column encryption keys for existing encrypted Auth/Vault data. Keep them
  out of this repository and chat.
- API exposed schemas: keep `app` private. Migrations recreate app RLS/grants.
- Source storage inventory: zero buckets and zero objects, so no files currently
  need copying. Private upload features have no service-role/storage setup yet.
- Source has no pg_cron installation. If external cron/webhooks/Edge Functions or
  OAuth integrations exist, repoint them in their provider consoles.
- No Vercel project/config was found in this checkout. For an actual Vercel
  deployment, configure function placement in Mumbai (`bom1`) and update its
  environment variables. This local task did not change any hosted deployment.

Native tools were unavailable during this task, so no dump/restore was attempted,
no application data was written to Mumbai, and active settings were not switched.
The report includes every observed row-count mismatch. Resume the steps above
once PostgreSQL tools and provider encryption-key access are available.

Provider reference: https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
