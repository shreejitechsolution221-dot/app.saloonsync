import { secureAuthCookies } from '@/lib/auth/cookie-options';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabase } from '@/lib/auth/supabase';
import { portalOf, safeDestination } from '@/lib/auth/redirects';
import { appOrigin } from '@/lib/security';
import { authorizePortalSession } from '@/lib/auth/portal-access';
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const next = safeDestination(request.nextUrl.searchParams.get('next'));
  if (code) {
    try {
      const client = await supabase();
      const { data, error } = await client.auth.exchangeCodeForSession(code);
      if (!error && data.user && data.session) {
        const store = await cookies();
        store.delete('recovery_user');
        const recovery = 'redirectType' in data && data.redirectType === 'recovery';
        if (recovery) store.set('recovery_user', data.user.id, { httpOnly: true, secure: secureAuthCookies(), sameSite: 'lax', path: '/', maxAge: 600 });
        // A next parameter never turns a regular sign-in into recovery.
        if (!recovery && next === '/auth/reset-password') {
          return NextResponse.redirect(new URL('/auth/forgot-password?portal=' + portalOf(store.get('auth_portal')?.value ?? request.nextUrl.searchParams.get('portal')) + '&error=recovery', appOrigin()));
        }
        const destination = recovery ? '/auth/reset-password' : store.has('invitation') ? '/salon/invitations/accept' : next;
        if (!recovery && !store.has('invitation')) {
          const portal = portalOf(next.startsWith('/customer') ? 'customer' : next.startsWith('/platform') ? 'platform' : 'salon');
          if (!await authorizePortalSession(client, data.user.id, portal)) {
            return NextResponse.redirect(new URL(`/${portal}/login?error=role`, appOrigin()));
          }
        }
        return NextResponse.redirect(new URL(destination, appOrigin()));
      }
    } catch { /* Display a generic, non-sensitive recovery state. */ }
  }
  const portal = portalOf((await cookies()).get('auth_portal')?.value ?? request.nextUrl.searchParams.get('portal') ?? (next.startsWith('/platform') ? 'platform' : next.startsWith('/customer') ? 'customer' : 'salon'));
  const retry = next === '/auth/reset-password' ? 'forgot-password' : 'verify-email';
  return NextResponse.redirect(new URL('/auth/' + retry + '?error=link&portal=' + portal, appOrigin()));
}





