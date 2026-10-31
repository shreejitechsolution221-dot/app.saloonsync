import 'server-only';
import { redirect } from 'next/navigation';
import { authConfigured } from './config';
import { AccessError } from '@/lib/authorization/server';
export async function guard<T>(portal: 'salon' | 'customer' | 'platform', operation: () => Promise<T>): Promise<T> {
  if (!authConfigured()) redirect(`/${portal}/login`);
  try { return await operation(); }
  catch (error) {
    if (!(error instanceof AccessError)) throw error;
    if (error.code === 'UNAUTHENTICATED') redirect(`/${portal}/login`);
    if (error.code === 'UNVERIFIED') redirect('/auth/verify-email?portal=' + portal);
    if (error.code === 'MFA_REQUIRED') redirect('/platform/mfa');
    redirect(`/${portal}/access-denied`);
  }
}
