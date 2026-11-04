'use client';
import { useActionState, useEffect, useState } from 'react';
import { authenticate, requestLoginOtp, verifyLoginOtp } from '@/server/auth-actions';
import { PasswordField } from './password-field';

export function PasswordOrOtpLogin({ portal, next, configured }: { portal: 'salon' | 'customer'; next?: string; configured: boolean }) {
  const [method, setMethod] = useState<'password' | 'otp'>('password');
  const [email, setEmail] = useState('');
  const [passwordState, passwordAction, passwordPending] = useActionState(authenticate, {});
  const [sent, send, sending] = useActionState(requestLoginOtp, {});
  const [verified, verify, verifying] = useActionState(verifyLoginOtp, {});
  const [remaining, setRemaining] = useState(0);
  const busy = passwordPending || sending || verifying;
  const state = method === 'password' ? passwordState : sent;
  const matchingRequest = sent.email === email.trim().toLowerCase();
  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, Math.ceil(((sent.sentAt ?? 0) + 60000 - Date.now()) / 1000)));
    tick(); const timer = setInterval(tick, 1000); return () => clearInterval(timer);
  }, [sent.sentAt]);
  return <div className="form">
    <form action={method === 'password' ? passwordAction : send} className="form">
      <input type="hidden" name="portal" value={portal}/><input type="hidden" name="next" value={next ?? ''}/>
      <div className="field"><label htmlFor="email">Email address</label><input id="email" name="email" type="email" autoComplete="email" required maxLength={254} placeholder="Your email address" value={email} onChange={event => setEmail(event.target.value)} readOnly={busy} aria-invalid={Boolean(state.fields?.email)} suppressHydrationWarning/></div>
      <fieldset className="login-method" disabled={busy}><legend>How would you like to sign in?</legend><div className="login-method-options"><label><input type="radio" name="loginMethod" value="password" checked={method === 'password'} onChange={() => setMethod('password')}/><span>Use password</span></label><label><input type="radio" name="loginMethod" value="otp" checked={method === 'otp'} onChange={() => setMethod('otp')}/><span>Email OTP</span></label></div></fieldset>
      {method === 'password' ? <PasswordField errors={passwordState.fields?.password} forgotHref={`/auth/forgot-password?portal=${portal}`}/> : <p className="hint">We’ll send a one-time sign-in code to the email address above.</p>}
      {state.error && <div className="status error" role="alert">{state.error}</div>}
      {!configured && <p className="notice">Sign-in will be available once this environment’s secure connection is configured.</p>}
      <button className="primary" type="submit" disabled={!configured || busy || (method === 'otp' && remaining > 0)} aria-busy={busy} suppressHydrationWarning>{busy ? 'Please wait…' : method === 'password' ? `Sign in${portal === 'salon' ? ' to your salon' : ''}` : remaining > 0 ? `Resend in ${remaining}s` : matchingRequest ? 'Resend code' : 'Send sign-in code'}</button>
    </form>
    {method === 'otp' && matchingRequest && <form action={verify} className="form" key={sent.sentAt}>
      <p className="status" role="status">{sent.message} Code sent to {sent.email}.</p>
      <div className="field"><label htmlFor="login-code">Email verification code</label><input id="login-code" name="token" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" minLength={6} maxLength={10} required placeholder="Enter your email code" suppressHydrationWarning/></div>
      {verified.error && <div className="status error" role="alert">{verified.error}</div>}
      <button className="primary" type="submit" disabled={busy} suppressHydrationWarning>{verifying ? 'Verifying…' : 'Verify code and sign in'}</button>
    </form>}
  </div>;
}

