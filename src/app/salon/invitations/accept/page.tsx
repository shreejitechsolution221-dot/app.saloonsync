import Link from 'next/link';
import { AuthLayout } from '@/components/auth/layout';
import { AcceptInvitationForm } from '@/components/auth/forms';
import { InvitationCapture } from '@/components/auth/invitation-capture';
export const dynamic = 'force-dynamic';
export default function AcceptInvitation() {
  return <AuthLayout><p className="eyebrow">You’re invited</p><h1>Join your people.</h1><p className="intro">Sign in with the email address your administrator invited, verify it, then accept your invitation below.</p><InvitationCapture/><div className="actions" style={{ marginBottom: 25 }}><Link className="secondary" href="/salon/login?next=/salon/invitations/accept">Sign in</Link><Link className="secondary" href="/customer/register">Create an account</Link></div><AcceptInvitationForm/><p className="invitation-note">Creating an account here does not create a salon. The invitation determines your workspace, role and branch access.</p></AuthLayout>;
}
