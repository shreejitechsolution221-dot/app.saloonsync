'use client';
import { useState } from 'react';
import Link from 'next/link';
export function PasswordField({ confirmation = false, registration = false, minimum, errors, value, onValueChange, liveError, forgotHref = '/auth/forgot-password' }: {
  confirmation?: boolean; registration?: boolean; minimum?: number; errors?: string[];
  value?: string; onValueChange?: (value: string) => void; liveError?: string; forgotHref?: string;
}) {
  const [visible, setVisible] = useState(false);
  const id = confirmation ? 'confirmation' : 'password';
  const error = errors?.[0] ?? liveError;
  const descriptions = [registration && !confirmation ? 'password-hint' : '', error ? `${id}-error` : ''].filter(Boolean).join(' ');
  return <div className="field"><div className="label-row"><label htmlFor={id}>{confirmation ? 'Confirm password' : 'Password'}</label>{!registration && <Link href={forgotHref}>Forgot password?</Link>}</div><div className="password-wrap"><input id={id} name={id} type={visible ? 'text' : 'password'} autoComplete={registration ? 'new-password' : 'current-password'} required minLength={registration ? minimum : undefined} maxLength={registration ? 128 : 1024} value={value} onChange={onValueChange ? event => onValueChange(event.target.value) : undefined} placeholder={confirmation ? 'Enter your password again' : 'Enter your password'} aria-invalid={Boolean(error)} aria-describedby={descriptions || undefined}/><button className="visibility" type="button" onClick={() => setVisible(!visible)} aria-label={`${visible ? 'Hide' : 'Show'} ${confirmation ? 'confirmation password' : 'password'}`} aria-pressed={visible}>{visible ? 'Hide' : 'Show'}</button></div>{registration && !confirmation && <span id="password-hint" className="hint">Use {minimum}–128 characters. Additional configured service requirements are checked securely when you submit.</span>}{error && <span id={`${id}-error`} className="field-error" aria-live="polite">{error}</span>}</div>;
}
