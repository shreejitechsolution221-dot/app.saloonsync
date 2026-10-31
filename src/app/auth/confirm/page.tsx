import { recoveryTokenPattern } from '@/lib/auth/recovery-token';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { AuthLayout } from '@/components/auth/layout';
import { ConfirmRecoveryForm } from '@/components/auth/confirm-recovery';
import { portalOf } from '@/lib/auth/redirects';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Confirm password reset', robots: { index: false, follow: false } };
export default async function ConfirmRecovery({searchParams}:{searchParams:Promise<{token_hash?:string;type?:string;portal?:string;code?:string}>}) {
  const query = await searchParams;
  const portal = portalOf(query.portal ?? (await cookies()).get('auth_portal')?.value);
  // Support the original PKCE email template while the provider template is updated.
  if (query.code) redirect('/auth/callback?next=/auth/reset-password&portal='+portal+'&code='+encodeURIComponent(query.code));
  const valid = query.type === 'recovery' && typeof query.token_hash === 'string' && recoveryTokenPattern.test(query.token_hash);
  return <AuthLayout portal={portal}><p className="eyebrow">Secure password recovery</p><h1>Reset your password.</h1>{valid ? <><p className="intro">Select Continue to verify your email link and choose a new password.</p><ConfirmRecoveryForm tokenHash={query.token_hash!} portal={portal}/></> : <><p className="status error" role="alert">This reset link is incomplete or invalid.</p><Link href={`/auth/forgot-password?portal=${portal}`}>Request a new reset email</Link></>}</AuthLayout>;
}

