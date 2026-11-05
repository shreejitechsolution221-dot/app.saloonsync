import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { authConfigured } from '@/lib/auth/config';
import { getPortalAccess } from '@/lib/auth/portal-access';
import { AccessError, requireAuthenticatedUser } from '@/lib/authorization/server';

// Public discovery still works for guests. Authenticated accounts must belong
// to this portal before any personal customer data is fetched.
export const optionalCustomerUser = cache(async () => {
  if (!authConfigured()) return null;
  let user;
  try { user = await requireAuthenticatedUser(); }
  catch (error) {
    if (error instanceof AccessError && error.code === 'UNAUTHENTICATED') return null;
    if (error instanceof AccessError && error.code === 'UNVERIFIED') redirect('/auth/verify-email?portal=customer');
    if (error instanceof AccessError) redirect('/customer/access-denied');
    throw error;
  }
  const access = await getPortalAccess(user.id);
  if (access.customer) return user;
  if (access.salon) redirect('/salon');
  if (access.platform) redirect('/platform');
  redirect('/customer/access-denied');
});
