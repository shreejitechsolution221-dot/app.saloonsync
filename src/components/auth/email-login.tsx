'use client';
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { type FormState } from '@/server/auth-actions';
import type { Portal } from '@/lib/auth/redirects';

function inboxUrl(email?: string) {
  const domain = email?.split('@')[1]?.toLowerCase();
  if (domain === 'gmail.com' || domain === 'googlemail.com') return 'https://mail.google.com/';
  if (domain && ['outlook.com', 'hotmail.com', 'live.com'].includes(domain)) return 'https://outlook.live.com/mail/';
  if (domain === 'yahoo.com') return 'https://mail.yahoo.com/';
  if (domain === 'icloud.com' || domain === 'me.com') return 'https://www.icloud.com/mail/';
  return undefined;
}
export function EmailSentDialog({ state, portal }: { state: FormState; portal: Portal }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (state.sentAt && !state.error) dialog.current?.showModal(); }, [state.sentAt, state.error]);
  const inbox = inboxUrl(state.email);
  return <dialog ref={dialog} className="email-sent-dialog" aria-labelledby="email-sent-title" aria-describedby="email-sent-description"><div className="form"><span className="email-sent-icon" aria-hidden="true">✉</span><h2 id="email-sent-title">Check your inbox</h2><p id="email-sent-description">Your password reset email has been sent to <strong>{state.email}</strong>. Check your inbox and spam folder, then open the reset link.</p>{inbox ? <a className="primary" href={inbox} target="_blank" rel="noreferrer">Open inbox ↗</a> : <p className="hint">Open your email app to find the reset message.</p>}<button type="button" className="primary" onClick={() => dialog.current?.close()}>Got the email</button><Link className="form-footer" href={`/${portal}/login`}>Sign in</Link><button type="button" className="password-suggest" onClick={() => dialog.current?.close()}>Close</button></div></dialog>;
}

