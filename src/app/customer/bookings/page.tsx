import Link from 'next/link';
import { guard } from '@/lib/auth/page-guard';
import { requireCustomerUser } from '@/lib/authorization/server';
import { getCustomerBookings } from '@/lib/customer/queries';
import { BookingCard } from '@/components/customer/booking-card';
import { CustomerIcon } from '@/components/customer/icons';

export const dynamic = 'force-dynamic';

export default async function CustomerBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await guard('customer', requireCustomerUser);
  const params = await searchParams;
  const { upcoming, past } = await getCustomerBookings(user.id);
  const activeTab = params.tab === 'past' ? 'past' : 'upcoming';

  return (
    <div className="customer-page bookings-page">
      <div className="bookings-header-row">
        <div>
          <p className="eyebrow">YOUR SCHEDULE</p>
          <h1>My Appointments</h1>
          <p className="muted">
            Track upcoming visits, reschedule times, or rebook your favorite salon treatments.
          </p>
        </div>
        <Link href="/customer/book" className="primary">
          Book New Visit +
        </Link>
      </div>

      {/* Tabs */}
      <div className="bookings-tabs-bar" role="tablist">
        <Link
          href="/customer/bookings?tab=upcoming"
          className={`tab-btn ${activeTab === 'upcoming' ? 'active' : ''}`}
          role="tab"
          aria-selected={activeTab === 'upcoming'}
        >
          Upcoming Visits ({upcoming.length})
        </Link>
        <Link
          href="/customer/bookings?tab=past"
          className={`tab-btn ${activeTab === 'past' ? 'active' : ''}`}
          role="tab"
          aria-selected={activeTab === 'past'}
        >
          Past History & Reviews ({past.length})
        </Link>
      </div>

      {/* Tab Content */}
      <div className="bookings-content-area">
        {activeTab === 'upcoming' ? (
          upcoming.length === 0 ? (
            <div className="empty-bookings-box">
              <CustomerIcon name="calendar" size={44} />
              <h3>No upcoming appointments</h3>
              <p className="muted">You don't have any visits scheduled right now. Time to treat yourself!</p>
              <Link href="/customer/book" className="primary" style={{ marginTop: 18 }}>
                Explore & Book Now ↗
              </Link>
            </div>
          ) : (
            <div className="bookings-list">
              {upcoming.map((booking) => (
                <BookingCard key={booking.id} booking={booking} isUpcoming={true} />
              ))}
            </div>
          )
        ) : (
          past.length === 0 ? (
            <div className="empty-bookings-box">
              <CustomerIcon name="clock" size={44} />
              <h3>No past visits recorded</h3>
              <p className="muted">Your completed appointments and reviews will appear here.</p>
              <Link href="/customer/book" className="secondary" style={{ marginTop: 18 }}>
                Book Your First Visit
              </Link>
            </div>
          ) : (
            <div className="bookings-list">
              {past.map((booking) => (
                <BookingCard key={booking.id} booking={booking} isUpcoming={false} />
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
