export const platformPrivileges = ['platform.manage', 'platform.subscriptions.manage', 'platform.operators.manage', 'platform.salons.manage', 'platform.users.manage', 'platform.analytics.read', 'platform.support.manage', 'platform.security.manage', 'platform.configuration.manage', 'platform.announcements.manage', 'platform.jobs.manage', 'platform.health.read', 'platform.settings.manage'] as const;
export type PlatformPrivilegeName = typeof platformPrivileges[number];
export const platformRoles = {
  admin: [...platformPrivileges],
  manager: ['platform.manage', 'platform.subscriptions.manage'],
  operations: ['platform.manage', 'platform.salons.manage', 'platform.analytics.read', 'platform.configuration.manage', 'platform.announcements.manage', 'platform.jobs.manage', 'platform.health.read'],
  support: ['platform.manage', 'platform.support.manage'],
  billing: ['platform.manage', 'platform.subscriptions.manage'],
  security: ['platform.manage', 'platform.security.manage', 'platform.health.read'],
} satisfies Record<string, readonly PlatformPrivilegeName[]>;
export function platformRolePrivileges(role: string): readonly PlatformPrivilegeName[] {
  return Object.hasOwn(platformRoles, role) ? platformRoles[role as keyof typeof platformRoles] : [];
}
