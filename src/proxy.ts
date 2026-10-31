import { secureAuthCookies } from '@/lib/auth/cookie-options';
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { authConfigured } from '@/lib/auth/config';
import { needsSessionRefresh } from '@/lib/auth/session-routing';
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  // Public pages need no provider roundtrip. Actions/callbacks refresh their own cookies.
  if (!authConfigured() || !needsSessionRefresh(request.nextUrl.pathname, request.method, request.cookies.getAll().map(cookie => cookie.name))) return response;
  const client = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookieOptions: { httpOnly: true, secure: secureAuthCookies(), sameSite: 'lax', path: '/' },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  // Locally validate signed claims here; protected handlers still perform getUser
  // and current database authorization, so this is never the authorization gate.
  await client.auth.getClaims();
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'] };

