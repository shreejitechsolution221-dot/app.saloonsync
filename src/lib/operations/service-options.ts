import 'server-only';
import { revalidateTag } from 'next/cache';
import { getSalonLayoutData, invalidateSalonLayout } from '@/lib/salon/layout-data';

// Only display catalog data is cached. Checkout actions always read fresh prices
// and authorization. Project + tenant are part of the persistent cache identity.
export async function serviceOptions(salonId: string) {
  const layout = await getSalonLayoutData(salonId);
  return layout.services.map((s) => ({ id: s.id, name: s.name, pricePaise: s.pricePaise }));
}

export function invalidateServiceOptions(salonId: string) {
  revalidateTag('services:' + salonId, { expire: 0 });
  invalidateSalonLayout(salonId).catch(() => {});
}
