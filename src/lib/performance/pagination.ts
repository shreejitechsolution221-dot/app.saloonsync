import { z } from 'zod';
const tokenSchema = z.object({ v: z.literal(1), salonId: z.uuid(), branchId: z.uuid(), userId: z.string().min(1).max(128), id: z.uuid(), startsAt: z.iso.datetime() }).strict();
export type AppointmentCursor = z.infer<typeof tokenSchema>;
export function encodeCursor(value: AppointmentCursor) {
  return Buffer.from(JSON.stringify(tokenSchema.parse(value))).toString('base64url');
}
export function appointmentPage(params: URLSearchParams, scope: Pick<AppointmentCursor, 'salonId' | 'branchId' | 'userId'>) {
  const limit = z.coerce.number().int().min(1).max(100).parse(params.get('limit') ?? 100);
  const raw = params.get('cursor');
  if (!raw) return { limit, cursor: undefined };
  if (raw.length > 1024 || !/^[A-Za-z0-9_-]+$/.test(raw)) throw new Error('Invalid cursor');
  const cursor = tokenSchema.parse(JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')));
  if (cursor.salonId !== scope.salonId || cursor.branchId !== scope.branchId || cursor.userId !== scope.userId) throw new Error('Invalid cursor scope');
  return { limit, cursor };
}
