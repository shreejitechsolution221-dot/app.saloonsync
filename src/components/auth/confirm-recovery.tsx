'use client';
import { useActionState } from 'react';
import Link from 'next/link';
import { confirmPasswordRecovery } from '@/server/recovery-actions';
import type { Portal } from '@/lib/auth/redirects';
export function ConfirmRecoveryForm({ tokenHash, portal }: { tokenHash: string; portal: Portal }) {
  const [state, action, pending] = useActionState(confirmPasswordRecovery, {});
  return <form action={action} className="form"><input type="hidden" name="token_hash" value={tokenHash}/><input type="hidden" name="type" value="recovery"/><input type="hidden" name="portal" value={portal}/>{state.error && <p className="status error" role="alert">{state.error}</p>}<button type="submit" className="primary" disabled={pending}>{pending ? 'Verifying…' : 'Continue to reset password'}</button><Link href={`/auth/forgot-password?portal=${portal}`}>Request a new reset email</Link></form>;
}
