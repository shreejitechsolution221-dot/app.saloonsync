import { db } from '@/lib/db';
import { authConfigured } from '@/lib/auth/config';
import { measured } from '@/lib/performance/http';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  return measured('ready', request, async () => {
    if (!authConfigured()) return Response.json({ status: 'unavailable' }, { status: 503 });
    try {
      // Deliberately uncached: exercise both runtime privileges and required schema.
      await db.$queryRaw`SELECT 1 FROM app."SalonMembership" LIMIT 1`;
      await db.$queryRaw`SELECT "originBranchId" FROM app."SalonCustomer" LIMIT 0`;
      await db.$queryRaw`SELECT 1 FROM app."LocationStock" LIMIT 0`;
      return Response.json({ status: 'ready' });
    } catch { return Response.json({ status: 'unavailable' }, { status: 503 }); }
  });
}
