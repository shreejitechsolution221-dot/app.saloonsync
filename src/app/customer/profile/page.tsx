import Link from 'next/link';
import { guard } from '@/lib/auth/page-guard';
import { requireCustomerUser } from '@/lib/authorization/server';
import { db } from '@/lib/db';
import { logout } from '@/server/auth-actions';
import { CustomerProfileEditForm } from '@/components/customer/profile-form';
import { CustomerIcon } from '@/components/customer/icons';

export const dynamic = 'force-dynamic';

export default async function CustomerProfilePage() {
  const user = await guard('customer', requireCustomerUser);
  const profile = await db.customerProfile.findUnique({
    where: { userId: user.id },
    select: { phone: true },
  });

  return (
    <div className="customer-page profile-page">
      <div className="profile-header-area">
        <p className="eyebrow">ACCOUNT & PREFERENCES</p>
        <h1>Profile & Settings</h1>
        <p className="muted">
          Manage your personal details, contact preferences, and account security.
        </p>
      </div>

      <div className="profile-settings-grid">
        {/* Personal Details Panel */}
        <section className="settings-panel">
          <div className="panel-header">
            <CustomerIcon name="profile" size={22} />
            <div>
              <h2>Personal Information</h2>
              <p className="muted">Keep your details updated so stylists can contact you regarding visits.</p>
            </div>
          </div>

          <CustomerProfileEditForm
            displayName={user.displayName}
            phone={profile?.phone || user.mobileNumber || ''}
            email={user.email}
          />
        </section>

        {/* Security & Account Management Panel */}
        <div className="settings-side-column">
          <section className="settings-panel">
            <div className="panel-header">
              <CustomerIcon name="shieldCheck" size={22} />
              <div>
                <h2>Account & Privacy</h2>
                <p className="muted">Your identity is protected with role-based access control.</p>
              </div>
            </div>

            <div className="privacy-info-box">
              <span className="privacy-badge">Shared Identity</span>
              <p style={{ fontSize: 13, margin: '8px 0 14px', lineHeight: 1.6 }}>
                Your GlowDesk client account is private. Salon staff can only see your name and contact number for appointments you schedule.
              </p>
              <Link href="/auth/reset-password?portal=customer" className="secondary btn-sm" style={{ display: 'inline-block' }}>
                Change Password ↗
              </Link>
            </div>

            <div className="account-signout-box">
              <h3>Sign Out</h3>
              <p className="muted" style={{ fontSize: 12, marginBottom: 12 }}>
                End your active session on this device.
              </p>
              <form action={logout}>
                <input type="hidden" name="portal" value="customer" />
                <button type="submit" className="secondary btn-danger btn-sm">
                  Sign out of Customer Space
                </button>
              </form>
            </div>
          </section>

          {/* Quick Support Links */}
          <section className="settings-panel support-shortcut-panel">
            <h3>Need Help?</h3>
            <p className="muted" style={{ fontSize: 13, marginBottom: 14 }}>
              Questions about booking, cancellation policy, or salon payments?
            </p>
            <div className="quick-links-list">
              <Link href="/customer/support" className="support-link-item">
                <CustomerIcon name="help" size={16} />
                <span>Frequently Asked Questions</span>
                <span className="arrow">↗</span>
              </Link>
              <Link href="/customer/offers" className="support-link-item">
                <CustomerIcon name="tag" size={16} />
                <span>Loyalty Points & Rewards</span>
                <span className="arrow">↗</span>
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
