import { secureAuthCookies } from '@/lib/auth/cookie-options';
import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { authConfigured } from './config';
import { cache } from 'react';
export const supabase = cache(async function supabase() {
  if (!authConfigured()) throw new Error('Authentication is not configured.');
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookieOptions: { httpOnly: true, secure: secureAuthCookies(), sameSite: 'lax', path: '/' },
    cookies: {
      getAll: () => store.getAll(),
      setAll(values) {
        try { values.forEach(({ name, value, options }) => store.set(name, value, options)); }
        catch { /* Server components cannot write cookies; proxy refreshes them. */ }
      },
    },
  });
});

