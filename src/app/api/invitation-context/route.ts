import { secureAuthCookies } from '@/lib/auth/cookie-options';
import { NextRequest, NextResponse } from 'next/server';
import { appOrigin } from '@/lib/security';
export async function POST(request: NextRequest) {
  if (request.headers.get('origin') !== appOrigin()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const body = await request.text(); if (body.length > 200) throw new Error();
    const { token } = JSON.parse(body);
    if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new Error();
    const response = NextResponse.json({ saved: true });
    response.cookies.set('invitation', token, { httpOnly: true, secure: secureAuthCookies(), sameSite: 'lax', path: '/', maxAge: 3600 });
    return response;
  } catch { return NextResponse.json({ error: 'Invalid invitation' }, { status: 400 }); }
}

