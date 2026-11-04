import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCustomerBookingAvailability } from '@/lib/customer/queries';
import { rateLimit } from '@/lib/security';

const availabilityQuerySchema = z.object({
  salonId: z.string().uuid(),
  branchId: z.string().uuid(),
  durationMinutes: z.coerce.number().int().min(5).max(480).default(30),
  staffId: z.string().uuid().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function GET(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';
    await rateLimit('customer-availability', ip, 120);

    const searchParams = request.nextUrl.searchParams;
    const parsed = availabilityQuerySchema.safeParse({
      salonId: searchParams.get('salonId'),
      branchId: searchParams.get('branchId'),
      durationMinutes: searchParams.get('durationMinutes') || 30,
      staffId: searchParams.get('staffId') || undefined,
      date: searchParams.get('date'),
    });

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid parameters', details: parsed.error.issues }, { status: 400 });
    }

    const { salonId, branchId, durationMinutes, staffId, date } = parsed.data;
    const slots = await getCustomerBookingAvailability(
      salonId,
      branchId,
      durationMinutes,
      staffId,
      date,
    );

    return NextResponse.json({ slots }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (err) {
    return NextResponse.json({ error: 'Unable to check slot availability' }, { status: 500 });
  }
}
