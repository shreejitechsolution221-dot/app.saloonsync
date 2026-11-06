# SaloonSync platform administration

The platform console lives at `/platform`. It is separate from the salon and customer workspaces. All platform sessions require a verified identity, a current `platform.manage` grant and MFA. Navigation and server actions enforce separate privileges for each responsibility.

## Included areas

| Area | Implemented behavior |
| --- | --- |
| Overview | Live salon, registration and booking counts; onboarding stages; recent registrations; role-filtered quick actions and operational alerts |
| Salon Management | Search and pagination, owner contacts, branch/service/membership counts, setup milestones, profile review, rollout groups, activation and suspension with reasons |
| Users & Access | Account search by name, UUID and phone, account status, membership review/revocation, last-owner safeguards, platform role assignment, recipient-bound admin invitations |
| Plans & Subscriptions | Versioned plan definitions, entitlements, prices, branch/staff limits, trials, renewal grace policies and manually maintained salon subscription records |
| Platform Analytics | Six-month acquisition and booking counts, activation rate, booking retention cohorts, feature adoption, manual plan conversion and an explicitly labeled pace projection |
| Support Center | Tickets, requester verification, urgency, assignment, queue-load routing, escalation, resolution and audited case history; scoped support metadata requests |
| Security & Audit | Platform activity and permission change logs, human-reviewed security alerts, a booking-volume anomaly signal, independent support-access review |
| Features & Configuration | Feature flags targeted by salon, plan or rollout group with deterministic percentage rollout; service templates and policies |
| Announcements | Draft/published/archived updates, maintenance and incident communications, salon/plan targeting and time windows; published messages appear in the salon workspace |
| Integrations & Jobs | Operator-maintained provider states, delivery/sync failures, assignment, investigation, retry requests and resolution evidence |
| System Health | Live database probe, recorded job backlog, operational incidents, impact/recovery timeline and explicit monitoring connection status |
| Settings | Private operator locale/timezone and display density, platform profile, support contact, localization defaults and HTTPS legal links |

## Roles

- **Super admin:** every platform privilege, including operator assignment.
- **Operations admin:** salon reviews, analytics, feature configuration, announcements, jobs and health.
- **Support agent:** tickets and consented support metadata requests.
- **Billing admin:** plans and subscription records.
- **Security / audit admin:** security review, independent access approval and health.

Legacy `admin` and `manager` identifiers remain supported. Existing grants are not silently expanded by the migration. An existing authorized operator manager can assign the Super admin role in Users & Access; their operator UUID appears on that page. Controlled initial provisioning is also available through `npm run platform:grant -- <uuid> grant <reason>`.

## Deployment

1. Apply `prisma/migrations/202611050019_platform_console/migration.sql` using `npm run db:migrate` against the intended database after approval. The migration adds the control-plane table, foreign keys, indexes, runtime-only access and recognized privilege names. It does not grant new powers to existing accounts.
2. Assign expanded platform roles explicitly.
3. Run `npm run build` and deploy through the existing deployment process.

The platform-console migration has been applied to the configured database following explicit approval. Existing accounts still need separately assigned expanded platform grants. The pre-migration fallback remains available for other databases that have not yet been upgraded.

## Workflow details and boundaries

All sensitive writes validate inputs, check the request origin, rate-limit the actor, check current privileges inside the same management lock as role revocation, and create audit events transactionally. Versioned records reject stale edits. Salon membership revocation coordinates with team changes and protects the last active owner. Account suspension requires platform grant revocation first and also protects the last enabled salon owner.

Every operator can manage their own preferences in Settings. Personal preference records are filtered to the current operator and ownership is rechecked on writes; global platform settings still require the separate settings-management privilege. The selected timezone/locale formats the console heading date, and density adjusts console spacing. Audit timestamps remain explicitly labeled IST.

Admin invitations are saved for manual sharing; no email is sent. Invitees sign in using their existing account's normal salon/customer portal, open the invitation URL, verify MFA, and accept with the exact verified email. The invitation expires within seven days, the grantor must still be authorized, and acceptance is audited. Existing grants are additive on acceptance; deliberate role replacement uses the role-assignment form.

For support, verify an open case, record the owner-consent reference, select the assigned operator, request a metadata scope and set an expiry within 60 minutes. Another security-authorized operator must approve the unchanged scope. Inspection checks approval, assignment, expiry and the still-open verified case on every request and records each access. Only onboarding counts or integration status metadata are returned. This is a scoped support view, not full session impersonation: salon-private customer/financial data and salon-owner privileges are never granted.

The `online_booking` flag is enforced in the transactional customer-booking action. With no matching rule, existing behavior continues. An enabled matching rule permits only its selected percentage of salons; a disabled matching rule disables that feature for its target. Other feature keys can be stored for future consumers but do not automatically control unrelated application functionality. Plan limits and entitlements remain configuration during development.

Support case history preserves status, actor, notes and assignment in audit events. The console displays up to the 200 newest changes across the current record page. Forms paginate records in sets of 20, list up to 500 salons for targeting and up to 100 active operators for assignment.

## External capabilities still requiring configuration

- Subscription checkout, automatic renewal/grace enforcement, payment reconciliation and provider payment history are disabled during development. A verified billing provider and launch activation are required before enabling them.
- Delivery and Google Calendar failures can be recorded and assigned, but retry requests do not execute external jobs. Provider adapters, credentials and workers are required for automatic retries and live provider telemetry.
- Historical uptime, API monitoring and login-provider security signals require a monitoring/auth-log integration. No fabricated uptime or delivery success metrics are displayed.
- Fraud review uses an explicit threshold of 100 bookings created per salon in an hour. Registration projections extrapolate the last 30 days. These are transparent heuristics for human review, not machine-learning predictions.
- Global settings, service templates and policies are control-plane configuration records; applying templates to tenant catalogs and replacing environment-managed legal/auth settings require dedicated downstream consumers.

## Verification

Unit tests cover specialist permissions, denied actions, transactional reauthorization, stale edits, requester verification, independent approval, scope integrity, access expiry, invitation acceptance restrictions, input validation and rollout targeting. Server-render tests exercise all twelve console areas and deny unauthorized section access before querying records. The SQL migration is tested in PGlite with the complete existing migration chain, backend-only table access and privilege constraints. Desktop/mobile visual fixtures are generated locally with synthetic data only.
