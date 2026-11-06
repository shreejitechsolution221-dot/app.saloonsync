import { db } from '@/lib/db';
import { platformSchemaReady } from '@/lib/platform/schema-ready';
export async function PlatformNotices({ salonId }: { salonId: string }) {
  if (!await platformSchemaReady()) return null;
  const [records, subscription] = await Promise.all([
    db.platformRecord.findMany({ where: { kind: 'announcement', status: 'published', OR: [{ salonId: null }, { salonId }] }, orderBy: { updatedAt: 'desc' }, take: 20, select: { id: true, title: true, payload: true } }),
    db.salonSubscription.findUnique({ where: { salonId }, select: { planCode: true } }),
  ]);
  const now = Date.now();
  const visible = records.filter(record => {
    const payload = record.payload as Record<string, string>;
    return (!payload.planCode || payload.planCode === subscription?.planCode) && (!payload.startsAt || Date.parse(`${payload.startsAt}Z`) <= now) && (!payload.expiresAt || Date.parse(`${payload.expiresAt}Z`) > now);
  }).slice(0, 3);
  if (!visible.length) return null;
  return <aside aria-label="SaloonSync platform announcements">{visible.map(record => <div className="notice" key={record.id}><strong>{record.title}</strong><p style={{ whiteSpace: 'pre-wrap' }}>{String((record.payload as Record<string, string>).notes)}</p></div>)}</aside>;
}
