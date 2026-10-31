'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Portal } from '@/lib/auth/redirects';

// URL fragments never reach the server. Read only provider error markers here;
// provider text and tokens are never rendered or treated as authentication.
export function EmailLinkError({ portal }: { portal: Portal }) {
  const pathname = usePathname();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
    const inspect = () => {
      const hash = new URLSearchParams(window.location.hash.slice(1));
      if (!hash.has('error') && !hash.has('error_code')) return;
      setFailed(!new URLSearchParams(window.location.search).has('error'));
      const clean = new URL(window.location.href);
      clean.hash = '';
      for (const key of ['error', 'error_code', 'error_description']) clean.searchParams.delete(key);
      window.history.replaceState(window.history.state, '', clean.pathname + clean.search);
    };
    inspect(); window.addEventListener('hashchange', inspect);
    return () => window.removeEventListener('hashchange', inspect);
  }, [pathname]);
  if (!failed) return null;
  return <section className="status error" role="alert"><strong>This email link is invalid or has expired.</strong><p>If your email is already verified, request a fresh password reset link. Open only the newest email in this same browser.</p><Link href={`/auth/forgot-password?portal=${portal}`}>Request a new password reset link</Link><p><Link href={`/auth/verify-email?portal=${portal}`}>Resend email verification</Link></p></section>;
}


