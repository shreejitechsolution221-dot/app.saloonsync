# Review: business operations migration

Applied file: `prisma/migrations/202610290012_business_operations/migration.sql`.

## Exact scope

- Adds 27 operational/integration tables and new optional/defaulted fields to salon, location, customer, appointment, service, product and invoice records.
- Enables RLS for every new table, grants access only to the backend runtime role, and adds composite tenant/actor foreign keys.
- Adds constraints/triggers for approved leave, completed checklists, terminal appointment history, register closing, refund bounds, expense approval and purchase history.
- Adds the cashier membership/invitation preset. Does not grant any platform privilege, change Supabase Auth accounts, rotate credentials, or contact messaging/calendar/storage providers.
- Existing invoice metadata is backfilled from its appointment and preserved total. Existing completed/check-in timestamps are populated from preserved update timestamps.
- No table or user record is deleted. Nullable appointment IDs permit retail invoices alongside existing visit invoices.

## Read-only production preflight

The configured Supabase database contains 2 salons, 0 appointments and 0 invoices. Therefore the invoice/completion backfills affect **zero existing rows**. Appointment and invoice relations occupy approximately 80 KB and 40 KB including indexes. The expansion is not already present.

## Failure and rollback boundary

The complete migration is wrapped in one explicit PostgreSQL transaction, with a 5-second lock timeout and a 60-second statement timeout. Any SQL failure rolls the entire transaction back rather than leaving partial feature tables. The migration was executed successfully against isolated PostgreSQL fixtures with existing integrity tests.

After successful deployment and new feature use, rollback is a separate operation: preserve newly entered operational records and restore a reviewed application/database backup if necessary. There is no automatic destructive down-migration. Do not drop feature tables to work around a deployment error.

The app has a schema-readiness guard so an unapproved/incomplete rollout shows an update-required page instead of querying missing tables.

## Approval history

Automatic approval review rejected the first deployment attempt because the schema change was broad and rollback uncertainty was too high. No production changes were made by that rejected command. The preflight and transaction protections above were added afterward to make the production impact concrete and reduce rollout risk. The revised command passed automatic review and the migration was applied successfully. Follow-up migrations add location stock and origin-location customer scoping.
