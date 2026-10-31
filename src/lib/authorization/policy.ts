export const roles = ['owner', 'admin', 'manager', 'staff', 'receptionist', 'inventory', 'accountant', 'cashier'] as const;
export type Role = typeof roles[number];
export type Permission = 'salon.settings.write' | 'membership.invite' | 'branch.manage' | 'appointment.manage' | 'appointment.assigned.read' | 'ownership.transfer';
const grants: Record<Role, readonly Permission[]> = {
  owner: ['salon.settings.write', 'membership.invite', 'branch.manage', 'appointment.manage', 'appointment.assigned.read', 'ownership.transfer'],
  admin: ['salon.settings.write', 'membership.invite', 'branch.manage', 'appointment.manage', 'appointment.assigned.read'],
  manager: ['appointment.manage', 'appointment.assigned.read'],
  staff: ['appointment.assigned.read'],
  receptionist: ['appointment.manage','appointment.assigned.read'],
  inventory: [],
  accountant: [],
  cashier: [],
};
export function permits(role: string, permission: string) {
  return Object.hasOwn(grants, role) && grants[role as Role].includes(permission as Permission);
}
export function canInvite(actorRole: string, invitedRole: string) {
  return (actorRole === 'owner' && ['admin', 'manager', 'staff', 'receptionist', 'inventory', 'accountant', 'cashier'].includes(invitedRole)) ||
    (actorRole === 'admin' && ['manager', 'staff', 'receptionist', 'inventory', 'accountant', 'cashier'].includes(invitedRole));
}
export function branchPermitted(membership: { branchScope: string; branches: { branchId: string }[] }, branchId: string) {
  return membership.branchScope === 'all' || (membership.branchScope === 'selected' && membership.branches.some(b => b.branchId === branchId));
}
