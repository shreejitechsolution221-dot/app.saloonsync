export const portals = ['platform', 'salon', 'customer'] as const;
export type Portal = typeof portals[number];
export function portalOf(value: unknown): Portal {
  return portals.includes(value as Portal) ? value as Portal : 'salon';
}
const allowed = new Set(['/platform', '/salon', '/salon/select-workspace', '/salon/onboarding', '/salon/invitations/accept', '/customer', '/auth/reset-password']);
export function safeDestination(value: unknown, fallback = '/salon') {
  return typeof value === 'string' && allowed.has(value) ? value : fallback;
}
export function portalDestination(value: unknown, portal: Portal) {
  const destination = safeDestination(value, `/${portal}`);
  return destination === `/${portal}` || destination.startsWith(`/${portal}/`) ? destination : `/${portal}`;
}
