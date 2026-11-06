import 'server-only';
import { db } from '@/lib/db';
import { cache } from 'react';
import { requirePlatformPrivilege } from '@/lib/authorization/server';
import { guard } from '@/lib/auth/page-guard';
import { platformSchemaReady } from './schema-ready';

export const platformContext = cache(async () => {
  const user = await guard('platform', () => requirePlatformPrivilege('platform.manage'));
  const grants = await db.platformPrivilege.findMany({ where: { userId: user.id, status: 'active', revokedAt: null }, select: { privilege: true } });
  const preference = await platformSchemaReady() ? await db.platformRecord.findUnique({ where: { key: `preference:${user.id}` }, select: { payload: true } }) : null;
  return { user, grants: grants.map(grant => grant.privilege), preferences: preference?.payload as { locale?: string; timezone?: string; density?: string } | undefined };
});
export async function platformMetrics() {
  const since = new Date(Date.now() - 30 * 86400000);
  const [total, active, newSalons, bookings, stages] = await Promise.all([
    db.salon.count(), db.salon.count({ where: { status: 'active' } }), db.salon.count({ where: { createdAt: { gte: since } } }),
    db.appointment.count({ where: { createdAt: { gte: since } } }),
    db.$queryRaw<{ stage: string; count: bigint }[]>`SELECT COALESCE(settings->'platformOnboarding'->>'stage','registered') AS stage, count(*) AS count FROM app."Salon" GROUP BY 1`,
  ]);
  return { total, active, newSalons, bookings, stages: stages.map(row => ({ ...row, count: Number(row.count) })) };
}
export async function analytics() {
  const [metrics, acquisition, volume, plans, adoption, returning] = await Promise.all([
    platformMetrics(),
    db.$queryRaw<{ month: string; count: bigint }[]>`SELECT to_char(date_trunc('month',"createdAt" AT TIME ZONE 'UTC'),'YYYY-MM') AS month, count(*) AS count FROM app."Salon" WHERE "createdAt">=now()-interval '6 months' GROUP BY 1 ORDER BY 1`,
    db.$queryRaw<{ month: string; count: bigint }[]>`SELECT to_char(date_trunc('month',"startsAt" AT TIME ZONE 'UTC'),'YYYY-MM') AS month, count(*) AS count FROM app."Appointment" WHERE "startsAt">=now()-interval '6 months' AND "startsAt"<=now() GROUP BY 1 ORDER BY 1`,
    db.salonSubscription.groupBy({ by: ['planCode', 'status'], _count: true }),
    db.$queryRaw<{ feature: string; count: bigint }[]>`SELECT 'Service catalog' AS feature, count(DISTINCT "salonId") AS count FROM app."Service" UNION ALL SELECT 'Staff setup',count(DISTINCT "salonId") FROM app."StaffProfile" UNION ALL SELECT 'Booking usage',count(DISTINCT "salonId") FROM app."Appointment" UNION ALL SELECT 'Retail catalog',count(DISTINCT "salonId") FROM app."Product"`,
    db.$queryRaw<{ previous: bigint; retained: bigint }[]>`WITH previous AS (SELECT DISTINCT "salonId" FROM app."Appointment" WHERE "startsAt">=now()-interval '60 days' AND "startsAt"<now()-interval '30 days'), current AS (SELECT DISTINCT "salonId" FROM app."Appointment" WHERE "startsAt">=now()-interval '30 days' AND "startsAt"<=now()) SELECT (SELECT count(*) FROM previous) AS previous,(SELECT count(*) FROM previous JOIN current USING ("salonId")) AS retained`,
  ]);
  return { metrics, acquisition, volume, plans, adoption, returning: returning[0] };
}
export async function healthSnapshot() {
  const start = performance.now(); let database = 'Unavailable';
  try { await db.$queryRaw`SELECT 1`; database = 'Ready'; } catch { /* Report the observed probe result. */ }
  const latency = Math.round(performance.now() - start);
  const [jobs, incidents] = await Promise.all([
    db.platformRecord.groupBy({ by: ['status'], where: { kind: 'job' }, _count: true }),
    db.platformRecord.count({ where: { kind: 'incident', status: { not: 'resolved' } } }),
  ]);
  return { database, latency, jobs, incidents, checkedAt: new Date().toISOString() };
}
