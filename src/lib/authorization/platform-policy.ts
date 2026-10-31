export const platformPrivileges = ['platform.manage', 'platform.subscriptions.manage', 'platform.operators.manage'] as const;
export type PlatformPrivilegeName = typeof platformPrivileges[number];
export const platformRoles = {
  admin: [...platformPrivileges],
  manager: ['platform.manage', 'platform.subscriptions.manage'],
} satisfies Record<string, readonly PlatformPrivilegeName[]>;
export function platformRolePrivileges(role: string): readonly PlatformPrivilegeName[] {
  return role === 'admin' || role === 'manager' ? platformRoles[role] : [];
}
