import Link from 'next/link';
import { EmailLinkError } from './email-link-error';
import type { Portal } from '@/lib/auth/redirects';
const context = {
  salon: { label: 'Salon workspace', title: <>A little more care.<br/>A little more <em>in sync.</em></>, description: 'A considered space for the people, appointments, and everyday details behind your salon.', bottom: 'Your salon. Your people. Your rhythm.' },
  customer: { label: 'Your next visit', title: <>Make time<br/>for <em>yourself.</em></>, description: 'Your appointments and personal details, together in one calm, familiar place.', bottom: 'Good days begin with a little care.' },
  platform: { label: 'Platform administration', title: <>Care behind<br/>the <em>whole picture.</em></>, description: 'A dedicated workspace for authorized Saloonsync platform administrators.', bottom: 'Considered access. Clear responsibilities.' },
};
export function Wordmark() { return <Link href="/" className="wordmark" aria-label="Saloonsync home">saloon<span>sync</span><span aria-hidden="true">.</span></Link>; }
export function AuthBrandPanel({ portal }: { portal: Portal }) {
  const copy = context[portal];
  return <aside className="brand-panel" aria-label="About this workspace"><div className="brand-top"><span>A little more in sync</span><span className="asterisk" aria-hidden="true">✳</span></div>
    <div className="brand-art" aria-hidden="true"><svg viewBox="0 0 400 300" fill="none"><ellipse cx="200" cy="272" rx="125" ry="12" fill="#c8b2b6" opacity=".3"/><path d="M112 255V135a88 88 0 0 1 176 0v120" fill="#dcc4c3" stroke="#a67f91" strokeWidth="1.2"/><path d="M127 255V136a73 73 0 0 1 146 0v119Z" fill="#f6ede1" stroke="#aa8696"/><path d="M145 214c0-58 110-58 110 0v40H145Z" fill="#75475f"/><path d="M152 213h96" stroke="#c19daa"/><path d="M154 254v19m92-19v19" stroke="#75475f" strokeWidth="5"/><path d="M180 164c-12-23-9-52 15-71m9 71c20-26 23-50 9-76" stroke="#aa8696" strokeWidth="1.2"/><path d="M181 164c-17-7-33-23-29-43 19 5 28 20 29 43Zm22 0c3-22 17-39 34-43 3 21-11 37-34 43Z" fill="#c3a99a"/><path d="M176 164h35l-5 24h-25Z" fill="#a07c70"/><circle cx="302" cy="86" r="24" stroke="#aa8696"/><path d="M302 49v12m0 50v12m-37-37h12m50 0h12m-63-26 9 9m35 35 9 9m0-53-9 9m-35 35-9 9" stroke="#aa8696"/><path d="M80 232c-8-22-10-49 0-69m0 40c-17-1-28-10-28-24 15 1 27 10 28 24Zm0-15c15-3 22-15 20-29-14 5-21 15-20 29Z" fill="#a8aa93"/><path d="M67 231h26l-4 28H71Z" fill="#bb948e"/></svg></div>
    <div><div className="brand-copy"><h2>{copy.title}</h2><p>{copy.description}</p></div><div className="brand-bottom"><span className="tiny-flower" aria-hidden="true">✧</span><span>{copy.bottom}</span></div></div></aside>;
}
export function AuthLayout({ portal = 'salon', children }: { portal?: Portal; children: React.ReactNode }) {
  return <div className="auth-shell"><div className="auth-main"><header className="auth-header"><Wordmark/><span className="portal-tag">{context[portal].label}</span></header><main id="main" className="auth-content"><EmailLinkError portal={portal}/>{children}</main><footer className="auth-footer"><span>© {new Date().getFullYear()} Saloonsync</span><nav aria-label="Other sign-in experiences"><Link href="/salon/login">Salon</Link><Link href="/customer/login">Customer</Link></nav></footer></div><AuthBrandPanel portal={portal}/></div>;
}

