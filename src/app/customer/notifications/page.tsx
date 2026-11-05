import Link from 'next/link';
import { guard } from '@/lib/auth/page-guard';
import { requireCustomerUser } from '@/lib/authorization/server';
import { db } from '@/lib/db';
import { CustomerIcon } from '@/components/customer/icons';

export const dynamic = 'force-dynamic';

export default async function CustomerNotificationsPage() {
  const user = await guard('customer', requireCustomerUser);

  // Derive recent booking activity from the customer’s appointments.
  const [appointments] = await Promise.all([
    db.appointment.findMany({
      where: { customerUserId: user.id },
      orderBy: { updatedAt: 'desc' },
      take: 5,
      include: {
        salon: { select: { name: true } },
        branch: { select: { name: true } },
      },
    }),

  ]);

  const notifications = appointments.map((a) => {
    const isCancelled = a.status === 'cancelled';
    const isCompleted = a.status === 'completed';
    return {
      id: a.id,
      title: isCancelled
        ? `Appointment Cancelled`
        : isCompleted
        ? `Service Completed: ${a.serviceName}`
        : `Booking Confirmed: ${a.serviceName}`,
      description: `At ${a.salon.name} (${a.branch.name}) on ${new Date(a.startsAt).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        dateStyle: 'medium',
        timeStyle: 'short',
      })}`,
      time: a.updatedAt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'short', timeStyle: 'short' }),
      kind: isCancelled ? 'alert' : isCompleted ? 'success' : 'info',
    };
  });

  return (
    <div className="customer-page notifications-page">
      <div className="notifications-header">
        <p className="eyebrow">UPDATES & ALERTS</p>
        <h1>Notifications</h1>
        <p className="muted">
          Real-time appointment confirmations, 24-hour visit reminders, and alert preferences.
        </p>
      </div>

      <div className="notifications-layout">
        {/* Activity Feed */}
        <section className="notifications-feed-section">
          <h2>Recent Activity</h2>
          {notifications.length === 0 ? (
            <div className="empty-notif-box">
              <CustomerIcon name="bell" size={36} />
              <p>No notifications right now.</p>
              <small className="muted">When you book or reschedule appointments, updates will appear here.</small>
            </div>
          ) : (
            <div className="notif-list">
              {notifications.map((n) => (
                <div key={n.id} className={`notif-item ${n.kind}`}>
                  <div className="notif-icon-bubble">
                    <CustomerIcon name={n.kind === 'alert' ? 'x' : 'check'} size={16} />
                  </div>
                  <div className="notif-content">
                    <div className="notif-top">
                      <strong>{n.title}</strong>
                      <span className="notif-timestamp">{n.time}</span>
                    </div>
                    <p className="muted">{n.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Preferences Side Panel */}
        <aside className="notifications-prefs-panel">
          <div className="prefs-card">
            <div className="prefs-card-header">
              <CustomerIcon name="shieldCheck" size={20} />
              <h3>Notification Channels</h3>
            </div>
            <p className="muted" style={{ fontSize: 13, marginBottom: 18 }}>
              Appointment updates are available in your booking history.
            </p>

            <p className="muted">Choose WhatsApp consent when booking your appointment. Message delivery depends on your salon’s notification setup.</p>
            <Link href="/customer/bookings" className="secondary">View your bookings</Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
