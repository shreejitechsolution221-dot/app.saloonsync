import Link from 'next/link';
import { Wordmark } from './auth/layout';
import { logout } from '@/server/auth-actions';
export function Dashboard({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="dashboard"><header className="dashboard-header"><Wordmark/><nav aria-label="Account"><span className="badge">{label}</span><form action={logout}><input type="hidden" name="portal" value={label === 'Platform' ? 'platform' : label === 'Customer' ? 'customer' : 'salon'}/><button className="link-button">Sign out</button></form></nav></header><main id="main">{children}</main></div>;
}
