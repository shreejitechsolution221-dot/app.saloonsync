import {customerBookingsQuery,type CustomerBookingRow} from '@/lib/salon/page-queries';
import {ActionForm,Field} from '@/components/salon/forms';
import {recordFeedback} from '@/server/visit-actions';
import { db } from '@/lib/db';
import { requireAuthenticatedUser } from '@/lib/authorization/server';
import { guard } from '@/lib/auth/page-guard';
import { Dashboard } from '@/components/dashboard';
import { CustomerProfileForm } from '@/components/auth/forms';
export const dynamic = 'force-dynamic';
export default async function Customer() {
  const user = await guard('customer', requireAuthenticatedUser);
  const [profile, bookings] = await Promise.all([
    db.customerProfile.findUnique({ where: { userId: user.id }, select: { phone: true } }),
    db.$queryRaw<CustomerBookingRow[]>(customerBookingsQuery(user.id)),
  ]);
  return <Dashboard label="Customer"><div className="dashboard-title"><p className="eyebrow">A moment for you</p><h1>Hello, {user.displayName}.</h1><p className="muted">Your visits and personal details, all together.</p></div><div className="dashboard-grid"><section className="panel"><h2>Your appointments</h2>{bookings.length ? bookings.map(b => <div className="list-row" key={b.id}><div>{b.salon.name} · {b.branch.name}<br/><small>{b.startsAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</small></div><span>{b.status}</span>{b.status==='completed'&&<details><summary>Leave feedback</summary><ActionForm action={recordFeedback} submit="Send feedback"><input type="hidden" name="appointmentId" value={b.id}/><Field name="rating" label="Rating (1–5)" type="number" min={1} max={5}/><label className="field">Comment<textarea name="comment" maxLength={1000}/></label></ActionForm></details>}</div>) : <p className="empty">Your appointments will appear here when you have a booking.</p>}</section><section className="panel"><h2>Your details</h2><p className="muted">{user.email}</p><CustomerProfileForm name={user.displayName} phone={profile?.phone ?? ''}/></section></div></Dashboard>;
}
