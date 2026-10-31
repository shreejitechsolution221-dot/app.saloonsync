import Link from 'next/link';
import { AuthLayout } from '@/components/auth/layout';
import { OnboardingForm } from '@/components/auth/forms';
import { legalConfig } from '@/lib/auth/config';
import { guard } from '@/lib/auth/page-guard';
import { requireAuthenticatedUser } from '@/lib/authorization/server';
export const dynamic = 'force-dynamic';
export default async function Onboarding() {
  const user = await guard('salon', requireAuthenticatedUser);
  return <AuthLayout><Link className="back" href="/salon/select-workspace">← Your workspaces</Link><p className="eyebrow">Make yourself at home</p><h1>Let’s meet your salon.</h1><p className="intro">Start with your salon and its first location. You’ll be the owner of this new workspace.</p><OnboardingForm legal={legalConfig()} salonName={user.salonRegistrationName ?? ''}/><p className="invitation-note">Joining an existing salon? Use your administrator’s invitation instead.</p></AuthLayout>;
}
