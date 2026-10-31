import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthenticatedUser, AccessError } from '@/lib/authorization/server';
import { db } from '@/lib/db';
export async function GET(_request: NextRequest, { params }: { params: Promise<{ bookingId: string }> }) {
  const id = z.uuid().safeParse((await params).bookingId);
  if (!id.success) return NextResponse.json({ error: 'Invalid booking' }, { status: 400 });
  try {
    const user = await requireAuthenticatedUser();
    const booking = await db.appointment.findFirst({ where: { id: id.data, customerUserId: user.id }, select: { id: true, startsAt: true, status: true, salon: { select: { name: true } }, branch: { select: { name: true } } } });
    if (!booking) return NextResponse.json({ error: 'Booking unavailable' }, { status: 404 });
    return NextResponse.json({ booking }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return NextResponse.json({ error: 'Access unavailable' }, { status: error instanceof AccessError && error.code === 'UNAUTHENTICATED' ? 401 : 403 }); }
}
