import Link from 'next/link';
import { db } from '@/lib/db';
import { CustomerIcon } from '@/components/customer/icons';

export const dynamic = 'force-dynamic';

export default async function CustomerSupportPage() {
  // Fetch active salon branches for contact directory
  const salons = await db.salon.findMany({
    where: { status: 'active' },
    select: {
      id: true,
      name: true,
      branches: {
        where: { status: 'active' },
        select: { id: true, name: true, address: true, phone: true },
      },
    },
  });

  const faqs = [
    {
      q: 'Do I need to pay online when booking an appointment?',
      a: 'No! GlowDesk guarantees zero online prepayment. You never need to enter card details to reserve an appointment. All payments occur in person at the salon reception upon completing your service, using Cash, UPI (GPay/PhonePe/Paytm), or Credit/Debit Card.',
    },
    {
      q: 'What is the salon cancellation and rescheduling policy?',
      a: 'You can reschedule or cancel any upcoming appointment free of charge before your scheduled start time directly from your "My Bookings" tab. If your appointment has already started, please call the branch phone number directly.',
    },
    {
      q: 'How does stylist selection work?',
      a: 'You can choose a preferred stylist from the salon’s roster during Step 3 of the booking wizard. If you don’t have a preference, choose "Any Available Specialist" to unlock the maximum number of open time slots.',
    },
    {
      q: 'Can I book multiple services in one visit?',
      a: 'Yes! You can select multiple services (such as a precision haircut plus beard sculpting or a hair spa treatment). Our booking system automatically schedules the continuous duration so you never have to book multiple separate appointments.',
    },
    {
      q: 'How do I redeem my loyalty points or vouchers?',
      a: 'When you arrive at the salon desk for your appointment or checkout, mention your registered phone number or present your coupon code from the "Offers & Rewards" tab. The front desk staff will deduct your rewards directly from your bill.',
    },
    {
      q: 'What happens if I am running late for my appointment?',
      a: 'Salons hold reserved chairs for up to 15 minutes past your appointment start time. If you anticipate arriving late, tap the branch contact phone number in your booking details to inform your specialist.',
    },
  ];

  return (
    <div className="customer-page support-page">
      <div className="support-header">
        <p className="eyebrow">ASSISTANCE & POLICIES</p>
        <h1>Help & Client Support</h1>
        <p className="muted">
          Frequently asked questions, salon policies, and direct contact details for our partner locations.
        </p>
      </div>

      <div className="support-layout-grid">
        {/* FAQs Section */}
        <section className="faq-section">
          <h2>Booking FAQs</h2>
          <div className="faq-accordion-list">
            {faqs.map((faq, idx) => (
              <details key={idx} className="faq-details-item" open={idx === 0}>
                <summary className="faq-summary">
                  <span>{faq.q}</span>
                  <span className="faq-chevron">▾</span>
                </summary>
                <div className="faq-answer">
                  <p>{faq.a}</p>
                </div>
              </details>
            ))}
          </div>
        </section>

        {/* Contact Directory & Inquiries */}
        <aside className="support-side-panel">
          <div className="contact-dir-card">
            <h3>Salon Branch Directory</h3>
            <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
              Direct numbers for reservations, directions, or immediate chair assistance.
            </p>

            <div className="branches-dir-list">
              {salons.flatMap((s) =>
                s.branches.map((b) => (
                  <div key={b.id} className="dir-item">
                    <strong>{s.name} — {b.name}</strong>
                    {b.address && <p className="muted address-text">{b.address}</p>}
                    {b.phone ? (
                      <a href={`tel:${b.phone}`} className="phone-cta">
                        📞 Call {b.phone}
                      </a>
                    ) : (
                      <span className="phone-cta muted">Contact via Reception</span>
                    )}
                  </div>
                )),
              )}
            </div>
          </div>

          <div className="inquiry-form-card">
            <h3>Need Custom Assistance?</h3>
            <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>
              Our guest support team is here to assist with special bookings or feedback.
            </p>
            <div className="inquiry-contact-box">
              <CustomerIcon name="phone" size={18} />
              <div>
                <strong>Guest Care Desk</strong>
                <p className="muted">Available Mon–Sun · 9 AM to 8 PM IST</p>
                <a href="mailto:support@saloonsync.com" className="support-email">support@saloonsync.com</a>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
