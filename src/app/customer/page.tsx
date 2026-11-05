import Link from 'next/link';
import { optionalCustomerUser } from '@/lib/customer/identity';
import { getCustomerDashboardData } from '@/lib/customer/queries';
import { CustomerIcon } from '@/components/customer/icons';
import { FavoriteButton } from '@/components/customer/favorite-button';

export const dynamic = 'force-dynamic';

export default async function CustomerHomePage() {
  const userId = (await optionalCustomerUser())?.id;

  const data = await getCustomerDashboardData(userId);

  const categories = [
    { name: 'Hair', label: 'Haircuts & Styling', icon: 'scissors', desc: 'Fade, trim, wash & finish' },
    { name: 'Grooming', label: 'Beard & Grooming', icon: 'sparkles', desc: 'Hot towel shave, line-up' },
    { name: 'Color', label: 'Color & Highlights', icon: 'tag', desc: 'Global color, balayage, gloss' },
    { name: 'Spa', label: 'Hair Spa & Scalp', icon: 'clock', desc: 'Deep hydration & steam' },
    { name: 'Facial', label: 'Facials & Skincare', icon: 'sparkles', desc: 'Detox, glow, cleansing' },
  ];

  return (
    <div className="customer-page home-page">
      {/* Hero Welcome & Search Banner */}
      <section className="customer-hero">
        <div className="hero-content">
          <p className="eyebrow">A MOMENT FOR YOU</p>
          <h1>Hello, {data.user.displayName}.</h1>
          <p className="hero-subtitle">
            Find salons, compare services, and book available appointments effortlessly.
          </p>

          <form action="/customer/explore" method="GET" className="customer-search-bar">
            <CustomerIcon name="search" size={18} className="search-icon" />
            <input
              type="search"
              name="q"
              placeholder="Search salon, service, or area (e.g. Haircut, Bandra)..."
              aria-label="Search salons or services"
            />
            <button type="submit" className="primary search-btn">
              Explore
            </button>
          </form>
        </div>
      </section>

      {/* Active Upcoming Appointment Highlight Card */}
      {data.upcomingBooking && (
        <section className="upcoming-booking-section">
          <div className="section-title-row">
            <h2>Your Next Appointment</h2>
            <Link href="/customer/bookings" className="see-all-link">
              View all bookings <span>→</span>
            </Link>
          </div>

          <div className="upcoming-banner-card">
            <div className="upcoming-accent-stripe" />
            <div className="upcoming-main-info">
              <div className="upcoming-top-meta">
                <span className="badge status-badge">{data.upcomingBooking.status}</span>
                <span className="upcoming-time-pill">
                  <CustomerIcon name="clock" size={14} />
                  {new Date(data.upcomingBooking.startsAt).toLocaleString('en-IN', {
                    timeZone: 'Asia/Kolkata',
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })} IST
                </span>
              </div>

              <h3>{data.upcomingBooking.salon.name}</h3>
              <p className="muted branch-name">
                <CustomerIcon name="mapPin" size={14} /> {data.upcomingBooking.branch.name}
                {data.upcomingBooking.branch.address ? ` · ${data.upcomingBooking.branch.address}` : ''}
              </p>

              <div className="service-chip-row">
                <span className="chip">
                  <CustomerIcon name="scissors" size={12} /> {data.upcomingBooking.serviceName}
                </span>
                <span className="chip">
                  <CustomerIcon name="clock" size={12} /> {data.upcomingBooking.durationMinutes} mins
                </span>
                <span className="chip">
                  ₹{(data.upcomingBooking.pricePaise / 100).toLocaleString('en-IN')} (Pay at salon)
                </span>
                {data.upcomingBooking.assignedStaff && (
                  <span className="chip">
                    <CustomerIcon name="profile" size={12} /> Stylist: {data.upcomingBooking.assignedStaff.displayName}
                  </span>
                )}
              </div>
            </div>

            <div className="upcoming-actions">
              <Link href="/customer/bookings" className="primary btn-sm">
                Manage Booking
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Popular Service Categories */}
      <section className="categories-section">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">BROWSE BY SERVICE</p>
            <h2>Popular Categories</h2>
          </div>
          <Link href="/customer/explore" className="see-all-link">
            All services <span>→</span>
          </Link>
        </div>

        <div className="category-cards-grid">
          {categories.map((cat) => (
            <Link
              key={cat.name}
              href={`/customer/explore?category=${cat.name}`}
              className="category-card"
            >
              <div className="cat-icon-wrap">
                <CustomerIcon name={cat.icon} size={22} />
              </div>
              <h4>{cat.label}</h4>
              <p className="muted">{cat.desc}</p>
              <span className="cat-arrow">Explore ↗</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured Salons */}
      <section className="featured-salons-section">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">VERIFIED PARTNER STUDIOS</p>
            <h2>Featured Salons</h2>
          </div>
          <Link href="/customer/explore" className="see-all-link">
            View all salons <span>→</span>
          </Link>
        </div>

        <div className="salons-cards-grid">
          {data.featuredSalons.map((salon) => (
            <article key={salon.id} className="salon-card">
              <div className="salon-card-header">
                <div>
                  <h3>{salon.name}</h3>
                  <div className="rating-pill">
                    <CustomerIcon name="star" size={12} />
                    <span>{salon.rating}</span>
                    <small className="muted">({salon.reviewCount})</small>
                  </div>
                </div>
                <FavoriteButton id={salon.id} type="salon" name={salon.name} />
              </div>

              <div className="salon-branches-list">
                {salon.branches.slice(0, 2).map((b) => (
                  <div key={b.id} className="branch-meta">
                    <CustomerIcon name="mapPin" size={13} />
                    <span>{b.name}{b.address ? ` · ${b.address}` : ''}</span>
                  </div>
                ))}
              </div>

              <div className="salon-services-preview">
                <p className="services-headline">POPULAR SERVICES</p>
                <div className="services-chips">
                  {salon.services.slice(0, 3).map((srv) => (
                    <span key={srv.id} className="srv-tag">
                      {srv.name} (₹{Math.round(srv.pricePaise / 100)})
                    </span>
                  ))}
                </div>
              </div>

              <div className="salon-card-footer">
                <div className="starting-price">
                  <small>Starting from</small>
                  <strong>₹{(salon.startingPricePaise / 100).toLocaleString('en-IN')}</strong>
                </div>
                <div className="salon-cta-group">
                  <Link href={`/customer/salons/${salon.id}`} className="secondary btn-sm">
                    View Menu
                  </Link>
                  <Link href={`/customer/book?salonId=${salon.id}`} className="primary btn-sm">
                    Book Now
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* One-Tap Rebook (Page 4 addition) */}
      {data.recentPastBookings.length > 0 && (
        <section className="rebook-section">
          <div className="section-title-row">
            <div>
              <p className="eyebrow">FAST CHECKOUT</p>
              <h2>One-Tap Rebooking</h2>
            </div>
            <Link href="/customer/bookings" className="see-all-link">
              Past visits <span>→</span>
            </Link>
          </div>

          <div className="rebook-cards-grid">
            {data.recentPastBookings.map((b) => (
              <div key={b.id} className="rebook-card">
                <div className="rebook-info">
                  <h4>{b.serviceName}</h4>
                  <p className="muted">
                    {b.salon.name} · {b.branch.name}
                  </p>
                  <small className="muted">
                    Last visited: {new Date(b.startsAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </small>
                </div>
                <Link
                  href={`/customer/book?salonId=${b.salon.id}&branchId=${b.branch.id}`}
                  className="primary btn-sm rebook-cta"
                >
                  Rebook Visit ↻
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Trust & Booking Guarantees Banner */}
      <section className="customer-trust-banner">
        <div className="trust-grid">
          <div className="trust-item">
            <CustomerIcon name="shieldCheck" size={28} />
            <div>
              <h4>Pay at Salon</h4>
              <p>No upfront payment or card details required. Pay via Cash, UPI, or Card upon completion.</p>
            </div>
          </div>
          <div className="trust-item">
            <CustomerIcon name="calendar" size={28} />
            <div>
              <h4>Real Availability</h4>
              <p>Live schedules synced with salon stylists. Guaranteed no double bookings.</p>
            </div>
          </div>
          <div className="trust-item">
            <CustomerIcon name="clock" size={28} />
            <div>
              <h4>Flexible Rescheduling</h4>
              <p>Change your appointment time or cancel free of charge up to 2 hours before.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
