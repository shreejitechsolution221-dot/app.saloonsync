import {workspaceChoicesQuery,type WorkspaceChoice} from '@/lib/salon/page-queries';
import Link from 'next/link';
import { db } from '@/lib/db';
import { guard } from '@/lib/auth/page-guard';
import { requireSalonUser } from '@/lib/authorization/server';
import { selectWorkspace } from '@/server/workspaces';
import { Dashboard } from '@/components/dashboard';
export const dynamic = 'force-dynamic';
export default async function SelectWorkspace() {
  const user = await guard('salon', requireSalonUser);
  const memberships = await db.$queryRaw<WorkspaceChoice[]>(workspaceChoicesQuery(user.id));
  const active = memberships.filter(m => m.status === 'active' && m.salon.status === 'active');
  return <Dashboard label="Your workspaces"><div className="dashboard-title"><p className="eyebrow">Welcome, {user.displayName}</p><h1>Find your workspace.</h1><p className="muted">Choose the salon you’re working with today.</p></div><section className="panel">{memberships.length === 100 && <p className="notice">Showing the first 100 workspaces. Contact support if your workspace is missing.</p>}<div className="workspace-list">{active.map(m => <form action={selectWorkspace} key={m.id} className="workspace-item"><input type="hidden" name="salonId" value={m.salonId}/><div><h3>{m.salon.name}</h3><p className="muted">{m.role} · {m.branchScope === 'all' ? 'All branches' : 'Selected branches'}</p><ul>{m.salon.branches.map(branch => <li key={branch.id}>{branch.name}{branch.address ? ` — ${branch.address}` : " — Address not added"}</li>)}</ul>{!m.salon.branches.length && <p className="muted">No active locations assigned. Contact the salon owner.</p>}{m.salon.branches.length === 50 && <p className="hint">Showing the first 50 locations.</p>}</div><button className="primary">Open ↗</button></form>)}</div>{!active.length && <p className="empty">You don’t have an active salon workspace yet. Create your salon or use the invitation from your administrator.</p>}{memberships.some(m => m.status === 'suspended' || m.status === 'revoked' || m.salon.status !== 'active') && <p className="notice">Some workspace access is unavailable. Contact the salon owner for assistance.</p>}</section><div className="actions"><Link className="secondary" href="/salon/onboarding">Set up a new salon</Link></div></Dashboard>;
}
