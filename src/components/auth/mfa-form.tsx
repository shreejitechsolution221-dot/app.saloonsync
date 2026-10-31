'use client';
import { useActionState } from 'react';
import { enrollMfa, verifyMfa } from '@/server/mfa';
import { SubmitButton } from './forms';
export function MfaForm({ factorId }: { factorId?: string }) {
  const [enroll, enrollment, enrolling] = useActionState(enrollMfa, {});
  const [state, verify, pending] = useActionState(verifyMfa, {});
  const factor = factorId ?? enroll.factorId;
  return <>{!factor && <form action={enrollment} className="form"><p className="muted">Add an authenticator app to protect your platform access.</p><SubmitButton pending={enrolling}>Set up authenticator</SubmitButton></form>}{enroll.error && <p className="status error" role="alert">{enroll.error}</p>}{enroll.secret && <div><p className="hint">In your authenticator app, add an account with this setup key. Keep the key private.</p><p className="mfa-secret">{enroll.secret}</p><p className="hint">Account: Saloonsync platform · Time based · 6 digits · 30 seconds</p></div>}{factor && <form action={verify} className="form"><input type="hidden" name="factorId" value={factor}/><div className="field"><label htmlFor="code">Authenticator code</label><input name="code" id="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required/></div>{state.error && <p className="status error" role="alert">{state.error}</p>}<SubmitButton pending={pending}>Verify and continue</SubmitButton></form>}</>;
}
