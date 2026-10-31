import 'server-only';
import {businessSchemaReady} from '@/lib/operations/schema-ready';
import { canModule, type SalonModule } from './modules';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { guard } from '@/lib/auth/page-guard';
import { AccessError, requireAuthenticatedUser, requireVerifiedIdentity } from '@/lib/authorization/server';
import { workspaceContextQuery, type WorkspaceContextRow } from './workspace-query';
export const salonContext = cache(async () => {
 const identity = await guard('salon', requireVerifiedIdentity);
 const store = await cookies();
 const selected = store.get('workspace')?.value;
 const [profiles, ready] = await Promise.all([
   db.$queryRaw<WorkspaceContextRow[]>(workspaceContextQuery(identity.user.id, selected)),
   businessSchemaReady(),
 ]);
 const [profile] = profiles;
 const user = await guard('salon', async () => {
   // Preserve first-login profile provisioning when no application row exists.
   if (!profile) return requireAuthenticatedUser();
   if (profile.disabledAt) throw new AccessError('FORBIDDEN');
   const { workspace: _workspace, ...current } = profile;
   return { ...current, email: identity.email.toLowerCase(), auth: identity.client };
 });
 if(!ready)redirect('/salon/setup');
 const row = profile?.workspace;
 if (!row) redirect('/salon/select-workspace');
 const membership = {
   id: row.membershipId, salonId: row.salonId, userId: user.id,
   role: row.role, branchScope: row.branchScope, status: 'active',
   salon: { id: row.salonId, name: row.salonName, status: 'active' },
   branches: row.branches.map(branch => ({ branchId: branch.id })),
 };
 const locationCookie = store.get('workspace_location')?.value;
 const selectedBranchId = row.branches.find(b => locationCookie === `${row.salonId}:${b.id}`)?.id;
 const branches = selectedBranchId ? row.branches.filter(b => b.id === selectedBranchId) : row.branches;
 return {user, membership, salonId: row.salonId, branches, availableBranches: row.branches, selectedBranchId,
   operator: ['owner','admin','manager','receptionist'].includes(row.role),
   administrator: ['owner','admin'].includes(row.role)};
});
export async function requireModule(module:SalonModule) {
 const c=await salonContext();
 if (!canModule(c.membership.role,module)) redirect('/salon/access-denied');
 return c;
}
export async function requireOperations(admin=false,module:SalonModule='customers') {
 const context=await requireModule(module);
 if ((admin && !context.administrator && !(module==='inventory'&&context.membership.role==='inventory')) || (context.membership.branchScope!=='all'&&!['billing','reports','inventory','customers'].includes(module)) || context.membership.role==='staff') redirect('/salon/access-denied');
 return context;
}
export const money=(paise:number)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(paise/100);
export const indiaDate=(date=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
export function dateRange(value:string) { const start=new Date(`${value}T00:00:00+05:30`); return {gte:start,lt:new Date(start.getTime()+86400000)}; }
