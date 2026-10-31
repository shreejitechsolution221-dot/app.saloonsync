'use server';
import { z } from 'zod';
import { recoveryTokenPattern } from '@/lib/auth/recovery-token';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { supabase } from '@/lib/auth/supabase';
import { portalOf } from '@/lib/auth/redirects';
import { appOrigin, rateLimit, requireSameOrigin } from '@/lib/security';
import type { FormState } from './auth-actions';

export async function confirmPasswordRecovery(_state: FormState, form: FormData): Promise<FormState> {
  const token = z.string().regex(recoveryTokenPattern).safeParse(form.get('token_hash'));
  if (!token.success || form.get('type') !== 'recovery') return { error: 'This is not a valid password reset link. Request a new one.' };
  try {
    await requireSameOrigin();
    await rateLimit('recovery-confirm', token.data, 10);
    const client = await supabase();
    // Only a provider-verified recovery token can authorize a password change.
    const { data, error } = await client.auth.verifyOtp({ token_hash: token.data, type: 'recovery' });
    if (error || !data.user || !data.session) return { error: 'This reset link is invalid or has already been used. Request a fresh password reset email.' };
    const store = await cookies();
    const options = { httpOnly: true, secure: new URL(appOrigin()).protocol === 'https:', sameSite: 'lax' as const, path: '/' };
    store.set('recovery_user', data.user.id, { ...options, maxAge: 600 });
    store.set('auth_portal', portalOf(form.get('portal')), { ...options, maxAge: 3600 });
  } catch { return { error: 'Unable to verify the reset link. Try again shortly.' }; }
  redirect('/auth/reset-password');
}

