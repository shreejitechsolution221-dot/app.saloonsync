import Link from 'next/link';
import { authConfigured } from '@/lib/auth/config';
import { supabase } from '@/lib/auth/supabase';
import { getCustomerLoyaltyOffers } from '@/lib/customer/queries';
import { CustomerIcon } from '@/components/customer/icons';

export const dynamic = 'force-dynamic';

export default async function CustomerOffersPage() {
  let userId: string | undefined;
  if (authConfigured()) {
    try {
      const client = await supabase();
      const {
        data: { user },
      } = await client.auth.getUser();
      if (user) userId = user.id;
    } catch {
      // Unauthenticated
    }
  }

  const { loyaltySummary, activeOffers } = await getCustomerLoyaltyOffers(userId);

  const totalPoints = loyaltySummary.reduce((acc, curr) => acc + curr.points, 0);

  return (
    <div className="customer-page offers-page">
      <div className="offers-header-row">
        <div>
          <p className="eyebrow">REWARDS & PRIVILEGES</p>
          <h1>Offers & Loyalty Rewards</h1>
          <p className="muted">
            Track your earned salon reward points, redeem member benefits, and unlock seasonal discounts.
          </p>
        </div>
      </div>

      {/* Loyalty Points Showcase Card */}
      <section className="loyalty-hero-card">
        <div className="loyalty-card-bg-glow" />
        <div className="loyalty-card-inner">
          <div className="loyalty-tier-badge">
            <CustomerIcon name="sparkles" size={14} /> GlowDesk Rewards Member
          </div>
          <div className="loyalty-balance-row">
            <div>
              <span className="balance-label">AVAILABLE REWARD POINTS</span>
              <strong className="points-number">{totalPoints}</strong>
              <small className="points-value">≈ ₹{Math.round(totalPoints / 10)} credit redeemable at reception</small>
            </div>
            {loyaltySummary[0]?.referralCode && (
              <div className="referral-box">
                <span className="ref-label">YOUR REFERRAL CODE</span>
                <span className="ref-code">{loyaltySummary[0].referralCode}</span>
                <small className="muted">Give 20% off to a friend, earn 250 pts</small>
              </div>
            )}
          </div>

          <div className="loyalty-perks-row">
            <div className="perk-item">
              <span className="perk-check">✓</span> 1 Point per ₹10 spent on services
            </div>
            <div className="perk-item">
              <span className="perk-check">✓</span> Birthday month complimentary hair spa
            </div>
            <div className="perk-item">
              <span className="perk-check">✓</span> Priority booking on weekends
            </div>
          </div>
        </div>
      </section>

      {/* Active Salon Offers & Coupons */}
      <section className="active-offers-section">
        <div className="section-title">
          <h2>Active Vouchers & Promotions</h2>
          <p className="muted">Present these codes at the salon desk during checkout to claim your savings.</p>
        </div>

        {activeOffers.length === 0 ? (
          <div className="empty-offers-box">
            <CustomerIcon name="tag" size={32} />
            <p>No active seasonal vouchers right now. Check back soon for festive discounts!</p>
          </div>
        ) : (
          <div className="offers-grid">
            {activeOffers.map((offer) => (
              <div key={offer.id} className="voucher-card">
                <div className="voucher-stripe" />
                <div className="voucher-body">
                  <div className="voucher-top">
                    <span className="salon-tag">{offer.salonName}</span>
                    <span className="discount-tag">
                      {offer.kind === 'percentage'
                        ? `${offer.value / 100}% OFF`
                        : `₹${offer.value / 100} FLAT OFF`}
                    </span>
                  </div>
                  <h3>{offer.name}</h3>
                  <div className="voucher-code-wrap">
                    <code>{offer.code}</code>
                    <span className="tap-hint">Show at reception</span>
                  </div>
                  <div className="voucher-expiry">
                    <CustomerIcon name="clock" size={12} />
                    <span>Valid through {new Date(offer.expiresAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                </div>
                <div className="voucher-actions">
                  <Link href="/customer/book" className="primary btn-sm">
                    Book & Redeem ↗
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* How to Redeem Guide */}
      <section className="how-to-redeem-card">
        <h3>How to Redeem at Salon</h3>
        <ol className="redeem-steps">
          <li>
            <strong>1. Book your desired service</strong>
            <p>Choose your salon and slot online with zero prepayment required.</p>
          </li>
          <li>
            <strong>2. Enjoy your salon experience</strong>
            <p>Consult with your specialist and relax during your treatment.</p>
          </li>
          <li>
            <strong>3. Apply points or coupon at payment</strong>
            <p>Inform the reception desk of your coupon code or registered mobile number to deduct points from your final invoice.</p>
          </li>
        </ol>
      </section>
    </div>
  );
}
