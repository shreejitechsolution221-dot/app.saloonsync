import 'server-only';
import { db } from '@/lib/db';
import { DomainError } from './errors';
import type { Context } from './shared';

export async function businessReport(
  c: Context,
  combined = false,
  days: number | 'all' = 30,
  range?: { from?: Date; until?: Date },
  filterBranchId?: string
) {
  if (!['owner', 'admin', 'manager', 'accountant'].includes(c.membership.role))
    throw new DomainError('Business reports require authorized financial access.');
  if (combined && (c.membership.role !== 'owner' || c.membership.branchScope !== 'all'))
    throw new DomainError('Only an owner can open the combined ownership report.');

  const businesses = combined
    ? (
        await db.salonMembership.findMany({
          where: {
            userId: c.user.id,
            role: 'owner',
            status: 'active',
            salon: { status: 'active' },
            user: { disabledAt: null },
          },
          select: { salon: { select: { id: true, name: true } } },
        })
      ).map(m => m.salon)
    : [{ id: c.salonId, name: c.membership.salon.name }];

  const ids = businesses.map(b => b.id);

  let since: Date;
  const until = range?.until ?? new Date();
  if (range?.from) {
    since = range.from;
  } else if (days === 'all' || days === 0) {
    since = new Date('2020-01-01T00:00:00Z');
  } else {
    since = new Date(Date.now() - (Number(days) || 30) * 86400000);
  }

  const selectedBranch =
    filterBranchId && filterBranchId !== 'all' && c.branches.some(b => b.id === filterBranchId)
      ? filterBranchId
      : null;

  const branchFilterIds = selectedBranch ? [selectedBranch] : c.branches.map(b => b.id);
  const tenant = { salonId: { in: ids } };
  const location = combined ? {} : { branchId: selectedBranch ? selectedBranch : { in: c.branches.map(b => b.id) } };

  const [invoices, payments, expenses, refunds, visits, services, hours, locations] = await Promise.all([
    db.invoice.groupBy({
      by: ['salonId'],
      where: { ...tenant, ...location, createdAt: { gte: since, lte: until } },
      _sum: { totalPaise: true, basePaise: true, discountPaise: true, taxPaise: true },
      _count: true,
    }),
    db.payment.groupBy({
      by: ['salonId', 'method'],
      where: { ...tenant, invoice: location, recordedAt: { gte: since, lte: until } },
      _sum: { amountPaise: true },
    }),
    db.expense.groupBy({
      by: ['salonId', 'category'],
      where: { ...tenant, ...location, status: 'approved', incurredAt: { gte: since, lte: until } },
      _sum: { amountPaise: true },
    }),
    db.$queryRaw<{ salonId: string; gross: number; net: number }[]>`SELECT r."salonId",sum(r."amountPaise")::double precision AS gross,sum(round(r."amountPaise"::numeric*(i."basePaise"-i."discountPaise")/nullif(i."totalPaise",0)))::double precision AS net FROM app."Refund" r JOIN app."Invoice" i ON i.id=r."invoiceId" AND i."salonId"=r."salonId" WHERE r."salonId"=ANY(${ids}::uuid[]) AND r."createdAt">=${since} AND r."createdAt"<=${until} AND (${combined} OR r."branchId"=ANY(${branchFilterIds}::uuid[])) GROUP BY r."salonId"`,
    db.appointment.groupBy({
      by: ['salonId', 'status'],
      where: { ...tenant, ...location, startsAt: { gte: since, lte: until } },
      _count: true,
    }),
    db.appointment.groupBy({
      by: ['serviceName'],
      where: { ...tenant, ...location, status: 'completed', completedAt: { gte: since, lte: until } },
      _count: true,
      _sum: { pricePaise: true },
      orderBy: { _count: { serviceName: 'desc' } },
      take: 10,
    }),
    db.$queryRaw<{ hour: number; count: number }[]>`SELECT extract(hour FROM ("startsAt" AT TIME ZONE 'Asia/Kolkata'))::int AS hour,count(*)::int AS count FROM app."Appointment" WHERE "salonId"=ANY(${ids}::uuid[]) AND "startsAt">=${since} AND "startsAt"<=${until} AND (${combined} OR "branchId"=ANY(${branchFilterIds}::uuid[])) AND status NOT IN ('cancelled','no_show') GROUP BY 1 ORDER BY count DESC LIMIT 8`,
    db.invoice.groupBy({
      by: ['salonId', 'branchId'],
      where: { ...tenant, ...location, createdAt: { gte: since, lte: until } },
      _sum: { totalPaise: true, taxPaise: true },
      _count: true,
    }),
  ]);

  const rows = businesses.map(b => {
    const invoice = invoices.find(i => i.salonId === b.id);
    const collected = payments.filter(p => p.salonId === b.id).reduce((n, p) => n + (p._sum.amountPaise ?? 0), 0);
    const costs = expenses.filter(e => e.salonId === b.id).reduce((n, e) => n + (e._sum.amountPaise ?? 0), 0);
    const refunded = refunds.find(r => r.salonId === b.id)?.gross ?? 0;
    const refundedNet = refunds.find(r => r.salonId === b.id)?.net ?? 0;
    const invoiced = invoice?._sum.totalPaise ?? 0;
    const tax = invoice?._sum.taxPaise ?? 0;
    return {
      ...b,
      invoiced,
      tax,
      discount: invoice?._sum.discountPaise ?? 0,
      collected,
      refunded,
      refundedNet,
      expenses: costs,
      estimatedResult: invoiced - tax - refundedNet - costs,
      appointments: visits.filter(v => v.salonId === b.id).reduce((n, v) => n + v._count, 0),
    };
  });

  return {
    businesses,
    rows,
    payments,
    expenses,
    visits,
    services,
    hours,
    locations,
    since,
    until,
    combined,
    filterBranchId: selectedBranch,
  };
}
