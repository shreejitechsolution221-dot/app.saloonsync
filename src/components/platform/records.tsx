import Link from 'next/link';
import { db } from '@/lib/db';
import { recordTypes, type RecordKind } from '@/lib/platform/catalog';
import { RecordForm, SupportMetadataForm } from './forms';
import { Empty } from './shell';
import { platformSchemaReady } from '@/lib/platform/schema-ready';
import { platformContext } from '@/lib/platform/queries';

export type Search = { q?: string; status?: string; page?: string };
export const formatDate = (value: Date) => new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' }).format(value);
export function Pager({ page, more, base, search }: { page: number; more: boolean; base: string; search: Search }) {
  const href = (next: number) => `${base}?${new URLSearchParams({ q: search.q ?? '', status: search.status ?? '', page: String(next) })}`;
  return <div className="pa-pagination">{page > 1 ? <Link href={href(page - 1)}>← Previous</Link> : <span/>}<span>Page {page}</span>{more ? <Link href={href(page + 1)}>Next →</Link> : <span/>}</div>;
}
export function SearchForm({ search, statuses = [] }: { search: Search; statuses?: string[] }) {
  return <form className="pa-search"><label style={{flex:1}}><span className="sr-only">Search</span><input name="q" defaultValue={search.q} placeholder="Search name, ID or reference…" maxLength={120}/></label>{statuses.length > 0 && <label><span className="sr-only">Status</span><select name="status" defaultValue={search.status ?? ''}><option value="">All statuses</option>{statuses.map(status => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}</select></label>}<button>Search</button></form>;
}
export async function RecordArea({ kinds, search, page, grants, section }: { kinds: RecordKind[]; search: Search; page: number; grants: string[]; section: string }) {
  const visible = kinds.filter(kind => grants.includes(recordTypes[kind].privilege) || kind === 'access' && grants.includes('platform.security.manage') || kind === 'incident' && grants.includes('platform.health.read'));
  if (!visible.length) return null;
  if (!await platformSchemaReady()) return <div className="pa-notice">The platform-console migration must be applied before these records can be managed. Existing salon operations remain available.</div>;
  const { user } = await platformContext();
  const q = (search.q ?? '').trim().slice(0, 120);
  const [records, salons, operators] = await Promise.all([
    db.platformRecord.findMany({ where: { kind: { in: visible }, AND: [{ OR: [{ kind: { not: 'preference' } }, { createdBy: user.id }] }], ...(q ? { OR: [{ title: { contains: q, mode: 'insensitive' } }, { key: { contains: q, mode: 'insensitive' } }] } : {}), ...(search.status ? { status: search.status } : {}) }, skip: (page - 1) * 20, take: 21, orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }] }),
    db.salon.findMany({ take: 500, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    db.user.findMany({ where: { disabledAt: null, privileges: { some: { privilege: 'platform.manage', status: 'active', revokedAt: null } } }, take: 100, select: { id: true, displayName: true } }),
  ]);
  const operatorChoices = operators.map(operator => ({ id: operator.id, name: operator.displayName }));
  const history = await db.auditEvent.findMany({ where: { targetType: 'PlatformRecord', targetId: { in: records.slice(0,20).map(record => record.id) } }, orderBy: { occurredAt: 'desc' }, take: 200, select: { id: true, targetId: true, occurredAt: true, metadata: true, actor: { select: { displayName: true } } } });
  return <div className="pa-stack"><section className="pa-card"><h2>{visible.map(kind => recordTypes[kind].label).join(' / ')}</h2><SearchForm search={search} statuses={[...new Set(visible.flatMap(kind => [...recordTypes[kind].statuses]))]}/>{visible.filter(kind => grants.includes(recordTypes[kind].privilege)).map(kind => <details key={kind}><summary>+ Create {recordTypes[kind].label.toLowerCase()}</summary><RecordForm kind={kind} salons={salons} operators={operatorChoices}/></details>)}<p className="muted">Salon selector shows up to 500 salons. Operator selector shows up to 100 active operators.</p></section><div className="pa-records">{records.slice(0, 20).map(record => {
    const kind = record.kind as RecordKind; const payload = record.payload as Record<string, string | number>;
    const changes = history.filter(event => event.targetId === record.id);
    return <article className="pa-card" key={`${record.id}:${record.version}`}><div className="pa-row"><div><h3>{record.title}</h3><small>{recordTypes[kind].label} · Updated {formatDate(record.updatedAt)}</small></div><span className="pa-badge">{record.status.replaceAll('_', ' ')}</span></div><div className="pa-meta"><span>{record.salonId ? salons.find(salon => salon.id === record.salonId)?.name ?? record.salonId : 'Platform / all salons'}</span><span>{operatorChoices.find(operator => operator.id === record.assigneeId)?.name ?? 'Unassigned'}</span><span>Version {record.version}</span></div><p className="pa-code">{record.id}</p>{payload.notes && <p className="pa-record-text">{String(payload.notes)}</p>}{kind === 'access' && <p className="muted">Scope: {String(payload.scope)} · Expires: {String(payload.expiresAt)} UTC · Consent: {String(payload.consent)}</p>}{kind === 'invitation' && <p><Link href={`/platform/invitations/${record.id}`}>Invitation acceptance link ↗</Link></p>}{kind === 'plan' && <p className="muted">{String(payload.code)} · ₹{(Number(payload.pricePaise ?? 0) / 100).toLocaleString('en-IN')}/month · {String(payload.trialDays ?? 0)} trial days · {String(payload.graceDays ?? 0)} grace days<br/>Limits: {String(payload.branchLimit ?? 0)} branches · {String(payload.staffLimit ?? 0)} staff · Entitlements: {String(payload.entitlements ?? '')}</p>}{(grants.includes(recordTypes[kind].privilege) || kind === 'access' && grants.includes('platform.security.manage')) && <details><summary>{kind === 'access' ? 'Review access request' : 'Edit record'}</summary><RecordForm kind={kind} record={record} salons={salons} operators={operatorChoices}/></details>}{kind === 'access' && record.status === 'approved' && grants.includes('platform.support.manage') && <SupportMetadataForm id={record.id}/>} {changes.length > 0 && <details><summary>Case / record history ({changes.length})</summary>{changes.map(event => { const meta = event.metadata as Record<string, unknown>; return <div className="pa-row" key={event.id}><div><strong>{String(meta.status ?? '')}</strong><small>{event.actor?.displayName ?? 'System'} · {formatDate(event.occurredAt)}</small><p className="pa-record-text">{String(meta.notes ?? '')}</p></div></div>; })}</details>}</article>;
  })}</div>{!records.length && <Empty>No records yet. Create a record to start this workflow.</Empty>}<Pager page={page} more={records.length > 20} base={`/platform/${section}`} search={search}/></div>;
}
