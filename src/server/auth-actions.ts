'use server';
import { secureAuthCookies } from '@/lib/auth/cookie-options';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { db } from '@/lib/db';
import { supabase } from '@/lib/auth/supabase';
import { legalConfig, passwordMinimum } from '@/lib/auth/config';
import { portalOf, safeDestination } from '@/lib/auth/redirects';
import { loginSchema, registrationSchema, emailSchema } from '@/lib/validation/auth';
import { appOrigin, rateLimit, requireSameOrigin } from '@/lib/security';
import { requireAuthenticatedUser } from '@/lib/authorization/server';
import { emailPolicyError, assertSignupEmail } from '@/lib/email/signup-policy';
import { registeredEmailExists } from '@/lib/auth/registered-email';
import { getClientIp, limitLogin, limitRegister } from './rate-limit';

export type FormState = { error?: string; message?: string; fields?: Record<string, string[]>; link?: string; email?: string; sentAt?: number };
const unavailable = { error: 'Unable to complete this request. Check your details or try again later.' };
export async function authenticate(_state: FormState, form: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: 'Enter your email and password.', fields: z.flattenError(parsed.error).fieldErrors };
  const portal = portalOf(form.get('portal'));
  try {
    await requireSameOrigin();
    const clientIp = await getClientIp();
    const loginAllowed = await limitLogin(clientIp, parsed.data.email);
    if (!loginAllowed) return { error: 'Too many attempts, try again in a minute' };
    const client = await supabase();
    const authStarted = performance.now();
    const { error } = await client.auth.signInWithPassword(parsed.data);
    if (process.env.DB_TIMING_DEBUG === '1') console.info(JSON.stringify({ event: 'login.provider_timing', durationMs: performance.now() - authStarted }));
    if (error) return { error: 'Unable to sign in. Check your details and verify your email, or reset your password.' };
    const store = await cookies(); store.delete('recovery_user'); store.delete('login_otp'); store.delete('workspace');
  } catch { return unavailable; }
  redirect(safeDestination(form.get('next'), `/${portal}`));
}
export async function register(_state: FormState, form: FormData): Promise<FormState> {
  const legal = legalConfig();
  if (!legal.ready) return { error: 'Registration will open when the service terms and privacy notice are available.' };
  const portal = form.get('portal') === 'customer' ? 'customer' : 'salon';
  const parsed = registrationSchema(passwordMinimum(), portal).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: 'Review the highlighted fields.', fields: z.flattenError(parsed.error).fieldErrors };
  const emailError = emailPolicyError(parsed.data.email);
  if (emailError) return { error: emailError, fields: { email: [emailError] } };
  try {
    await requireSameOrigin();
    const clientIp = await getClientIp();
    const registerAllowed = await limitRegister(clientIp);
    if (!registerAllowed) return { error: 'Too many attempts, try again in a minute' };
    try { await assertSignupEmail(parsed.data.email); }
    catch (error) { const message = error instanceof Error ? error.message : 'Check your email address.'; return { error: message, fields: { email: [message] } }; }
    const client = await supabase();
    const { data, error } = await client.auth.signUp({ email: parsed.data.email, password: parsed.data.password,
      options: { data: { full_name: parsed.data.name }, emailRedirectTo: `${appOrigin()}/auth/callback?next=${portal === 'customer' ? '/customer' : '/salon/onboarding'}` },
    });
    if (error) return unavailable;
    // Supabase may return an obfuscated user for an existing account. Never link it.
    if (data.user?.identities?.length) {
      const id = data.user.id;
      await db.$transaction(async tx => {
        await tx.user.upsert({ where: { id }, update: {}, create: { id, displayName: parsed.data.name, ...(portal === 'salon' ? { mobileNumber: parsed.data.mobileNumber, salonRegistrationName: parsed.data.salonName } : {}) } });
        await tx.consentRecord.upsert({ where: { userId_documentType_documentVersion_purpose: { userId: id, documentType: 'service_terms', documentVersion: legal.version, purpose: portal } }, update: {}, create: { userId: id, documentType: 'service_terms', documentVersion: legal.version, purpose: portal } });
        if (portal === 'customer') await tx.customerProfile.upsert({ where: { userId: id }, update: {}, create: { userId: id } });
      });
    }
    return { message: 'Check your inbox to continue if this address is eligible. Already registered? Sign in or reset your password.' };
  } catch { return unavailable; }
}
export async function forgotPassword(_state: FormState, form: FormData): Promise<FormState> {
  const parsed = emailSchema.safeParse(form.get('email'));
  if (!parsed.success) return { error: 'Enter a valid email address.' };
  try {
    await requireSameOrigin();
    await rateLimit('recovery', parsed.data, 5);
    if (!await registeredEmailExists(parsed.data)) {
      const message = 'Email not found. Enter the email address used to create your account.';
      return { error: message, fields: { email: [message] } };
    }
    (await cookies()).set('auth_portal', portalOf(form.get('portal')), { httpOnly: true, secure: secureAuthCookies(), sameSite: 'lax', path: '/', maxAge: 3600 });
    const client = await supabase();
    const { error } = await client.auth.resetPasswordForEmail(parsed.data, { redirectTo: `${appOrigin()}/auth/confirm?portal=${portalOf(form.get('portal'))}` });
    if (error) return unavailable;
    return { message: 'Password reset email sent. Check your inbox and spam folder.', email: parsed.data, sentAt: Date.now() };
  } catch { return unavailable; }
}
export async function resetPassword(_state: FormState, form: FormData): Promise<FormState> {
  const password = String(form.get('password') ?? '');
  if (password.length < passwordMinimum() || password.length > 128) return { error: `Use ${passwordMinimum()}–128 characters.` };
  if (password !== form.get('confirmation')) return { error: 'Passwords do not match.' };
  let destination: string;
  try {
    await requireSameOrigin();
    const client = await supabase();
    const { data: { user } } = await client.auth.getUser();
    const recovery = (await cookies()).get('recovery_user')?.value;
    if (!user || recovery !== user.id) return { error: 'Open a new password reset link from your email.' };
    const { error } = await client.auth.updateUser({ password });
    if (error) return unavailable;
    const store = await cookies();
    const portal = portalOf(store.get('auth_portal')?.value ?? form.get('portal'));
    const { error: signOutError } = await client.auth.signOut({ scope: 'global' });
    if (signOutError) return { error: 'Your password was updated, but sign-out could not complete. Please sign out before signing in again.' };
    store.delete('recovery_user'); store.delete('auth_portal'); store.delete('workspace');
    destination = `/${portal}/login?reset=success`;
  } catch { return unavailable; }
  redirect(destination);
}
export async function resendVerification(_state: FormState, form: FormData): Promise<FormState> {
  const parsed = emailSchema.safeParse(form.get('email'));
  if (!parsed.success) return { error: 'Enter a valid email address.' };
  try {
    await requireSameOrigin(); await rateLimit('verification', parsed.data, 5);
    const client = await supabase();
    const { error } = await client.auth.resend({ type: 'signup', email: parsed.data, options: { emailRedirectTo: `${appOrigin()}/auth/callback?next=/salon` } });
    if (error) return unavailable;
    return { message: 'If this address is eligible, a verification email is on its way.' };
  } catch { return unavailable; }
}
export async function logout(form?: FormData) {
  await requireSameOrigin();
  const client = await supabase();
  const { error } = await client.auth.signOut();
  if (error) throw new Error('Unable to sign out. Please try again.');
  const store = await cookies(); store.delete('workspace'); store.delete('invitation'); store.delete('recovery_user'); store.delete('login_otp'); store.delete('auth_portal');
  redirect(`/${portalOf(form?.get('portal'))}/login`);
}
export async function updateCustomer(_state: FormState, form: FormData): Promise<FormState> {
  const parsed = z.object({ name: z.string().trim().min(2).max(120), phone: z.string().trim().max(30) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: 'Enter a name and a valid phone number.' };
  try {
    await requireSameOrigin(); const user = await requireAuthenticatedUser();
    await db.$transaction([db.user.update({ where: { id: user.id }, data: { displayName: parsed.data.name } }), db.customerProfile.upsert({ where: { userId: user.id }, update: { phone: parsed.data.phone }, create: { userId: user.id, phone: parsed.data.phone } })]);
    return { message: 'Profile updated.' };
  } catch { return unavailable; }
}


// Passwordless login never creates accounts or grants portal permissions.
export async function requestLoginOtp(_state: FormState, form: FormData): Promise<FormState> {
  const portal = form.get('portal');
  if (portal !== 'salon' && portal !== 'customer') return unavailable;
  const parsed = emailSchema.safeParse(form.get('email'));
  if (!parsed.success) return { error: 'Enter a valid email address.' };
  try {
    await requireSameOrigin();
    await rateLimit('otp-send', parsed.data, 5);
    const store = await cookies();
    const previous = store.get('login_otp')?.value;
    if (previous && Date.now() - JSON.parse(previous).sentAt < 60000) return { error: 'Wait one minute before requesting another code.' };
    if (!await registeredEmailExists(parsed.data)) return { error: 'Email not found. Create an account first.' };
    const client = await supabase();
    const { error } = await client.auth.signInWithOtp({ email: parsed.data, options: { shouldCreateUser: false, emailRedirectTo: `${appOrigin()}/auth/callback?next=/${portal}` } });
    if (error) return unavailable;
    const sentAt = Date.now();
    store.set('login_otp', JSON.stringify({ email: parsed.data, portal, sentAt }), { httpOnly: true, secure: secureAuthCookies(), sameSite: 'lax', path: '/', maxAge: 3600 });
    return { message: 'Sign-in code requested. Check your inbox and spam folder.', email: parsed.data, sentAt };
  } catch { return unavailable; }
}
export async function verifyLoginOtp(_state: FormState, form: FormData): Promise<FormState> {
  const token = String(form.get('token') ?? '').trim();
  if (!/^\d{6,10}$/.test(token)) return { error: 'Enter the numeric code from your email.' };
  let destination: string;
  try {
    await requireSameOrigin();
    const store = await cookies();
    const raw = store.get('login_otp')?.value;
    if (!raw) return { error: 'Request a new sign-in code first.' };
    const context = JSON.parse(raw);
    if (!emailSchema.safeParse(context.email).success || !['salon', 'customer'].includes(context.portal) || !Number.isFinite(context.sentAt) || Date.now() - context.sentAt > 3600000) return { error: 'Request a new sign-in code first.' };
    await rateLimit('otp-verify', context.email, 10);
    const client = await supabase();
    const { data, error } = await client.auth.verifyOtp({ email: context.email, token, type: 'email' });
    if (error || !data.user || !data.session) return { error: 'This code is invalid or expired. Try again or request a new code.' };
    store.delete('login_otp'); store.delete('workspace'); store.delete('recovery_user');
    destination = `/${context.portal}`;
  } catch { return unavailable; }
  redirect(destination);
}


