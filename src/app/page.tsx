import Link from 'next/link';
import { Wordmark } from '@/components/auth/layout';
import { PortalIllustration } from '@/components/portal-illustrations';

export default function Home() {
  const spaces = [
    {
      route: 'salon',
      badge: 'For Salon Teams & Stylists',
      title: 'Run your salon.',
      text: 'A calm, unified workspace for chair schedules, team rosters, live bookings, and client formulas.',
      tags: ['Stylists & Chairs', 'Live Calendar', 'Client Formulas'],
      cta: 'Enter salon workspace',
    },
    {
      route: 'customer',
      badge: 'For Men & Women · Guests',
      title: 'Make time for you.',
      text: 'Personalized haircuts, grooming, styling, and color for both men and women. Effortless booking anytime.',
      tags: ['Men & Women Grooming', 'Stylist Choice', 'Instant Rebook'],
      cta: 'Enter customer space',
    },
  ];

  return (
    <main id="main" className="home">
      <header className="home-header">
        <div className="home-brand">
          <Wordmark />
          <span className="home-header-badge">✦ Salon & Guest Platform</span>
        </div>
        <nav className="home-nav" aria-label="Portal access">
          <Link href="/salon/login" className="home-nav-link">Salon Login</Link>
          <Link href="/customer/login" className="home-nav-link home-nav-link-primary">Client Space</Link>
        </nav>
      </header>

      <section className="home-hero">
        <div className="home-hero-badge">
          <span className="badge-sparkle">✦</span> Elevated Salon Experience
        </div>
        <h1>
          A place for<br />
          <em>every part</em> of your day.
        </h1>
        <p className="home-hero-subtitle">
          Whether you manage chairs, stylists, and calendars — or you are booking your next haircut,
          beard trim, or bespoke color. Choose your dedicated space.
        </p>
      </section>

      <div className="portal-grid">
        {spaces.map((p) => (
          <Link className="portal-card" key={p.route} href={`/${p.route}/login`}>
            <PortalIllustration kind={p.route as 'salon' | 'customer'} />
            <div className="portal-card-body">
              <span className="eyebrow portal-eyebrow">{p.badge}</span>
              <h3>{p.title}</h3>
              <p>{p.text}</p>
              <div className="portal-tags" aria-hidden="true">
                {p.tags.map((tag) => (
                  <span key={tag} className="portal-tag-pill">{tag}</span>
                ))}
              </div>
              <span className="portal-cta">
                <span>{p.cta}</span>
                <span className="arrow-icon" aria-hidden="true">→</span>
              </span>
            </div>
          </Link>
        ))}
      </div>

      <section className="home-features" aria-label="Platform Highlights">
        <div className="feature-item">
          <span className="feature-num">01</span>
          <h4>Tailored for Men & Women</h4>
          <p>From sharp fades and beard detailing to precision cuts, balayage, and restorative treatments.</p>
        </div>
        <div className="feature-item">
          <span className="feature-num">02</span>
          <h4>Real-Time Chair Sync</h4>
          <p>Zero double-bookings. Live availability coordinated smoothly between salon chairs and guests.</p>
        </div>
        <div className="feature-item">
          <span className="feature-num">03</span>
          <h4>One Calm Place</h4>
          <p>Your preferences, formulas, appointment history, and rebooking reminders in one secure hub.</p>
        </div>
      </section>

      <footer className="home-foot">
        <span className="home-foot-tagline">One account. The right space for you.</span>
        <span className="home-foot-copy">© {new Date().getFullYear()} Saloonsync · Built for modern salons</span>
        <div className="home-foot-links">
          <Link href="/salon/login">Salon Teams</Link>
          <span className="foot-sep">·</span>
          <Link href="/customer/login">Guest Portal</Link>
        </div>
      </footer>
    </main>
  );
}

