import Link from 'next/link';
import { Wordmark } from '@/components/auth/layout';
import { logout } from '@/server/auth-actions';
import { CustomerIcon } from './icons';

export function CustomerShell({
  active,
  userName = 'Guest',
  loyaltyPoints = 0,
  isLoggedIn = false,
  children,
}: {
  active: string;
  userName?: string;
  loyaltyPoints?: number;
  isLoggedIn?: boolean;
  children: React.ReactNode;
}) {
  const bottomNavItems = [
    { href: '/customer', label: 'Home', icon: 'home', key: 'home' },
    { href: '/customer/explore', label: 'Explore', icon: 'explore', key: 'explore' },
    { href: '/customer/bookings', label: 'My Bookings', icon: 'calendar', key: 'bookings' },
    { href: '/customer/favorites', label: 'Favorites', icon: 'heart', key: 'favorites' },
    { href: '/customer/profile', label: 'Profile', icon: 'profile', key: 'profile' },
  ];

  const headerLinks = [
    { href: '/customer', label: 'Home', key: 'home' },
    { href: '/customer/explore', label: 'Explore Salons', key: 'explore' },
    { href: '/customer/bookings', label: 'My Bookings', key: 'bookings' },
    { href: '/customer/favorites', label: 'Favorites', key: 'favorites' },
    { href: '/customer/offers', label: 'Offers & Rewards', key: 'offers' },
  ];

  return (
    <div className="customer-shell">
      {/* Top Header */}
      <header className="customer-header">
        <div className="customer-header-inner">
          <div className="customer-brand-area">
            <Wordmark />
            <span className="customer-portal-badge">
              <span className="sparkle">✧</span> SaloonSync Client
            </span>
          </div>

          <nav className="customer-desktop-nav" aria-label="Customer navigation">
            {headerLinks.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className={`customer-nav-link ${active === item.key ? 'active' : ''}`}
                aria-current={active === item.key ? 'page' : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="customer-header-actions">
            {loyaltyPoints > 0 && (
              <Link href="/customer/offers" className="customer-points-badge" title="Loyalty Points">
                <CustomerIcon name="sparkles" size={14} />
                <span>{loyaltyPoints} pts</span>
              </Link>
            )}

            <Link
              href="/customer/notifications"
              className={`customer-icon-btn ${active === 'notifications' ? 'active' : ''}`}
              aria-label="Notifications"
            >
              <CustomerIcon name="bell" size={18} />
            </Link>

            <Link
              href="/customer/support"
              className={`customer-icon-btn ${active === 'support' ? 'active' : ''}`}
              aria-label="Help and Support"
              title="Help & FAQs"
            >
              <CustomerIcon name="help" size={18} />
            </Link>

            {isLoggedIn ? (
              <div className="customer-user-chip">
                <Link href="/customer/profile" className="customer-avatar" aria-label="Customer Profile">
                  {userName.slice(0, 2).toUpperCase()}
                </Link>
                <form action={logout}>
                  <input type="hidden" name="portal" value="customer" />
                  <button type="submit" className="customer-signout-btn" title="Sign out">
                    Sign out
                  </button>
                </form>
              </div>
            ) : (
              <div className="customer-user-chip" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <Link href="/customer/login" className="customer-signin-pill">
                  Sign in
                </Link>
                <Link
                  href="/customer/register"
                  className="customer-register-pill"
                  style={{
                    padding: '6px 14px',
                    borderRadius: '20px',
                    background: 'var(--plum, #542c48)',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: 600,
                    textDecoration: 'none',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                  }}
                >
                  Create account
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main id="main" className="customer-main">
        {children}
      </main>

      {/* Mobile & Tablet Bottom Navigation Bar (as per PDF Section 2) */}
      <nav className="customer-bottom-nav" aria-label="Mobile Bottom Navigation">
        {bottomNavItems.map((item) => {
          const isActive = active === item.key;
          return (
            <Link
              key={item.key}
              href={item.href}
              className={`customer-bottom-item ${isActive ? 'active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="bottom-icon-wrap">
                <CustomerIcon name={item.icon} size={20} />
              </span>
              <span className="bottom-label">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <footer className="customer-footer">
        <div className="customer-footer-inner">
          <p>© {new Date().getFullYear()} Saloonsync · SaloonSync Client Experience</p>
          <div className="customer-footer-links">
            <Link href="/customer/support">Help & FAQ</Link>
            <Link href="/customer/offers">Offers</Link>
            <Link href="/customer/bookings">My Bookings</Link>
            <Link href="/salon/login">Salon Portal ↗</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
