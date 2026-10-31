# Private Saloonsync platform administration

Platform administration is for the Saloonsync SaaS business: salon subscription
records and platform operators. It is separate from Salon OS and customer booking.

## Discoverability and access

The public home page lists only Salon and Customer. Public authentication footers
have no platform link. Operators use the direct `/platform/login` address shared
privately. All platform routes return an X-Robots-Tag excluding indexing. There is
no public platform registration. An unlisted URL is not the security boundary:
every protected platform page/action checks a current database grant, a verified
enabled identity and provider MFA (`aal2`).

## Permissions

| Platform role | Entry | Subscription records | Platform operator grants |
|---|---|---|---|
| Administrator | platform.manage | platform.subscriptions.manage | platform.operators.manage |
| Subscription manager | platform.manage | platform.subscriptions.manage | Denied |
| Salon owner/admin/manager/staff | No automatic platform access | Denied | Denied |
| Customer | No automatic platform access | Denied | Denied |

Platform roles are convenience bundles of separate privileges, not global identity
roles. They never create salon membership or grant customer booking/profile data.
The platform page selects salon business name/status and subscription records,
plus already-authorized platform operator identities. It does not query customer
profiles, notes, appointments or salon staff rosters.

## Subscriptions

`SalonSubscription` has one record per salon, a published plan identifier, status,
optional current-period end, timestamps and an optimistic version. Statuses are
trialing, active, past_due, paused and canceled. Editing requires the explicit
subscription privilege and writes an audit event. Stale updates are rejected.
No prices, plans or paid successes are fabricated.

These are manually maintained platform records. A billing provider was not
specified: there is no checkout, card collection, recurring charge, invoice
generation or payment webhook integration. Saving a record does not change an
external billing subscription or salon access. Payment automation requires a
selected payment provider and its verified events.

## Operators

An administrator can add an existing enabled user's UUID as a subscription manager
or administrator, or revoke platform access. This never creates provider accounts.
The last active platform administrator cannot be demoted/revoked through the web
action. Grant changes and subscription mutations serialize on a platform-scoped
database advisory transaction lock, recheck authority, and write sanitized audit
events. The operator CLI remains a controlled bootstrap/recovery path.

## Deployment

The fourth Prisma migration adds the subscription table and expands the allowed
privilege names; it does not automatically upgrade existing entry grants. Apply
all migrations, then run the controlled bootstrap command for the intended first
administrator. Configure server-only runtime database permissions for subscription
CRUD, platform grant reads/writes and append-only audit access. Public Data API
roles retain no app schema access. Use a separate migration/provisioning role.

All eight migrations are applied to the user-selected project `danlbqamhuiaqspikazv`.
Runtime database connectivity and the supplied Auth key have been verified with
certificate validation enabled. See supabase-setup.md for remaining configuration.
Dashboard lists are capped at 100 records each;
large deployments will need server-side pagination before expanding this limit.

