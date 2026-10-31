import { notFound, redirect } from 'next/navigation';
import { AuthLayout } from '@/components/auth/layout';
import { RecoveryForm } from '@/components/auth/forms';
import { authConfigured, passwordMinimum } from '@/lib/auth/config';
import { portalOf } from '@/lib/auth/redirects';
import { cookies } from 'next/headers';
import { supabase } from '@/lib/auth/supabase';
export const dynamic = 'force-dynamic';
export default async function AuthFlow({ params, searchParams }: { params: Promise<{ flow: string }>; searchParams: Promise<{ error?: string; portal?: string }> }) {
  const { flow } = await params;
  const query = await searchParams;
  const portal = portalOf(query.portal ?? (await cookies()).get('auth_portal')?.value);
  if (flow === 'reset-password') {
    let valid = false;
    try {
      const marker = (await cookies()).get('recovery_user')?.value;
      if (marker) {
        const client = await supabase();
        const { data: { user }, error } = await client.auth.getUser();
        valid = !error && Boolean(user?.email_confirmed_at) && user?.id === marker;
      }
    } catch { /* Fail closed without a current provider-verified session. */ }
    if (!valid) redirect('/auth/forgot-password?portal=' + portal + '&error=recovery');
  }
  const copy = { 'forgot-password': { mode: 'forgot', title: 'A fresh start.', text: 'Enter your email and we’ll send a secure link to reset your password.' }, 'reset-password': { mode: 'reset', title: 'Choose a new password.', text: 'Use a new password that you haven’t used elsewhere.' }, 'verify-email': { mode: 'verify', title: 'Check your inbox.', text: 'Follow the verification link in your email to continue. Need another link?' } } as const;
  if (!Object.hasOwn(copy, flow)) notFound(); const content = copy[flow as keyof typeof copy];
  return <AuthLayout portal={portal}><p className="eyebrow">Your account</p><h1>{content.title}</h1><p className="intro">{content.text}</p>{query.error && <p role="alert" className="status error">This link could not be verified. Request a new link and open it in the same browser.</p>}<RecoveryForm portal={portal} mode={content.mode} minimum={passwordMinimum()} configured={authConfigured()}/></AuthLayout>;
}
