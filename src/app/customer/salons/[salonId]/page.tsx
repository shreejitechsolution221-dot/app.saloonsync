import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSalonProfileData } from '@/lib/customer/queries';
import { CustomerIcon } from '@/components/customer/icons';
import { FavoriteButton } from '@/components/customer/favorite-button';

export const dynamic = 'force-dynamic';

export default async function CustomerSalonProfilePage({
  params,
}: {
  params: Promise<{ salonId: string }>;
}) {
  const { salonId } = await params;
  const salon = await getSalonProfileData(salonId);

  if (!salon) notFound();

  // Group services by category
  const categoriesMap = new Map<string, typeof salon.services>();
  for (const s of salon.services) {
    const list = categoriesMap.get(s.category) || [];
    list.push(s);
    categoriesMap.set(s.category, list);
  }

  return (
    <div className="customer-page salon-profile-page">
      {/* Back button link */}
      <Link href="/customer/explore" className="back-nav-link">
        <CustomerIcon name="arrowLeft" size={16} /> Back to Explore
      </Link>

      {/* Salon Profile Hero Header */}
      <section className="salon-profile-hero">
        <div className="profile-hero-content">
          <div className="salon-title-row">
            <div>
              <span className="eyebrow">VERIFIED SALON STUDIO</span>
              <h1>{salon.name}</h1>
              <div className="profile-meta-line">
                <span className="rating-badge">★ {salon.rating}</span>
                <span className="review-count">({salon.reviewCount} verified client reviews)</span>
                <span className="hours-badge">Open 9:00 AM – 8:00 PM IST</span>
              </div>
            </div>
            <div className="profile-hero-actions">
              <FavoriteButton id={salon.id} type="salon" name={salon.name} className="profile-fav-btn" />
              <Link href={`/customer/book?salonId=${salon.id}`} className="primary">
                Book Appointment ↗
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div className="profile-layout-grid">
        {/* Main Content Column: Service Menu */}
        <div className="profile-main-col">
          <div className="services-section-heading">
            <h2>Service Menu</h2>
            <p className="muted">Choose from our tailored haircuts, treatments, and grooming experiences.</p>
          </div>

          {Array.from(categoriesMap.entries()).map(([catName, services]) => (
            <div key={catName} className="category-block">
              <h3 className="category-heading">{catName} Services</h3>
              <div className="category-services-list">
                {services.map((srv) => (
                  <div key={srv.id} className="service-item-card">
                    <div className="service-info-col">
                      <h4>{srv.name}</h4>
                      <div className="service-duration-badge">
                        <CustomerIcon name="clock" size={13} /> {srv.durationMinutes} minutes
                      </div>
                      {srv.checklist.length > 0 && (
                        <div className="checklist-preview">
                          <small>Includes:</small> {srv.checklist.join(' · ')}
                        </div>
                      )}
                    </div>

                    <div className="service-action-col">
                      <div className="price-display">
                        <small>Price</small>
                        <strong>₹{(srv.pricePaise / 100).toLocaleString('en-IN')}</strong>
                      </div>
                      <Link
                        href={`/customer/book?salonId=${salon.id}&serviceId=${srv.id}`}
                        className="primary btn-sm"
                      >
                        Book Service ↗
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Specialists / Team section */}
          {salon.staff.length > 0 && (
            <div className="staff-team-section">
              <h3>Our Stylists & Specialists</h3>
              <p className="muted">Choose your favorite specialist when booking your appointment.</p>
              <div className="team-cards-grid">
                {salon.staff.map((member) => (
                  <div key={member.userId} className="team-member-card">
                    <div className="member-avatar">
                      {member.displayName.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="member-info">
                      <h4>{member.displayName}</h4>
                      <p className="muted">{member.role === 'owner' ? 'Lead Stylist & Owner' : member.role === 'manager' ? 'Master Stylist' : 'Senior Specialist'}</p>
                    </div>
                    <Link
                      href={`/customer/book?salonId=${salon.id}&staffId=${member.userId}`}
                      className="secondary btn-sm"
                    >
                      Book with {member.displayName.split(' ')[0]}
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Information Column */}
        <aside className="profile-side-col">
          {/* Booking & Payment Policy Card */}
          <div className="policy-sidebar-card">
            <div className="policy-header">
              <CustomerIcon name="shieldCheck" size={20} />
              <h4>Payment & Booking Policy</h4>
            </div>
            <ul className="policy-checklist">
              <li>
                <strong>Zero Prepayment Required</strong>
                <p>Pay upon service completion at the salon desk via Cash, UPI, or Credit/Debit Card.</p>
              </li>
              <li>
                <strong>Free Reschedule & Cancellation</strong>
                <p>You can reschedule or cancel without any penalty up to 2 hours before your visit.</p>
              </li>
              <li>
                <strong>On-Time Guarantee</strong>
                <p>Your chair is reserved. Arrive 5 minutes prior to enjoy your complimentary consultation.</p>
              </li>
            </ul>
          </div>

          {/* Branch Locations Card */}
          <div className="branches-sidebar-card">
            <h4>Salon Locations ({salon.branches.length})</h4>
            <div className="branches-list">
              {salon.branches.map((b) => (
                <div key={b.id} className="branch-card-item">
                  <strong>{b.name}</strong>
                  {b.address && <p className="muted">{b.address}</p>}
                  {b.phone && <p className="phone-line">📞 {b.phone}</p>}
                  <Link
                    href={`/customer/book?salonId=${salon.id}&branchId=${b.id}`}
                    className="branch-book-link"
                  >
                    Book at this branch ↗
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
