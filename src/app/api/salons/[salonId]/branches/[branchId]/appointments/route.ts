import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { requireBranchAccess, AccessError } from '@/lib/authorization/server';
import { measured } from '@/lib/performance/http';
import { appointmentPage, encodeCursor } from '@/lib/performance/pagination';
async function getAppointments(_request: NextRequest, { params }: { params: Promise<{ salonId: string; branchId: string }> }) {
  const parsed = z.object({ salonId: z.uuid(), branchId: z.uuid() }).safeParse(await params);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid scope' }, { status: 400 });
  try {
    const { salonId, branchId } = parsed.data;
    const { user, membership } = await requireBranchAccess(salonId, branchId, 'appointment.assigned.read');
    let page;
    try { page = appointmentPage(_request.nextUrl.searchParams, { salonId, branchId, userId: user.id }); }
    catch { return NextResponse.json({ error: 'Invalid pagination' }, { status: 400, headers: { 'Cache-Control': 'private, no-store' } }); }
    const { limit, cursor } = page;
    const rows = await db.appointment.findMany({ where: { salonId, branchId, ...(membership.role === 'staff' ? { assignedUserId: user.id } : {}), ...(cursor ? { OR: [{ startsAt: { lt: new Date(cursor.startsAt) } }, { startsAt: new Date(cursor.startsAt), id: { lt: cursor.id } }] } : {}) }, select: { id: true, startsAt: true, status: true }, take: limit + 1, orderBy: [{ startsAt: 'desc' }, { id: 'desc' }] });
    const appointments = rows.slice(0, limit);
    const last = appointments.at(-1);
    const nextCursor = rows.length > limit && last ? encodeCursor({ v: 1, salonId, branchId, userId: user.id, id: last.id, startsAt: last.startsAt.toISOString() }) : null;
    return NextResponse.json({ appointments, nextCursor }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof AccessError) return NextResponse.json({ error: 'Access unavailable' }, { status: error.code === 'UNAUTHENTICATED' ? 401 : 403, headers: { 'Cache-Control': 'private, no-store' } });
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503, headers: { 'Cache-Control': 'private, no-store' } });
  }
}

export async function GET(request: NextRequest, context: { params: Promise<{ salonId: string; branchId: string }> }) {
  return measured('appointments', request, () => getAppointments(request, context));
}
