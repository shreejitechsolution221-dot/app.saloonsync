import 'server-only';
import { invalidate } from '@/server/cache';
export async function invalidateCustomer(userId: string) {
  await invalidate(...['dashboard', 'bookings', 'offers'].map(part => `customer:v1:${userId}:${part}`));
}
