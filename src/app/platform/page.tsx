import { requirePlatformPrivilege } from '@/lib/authorization/server';
import { guard } from '@/lib/auth/page-guard';
import { Dashboard } from '@/components/dashboard';
import { db } from '@/lib/db';
import { SubscriptionForm, OperatorForm } from '@/components/platform-forms';
export const dynamic = 'force-dynamic';
export default async function Platform() {
  const user = await guard('platform', () => requirePlatformPrivilege('platform.manage'));
  const grants = await db.platformPrivilege.findMany({ where: { userId: user.id, status: 'active', revokedAt: null }, select: { privilege: true } });
  const subscriptions = grants.some(g => g.privilege === 'platform.subscriptions.manage');
  const operators = grants.some(g => g.privilege === 'platform.operators.manage');
  // Queries select business subscription metadata only, never salon operations or customer records.
  const [salons, members] = await Promise.all([
    subscriptions ? db.salon.findMany({ orderBy: { name: 'asc' }, take: 100, select: { id: true, name: true, status: true, subscription: true } }) : Promise.resolve([]),
  operators ? db.user.findMany({ where: { disabledAt: null, privileges: { some: { privilege: 'platform.manage', status: 'active', revokedAt: null } } }, select: { id: true, displayName: true, privileges: { where: { status: 'active', revokedAt: null }, select: { privilege: true } } }, take: 100, orderBy: { createdAt: 'desc' } }) : Promise.resolve([]),
  ]);
  return <Dashboard label="Platform"><div className="dashboard-title"><p className="eyebrow">Private platform administration</p><h1>Saloonsync platform.</h1><p className="muted">Manage business subscriptions and your platform team.</p></div><div className="dashboard-grid"><section><h2>Salon subscriptions</h2>{subscriptions ? <><p className="notice">These are manually maintained subscription records. Saving a record does not charge a customer, change a payment-provider subscription, or change salon access.</p>{salons.map(salon => <article className="panel" key={`${salon.id}:${salon.subscription?.version ?? 0}`}><h3>{salon.name}</h3><p className="muted">Business status: {salon.status}</p><SubscriptionForm salon={salon}/></article>)}{!salons.length && <div className="panel"><p className="empty">No salon businesses have been created yet.</p></div>}<p className="hint">Shows up to 100 businesses.</p></> : <p className="notice">Your platform account has no subscription-management privilege.</p>}</section><section><h2>Platform team</h2>{operators ? <><div className="panel"><OperatorForm/></div><div className="panel"><h3>Active platform operators</h3>{members.map(member => <div className="list-row" key={member.id}><div>{member.displayName}<br/><small className="muted" style={{ overflowWrap: 'anywhere' }}>{member.id}</small></div><span>{member.privileges.some(p => p.privilege === 'platform.operators.manage') ? 'Administrator' : member.privileges.some(p => p.privilege === 'platform.subscriptions.manage') ? 'Subscription manager' : 'Entry only'}</span></div>)}<p className="hint">Shows up to 100 active operators.</p></div></> : <p className="notice">Platform team management is restricted to separately authorized administrators.</p>}</section></div></Dashboard>;
}
