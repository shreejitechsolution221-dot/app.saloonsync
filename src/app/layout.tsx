import type { Metadata } from 'next';
import { WebVitals } from '@/components/web-vitals';
import './globals.css';
export const metadata: Metadata = { title: { default: 'Saloonsync — A little more in sync.', template: '%s · Saloonsync' }, description: 'One place for your salon, your team, and your next visit.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><a className="skip-link" href="#main">Skip to content</a>{children}{process.env.ENABLE_WEB_VITALS === 'true' && <WebVitals/>}</body></html>;
}
