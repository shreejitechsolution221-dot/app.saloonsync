import { notFound } from 'next/navigation';
import Link from 'next/link';
import { AuthLayout } from '@/components/auth/layout';
import { RegistrationForm } from '@/components/auth/forms';
import { authConfigured, legalConfig, passwordMinimum } from '@/lib/auth/config';
export const dynamic = 'force-dynamic';
export default async function Register({ params }: { params: Promise<{ portal: string }> }) {
  const { portal } = await params; if (portal !== 'salon' && portal !== 'customer') notFound();
  return <AuthLayout portal={portal}><p className="eyebrow">A fresh beginning</p><h1>{portal === 'salon' ? 'Your salon, in sync.' : 'A little time for you.'}</h1><p className="intro">{portal === 'salon' ? 'Create your owner account. After verifying your email, you can set up your salon’s workspace.' : 'Create your account to manage your personal details and appointments.'}</p><RegistrationForm portal={portal} minimum={passwordMinimum()} legal={legalConfig()} configured={authConfigured()} /></AuthLayout>;
}
