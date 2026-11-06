import type { PlatformPrivilegeName } from '@/lib/authorization/platform-policy';

export const sections = [
  { slug: '', label: 'Overview', privilege: 'platform.manage', description: 'Your SaloonSync ecosystem at a glance.' },
  { slug: 'salons', label: 'Salon Management', privilege: 'platform.salons.manage', description: 'Review applications, validate profiles and guide salons from registration to activation.' },
  { slug: 'users', label: 'Users & Access', privilege: 'platform.users.manage', description: 'Find accounts, review memberships and manage explicitly assigned platform access.' },
  { slug: 'plans', label: 'Plans & Subscriptions', privilege: 'platform.subscriptions.manage', description: 'Configure plans, entitlements, trials and grace periods. Billing enforcement is off.' },
  { slug: 'analytics', label: 'Platform Analytics', privilege: 'platform.analytics.read', description: 'Acquisition, activation, retention and aggregate booking trends.' },
  { slug: 'support', label: 'Support Center', privilege: 'platform.support.manage', description: 'Verify requesters, assign cases, document escalations and track resolutions.' },
  { slug: 'security', label: 'Security & Audit', privilege: 'platform.security.manage', description: 'Review platform activity, investigate signals and approve scoped support requests.' },
  { slug: 'configuration', label: 'Features & Configuration', privilege: 'platform.configuration.manage', description: 'Manage targeted rollouts, reusable service templates and platform policies.' },
  { slug: 'announcements', label: 'Announcements', privilege: 'platform.announcements.manage', description: 'Publish platform updates and maintenance notices to selected salons.' },
  { slug: 'jobs', label: 'Integrations & Jobs', privilege: 'platform.jobs.manage', description: 'Track provider status, delivery exceptions and operational retry requests.' },
  { slug: 'health', label: 'System Health', privilege: 'platform.health.read', description: 'Database readiness, outstanding jobs and incident response.' },
  { slug: 'settings', label: 'Settings', privilege: 'platform.manage', description: 'Account preferences, platform identity, localization, legal links and support contacts.' },
] as const satisfies readonly { slug: string; label: string; privilege: PlatformPrivilegeName; description: string }[];

export type Field = { name: string; label: string; type?: 'textarea' | 'number' | 'datetime-local' | 'email' | 'url'; options?: readonly string[]; required?: boolean; max?: number; placeholder?: string; hint?: string };
type Definition = { label: string; section: string; privilege: PlatformPrivilegeName; statuses: readonly string[]; fields: readonly Field[] };
export const recordTypes = {
  ticket: { label: 'Support ticket', section: 'support', privilege: 'platform.support.manage', statuses: ['open', 'verified', 'in_progress', 'escalated', 'resolved', 'closed'], fields: [
    { name: 'priority', label: 'Urgency', options: ['low', 'normal', 'high', 'urgent'] }, { name: 'requester', label: 'Requester contact', required: true },
    { name: 'verification', label: 'Requester verification evidence' }, { name: 'notes', label: 'Case notes / resolution', type: 'textarea', required: true },
  ] },
  plan: { label: 'Plan', section: 'plans', privilege: 'platform.subscriptions.manage', statuses: ['draft', 'published', 'archived'], fields: [
    { name: 'code', label: 'Plan code', required: true, placeholder: 'temp-starter', hint: 'Internal ID, such as temp-starter or pro-monthly. Start with a lowercase letter; use 2–80 characters without spaces. The plan name can contain spaces and capitals.' }, { name: 'pricePaise', label: 'Monthly price (paise)', type: 'number', max: 100000000 },
    { name: 'branchLimit', label: 'Branch limit', type: 'number', max: 10000 }, { name: 'staffLimit', label: 'Staff limit', type: 'number', max: 100000 },
    { name: 'trialDays', label: 'Trial days', type: 'number', max: 365 }, { name: 'graceDays', label: 'Renewal grace days', type: 'number', max: 365 },
    { name: 'entitlements', label: 'Entitlements (comma-separated feature keys)', type: 'textarea' },
  ] },
  flag: { label: 'Feature rollout', section: 'configuration', privilege: 'platform.configuration.manage', statuses: ['disabled', 'enabled'], fields: [
    { name: 'code', label: 'Feature key (online_booking is enforced; other keys require a consumer)', required: true }, { name: 'planCode', label: 'Target plan code (optional)' }, { name: 'group', label: 'Rollout group (optional)' },
    { name: 'percentage', label: 'Rollout percentage', type: 'number', max: 100 }, { name: 'notes', label: 'Rollout notes', type: 'textarea' },
  ] },
  template: { label: 'Service template', section: 'configuration', privilege: 'platform.configuration.manage', statuses: ['draft', 'published', 'archived'], fields: [
    { name: 'category', label: 'Service category', required: true }, { name: 'duration', label: 'Duration (minutes)', type: 'number', max: 1440 }, { name: 'notes', label: 'Template description', type: 'textarea', required: true },
  ] },
  policy: { label: 'Platform policy', section: 'configuration', privilege: 'platform.configuration.manage', statuses: ['draft', 'published', 'archived'], fields: [
    { name: 'code', label: 'Policy key', required: true }, { name: 'notes', label: 'Policy content', type: 'textarea', required: true },
  ] },
  announcement: { label: 'Announcement', section: 'announcements', privilege: 'platform.announcements.manage', statuses: ['draft', 'published', 'archived'], fields: [
    { name: 'category', label: 'Message type', options: ['update', 'maintenance', 'incident'] }, { name: 'planCode', label: 'Target plan (optional)' },
    { name: 'startsAt', label: 'Display from (UTC)', type: 'datetime-local' }, { name: 'expiresAt', label: 'Display until (UTC)', type: 'datetime-local' }, { name: 'notes', label: 'Message', type: 'textarea', required: true },
  ] },
  integration: { label: 'Provider status', section: 'jobs', privilege: 'platform.jobs.manage', statuses: ['not_configured', 'operational', 'degraded', 'outage'], fields: [
    { name: 'provider', label: 'Provider', options: ['email', 'sms', 'whatsapp', 'google_calendar', 'payments', 'other'] }, { name: 'notes', label: 'Observed status / evidence', type: 'textarea', required: true },
  ] },
  job: { label: 'Delivery / sync exception', section: 'jobs', privilege: 'platform.jobs.manage', statuses: ['failed', 'retry_requested', 'investigating', 'resolved'], fields: [
    { name: 'provider', label: 'Provider', options: ['email', 'sms', 'whatsapp', 'google_calendar', 'other'] }, { name: 'externalId', label: 'External job reference', required: true },
    { name: 'notes', label: 'Failure details / recovery evidence', type: 'textarea', required: true },
  ] },
  incident: { label: 'Operational incident', section: 'health', privilege: 'platform.jobs.manage', statuses: ['detected', 'assessing', 'communicating', 'recovering', 'resolved'], fields: [
    { name: 'priority', label: 'Severity', options: ['low', 'normal', 'high', 'urgent'] }, { name: 'notes', label: 'Impact / communications / recovery timeline', type: 'textarea', required: true },
  ] },
  alert: { label: 'Security / fraud review', section: 'security', privilege: 'platform.security.manage', statuses: ['open', 'investigating', 'dismissed', 'resolved'], fields: [
    { name: 'signal', label: 'Signal', options: ['unusual_account', 'unusual_bookings', 'login', 'permission', 'other'] }, { name: 'notes', label: 'Evidence / investigation notes', type: 'textarea', required: true },
  ] },
  access: { label: 'Scoped support access request', section: 'support', privilege: 'platform.support.manage', statuses: ['requested', 'approved', 'rejected', 'revoked'], fields: [
    { name: 'ticketId', label: 'Verified support ticket UUID', required: true }, { name: 'scope', label: 'Requested scope', options: ['onboarding_metadata', 'integration_metadata'] },
    { name: 'consent', label: 'Salon owner consent reference', required: true }, { name: 'expiresAt', label: 'Expires at (UTC, within 60 minutes)', type: 'datetime-local', required: true },
    { name: 'notes', label: 'Business justification', type: 'textarea', required: true },
  ] },
  invitation: { label: 'Admin invitation request', section: 'users', privilege: 'platform.operators.manage', statuses: ['pending', 'accepted', 'revoked'], fields: [
    { name: 'email', label: 'Invitee email', type: 'email', required: true }, { name: 'role', label: 'Proposed role', options: ['operations', 'support', 'billing', 'security', 'admin'] },
    { name: 'expiresAt', label: 'Expires at (UTC)', type: 'datetime-local', required: true }, { name: 'notes', label: 'Invitation context', type: 'textarea' },
  ] },
  preference: { label: 'My preferences', section: 'settings', privilege: 'platform.manage', statuses: ['active'], fields: [
    { name: 'locale', label: 'Heading date locale', options: ['en-IN', 'en-US', 'hi-IN'] },
    { name: 'timezone', label: 'Timezone', options: ['Asia/Kolkata', 'UTC'] }, { name: 'density', label: 'Display density', options: ['comfortable', 'compact'] },
  ] },
  settings: { label: 'Platform settings', section: 'settings', privilege: 'platform.settings.manage', statuses: ['active'], fields: [
    { name: 'supportEmail', label: 'Support email', type: 'email', required: true }, { name: 'locale', label: 'Locale', options: ['en-IN', 'en-US', 'hi-IN'] },
    { name: 'timezone', label: 'Timezone', options: ['Asia/Kolkata', 'UTC'] }, { name: 'termsUrl', label: 'Terms URL', type: 'url' }, { name: 'privacyUrl', label: 'Privacy URL', type: 'url' },
    { name: 'notes', label: 'Platform profile / support hours', type: 'textarea' },
  ] },
} as const satisfies Record<string, Definition>;
export type RecordKind = keyof typeof recordTypes;
export function isRecordKind(value: string): value is RecordKind { return Object.hasOwn(recordTypes, value); }
export function fieldsFor(kind: RecordKind): readonly Field[] { return recordTypes[kind].fields; }
