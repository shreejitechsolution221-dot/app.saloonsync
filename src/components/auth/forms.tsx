'use client';
import { useActionState, useState } from 'react';
import Link from 'next/link';
import { authenticate, register, forgotPassword, resetPassword, resendVerification, updateCustomer, type FormState } from '@/server/auth-actions';
import { createWorkspace, createInvitation, acceptInvitation, transferOwnership } from '@/server/workspaces';
import type { Portal } from '@/lib/auth/redirects';
import { EmailSentDialog } from './email-login';
import { PasswordOrOtpLogin } from './password-or-otp';
import { PasswordField } from './password-field';
import { PasswordCreationFields } from './password-creation';
export function AuthStatusMessage({ state }: { state: FormState }) {
  return <>{state.error && <div className="status error" role="alert">{state.error}</div>}{state.message && <div className="status" role="status">{state.message}{state.link && <p><a href={state.link}>{state.link}</a></p>}</div>}</>;
}
export function EmailField({ errors }: { errors?: string[] }) {
  return <div className="field"><label htmlFor="email">Email address</label><input id="email" name="email" type="email" autoComplete="email" placeholder="Your email address" required maxLength={254} aria-invalid={Boolean(errors)} aria-describedby={errors ? 'email-error' : undefined}/>{errors && <span className="field-error" id="email-error">{errors[0]}</span>}</div>;
}
export { PasswordField } from './password-field';
export function ConsentField({ legal }: { legal: { terms: string; privacy: string; ready: boolean } }) {
  if (!legal.ready) return <p className="notice">Registration is not open yet. The service terms and privacy notice are being configured.</p>;
  return <label className="consent"><input type="checkbox" name="consent" required/><span>I accept the <a href={legal.terms} target="_blank" rel="noreferrer">service terms</a> and have read the <a href={legal.privacy} target="_blank" rel="noreferrer">privacy notice</a>.</span></label>;
}
export function SubmitButton({ pending, children, disabled }: { pending: boolean; children: React.ReactNode; disabled?: boolean }) {
  return <button className="primary" type="submit" disabled={pending || disabled} aria-busy={pending}>{pending ? 'Please wait…' : children}{!pending && <span aria-hidden="true">↗</span>}</button>;
}
export function LoginForm({ portal, next, configured }: { portal: Portal; next?: string; configured: boolean }) {
  const [state, action, pending] = useActionState(authenticate, {});
  return <>{portal !== 'platform' ? <PasswordOrOtpLogin portal={portal} next={next} configured={configured}/> : <form action={action} className="form"><input type="hidden" name="portal" value={portal}/><input type="hidden" name="next" value={next ?? ''}/><EmailField errors={state.fields?.email}/><PasswordField errors={state.fields?.password} forgotHref={`/auth/forgot-password?portal=${portal}`}/><AuthStatusMessage state={state}/>{!configured && <p className="notice">Sign-in will be available once this environment’s secure connection is configured.</p>}<SubmitButton pending={pending} disabled={!configured}>Sign in</SubmitButton></form>}{portal !== 'platform' && <p className="form-footer">{portal === 'salon' ? 'New to Saloonsync?' : 'Your first visit?'} <Link href={`/${portal}/register`}>{portal === 'salon' ? 'Create your salon account' : 'Create an account'}</Link></p>}{portal === 'salon' && <p className="invitation-note"><strong>Joining an existing team?</strong><br/>Use the invitation from your salon administrator. Sign in with the email address they invited.</p>}{portal === 'platform' && <p className="invitation-note">Access is provisioned by an authorized administrator. Multi-factor authentication is required.</p>}</>;
}
export function RegistrationForm({ portal, minimum, legal, configured }: { portal: 'salon' | 'customer'; minimum: number; legal: { terms: string; privacy: string; ready: boolean }; configured: boolean }) {
  const [state, action, pending] = useActionState(register, {});
  return <><form action={action} className="form"><input type="hidden" name="portal" value={portal}/><div className="field"><label htmlFor="name">Full name</label><input id="name" name="name" autoComplete="name" required minLength={2} maxLength={120} placeholder="Your full name" aria-invalid={Boolean(state.fields?.name)} aria-describedby={state.fields?.name ? 'name-error' : undefined}/>{state.fields?.name && <span id="name-error" className="field-error">{state.fields.name[0]}</span>}</div>{portal === 'salon' && <SalonRegistrationFields fields={state.fields}/>}<EmailField errors={state.fields?.email}/><PasswordCreationFields minimum={minimum} fields={state.fields}/><ConsentField legal={legal}/><AuthStatusMessage state={state}/><SubmitButton pending={pending} disabled={!legal.ready || !configured}>Create {portal === 'salon' ? 'salon account' : 'account'}</SubmitButton></form><p className="form-footer">Already have an account? <Link href={`/${portal}/login`}>Sign in</Link></p></>;
}
function SalonRegistrationFields({ fields }: { fields?: Record<string, string[]> }) {
  return <><div className="field"><label htmlFor="salonName">Salon name</label><input id="salonName" name="salonName" required minLength={2} maxLength={100} autoComplete="organization" placeholder="Your salon’s name" aria-invalid={Boolean(fields?.salonName)} aria-describedby={fields?.salonName ? 'salon-name-error' : undefined}/>{fields?.salonName && <span className="field-error" id="salon-name-error">{fields.salonName[0]}</span>}</div><div className="field"><label htmlFor="mobileNumber">Mobile number</label><input id="mobileNumber" name="mobileNumber" type="tel" inputMode="tel" autoComplete="tel" required maxLength={30} placeholder="+91 98765 43210" aria-invalid={Boolean(fields?.mobileNumber)} aria-describedby={fields?.mobileNumber ? 'mobile-hint mobile-error' : 'mobile-hint'}/><span id="mobile-hint" className="hint">Include your country code, e.g. +91 for India.</span>{fields?.mobileNumber && <span className="field-error" id="mobile-error">{fields.mobileNumber[0]}</span>}</div></>;
}
export function RecoveryForm({ mode, minimum = 12, configured, portal = 'salon' }: { mode: 'forgot' | 'reset' | 'verify'; minimum?: number; configured: boolean; portal?: Portal }) {
  const handler = mode === 'forgot' ? forgotPassword : mode === 'reset' ? resetPassword : resendVerification;
  const [state, action, pending] = useActionState(handler, {});
  return <><form action={action} className="form"><input type="hidden" name="portal" value={portal}/>{mode === 'reset' ? <PasswordCreationFields minimum={minimum}/> : <EmailField errors={state.fields?.email}/>}<AuthStatusMessage state={state}/><SubmitButton pending={pending} disabled={!configured}>{mode === 'forgot' ? 'Send reset link' : mode === 'reset' ? 'Update password' : 'Resend verification email'}</SubmitButton><Link className="form-footer" href={`/${portal}/login`}>Back to sign in</Link></form>{mode === 'forgot' && <EmailSentDialog state={state} portal={portal}/>}</>;
}
export function OnboardingForm({ legal, salonName = '' }: { legal: { terms: string; privacy: string; ready: boolean }; salonName?: string }) {
  const [state, action, pending] = useActionState(createWorkspace, {});
  const [key] = useState(() => crypto.randomUUID());
  return <form action={action} className="form"><input type="hidden" name="key" value={key}/><div className="field"><label htmlFor="name">Salon name</label><input id="name" name="name" required minLength={2} maxLength={100} defaultValue={salonName} placeholder="Your salon’s name"/></div><div className="field"><label htmlFor="branch">First branch name</label><input id="branch" name="branch" required minLength={2} maxLength={100} placeholder="e.g. Main studio"/></div><ConsentField legal={legal}/><AuthStatusMessage state={state}/><SubmitButton pending={pending} disabled={!legal.ready}>Create workspace</SubmitButton></form>;
}
export function InvitationForm({ salonId, branches, owner, emailEnabled }: { salonId: string; branches: { id: string; name: string }[]; owner: boolean; emailEnabled: boolean }) {
  const [state, action, pending] = useActionState(createInvitation, {}); const [scope, setScope] = useState('all');
  return <form action={action} className="form"><input name="salonId" type="hidden" value={salonId}/><EmailField errors={state.fields?.email}/><div className="field"><label htmlFor="role">Team role</label><select id="role" name="role"><option value="staff">Stylist / service staff</option><option value="receptionist">Receptionist</option><option value="inventory">Inventory manager</option><option value="accountant">Accountant</option><option value="cashier">Cashier (POS only)</option><option value="manager">Manager</option>{owner && <option value="admin">Salon administrator</option>}</select></div><div className="field"><label htmlFor="scope">Branch access</label><select id="scope" name="branchScope" value={scope} onChange={e => setScope(e.target.value)}><option value="all">All branches</option><option value="selected">Selected branches</option></select></div>{scope === 'selected' && <fieldset className="branch-checks"><legend>Allowed branches</legend>{branches.map(b => <label key={b.id}><input type="checkbox" name="branches" value={b.id}/>{b.name}</label>)}</fieldset>}{emailEnabled && <label className="consent"><input type="checkbox" name="emailDelivery"/><span>Send the invitation to this email address.</span></label>}<AuthStatusMessage state={state}/><SubmitButton pending={pending}>Create invitation</SubmitButton></form>;
}
export function AcceptInvitationForm() {
  const [state, action, pending] = useActionState(acceptInvitation, {});
  return <form action={action} className="form"><AuthStatusMessage state={state}/><SubmitButton pending={pending}>Accept invitation</SubmitButton><Link href="/salon">Open salon workspace</Link></form>;
}
export function TransferForm({ salonId, members }: { salonId: string; members: { id: string; user: { displayName: string } }[] }) {
  const [state, action, pending] = useActionState(transferOwnership, {});
  return <form className="form" action={action}><input type="hidden" name="salonId" value={salonId}/><div className="field"><label htmlFor="membershipId">New owner</label><select name="membershipId" id="membershipId" required defaultValue=""><option value="" disabled>Choose an active member</option>{members.map(m => <option key={m.id} value={m.id}>{m.user.displayName}</option>)}</select></div><label className="consent"><input type="checkbox" required/><span>I understand that I will become a salon administrator after transferring ownership.</span></label><AuthStatusMessage state={state}/><SubmitButton pending={pending} disabled={!members.length}>Transfer ownership</SubmitButton></form>;
}
export function CustomerProfileForm({ name, phone }: { name: string; phone: string }) {
  const [state, action, pending] = useActionState(updateCustomer, {});
  return <form action={action} className="form"><div className="field"><label htmlFor="name">Full name</label><input id="name" name="name" required minLength={2} maxLength={120} autoComplete="name" defaultValue={name}/></div><div className="field"><label htmlFor="phone">Phone number <span className="muted">(optional)</span></label><input id="phone" name="phone" type="tel" maxLength={30} autoComplete="tel" defaultValue={phone}/></div><AuthStatusMessage state={state}/><SubmitButton pending={pending}>Save profile</SubmitButton></form>;
}



