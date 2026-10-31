import { csvCell } from '@/lib/operations/csv';
import { NextRequest, NextResponse } from 'next/server';
import { salonContext } from '@/lib/salon/context';
import { businessReport } from '@/lib/operations/reports';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const c = await salonContext();
    const combined = request.nextUrl.searchParams.get('scope') === 'owned';
    const rawDays = request.nextUrl.searchParams.get('days');
    const fromStr = request.nextUrl.searchParams.get('from');
    const toStr = request.nextUrl.searchParams.get('to');
    const branchId = request.nextUrl.searchParams.get('branchId') || undefined;

    let range: { from?: Date; until?: Date } | undefined;
    if (fromStr || toStr) {
      range = {};
      if (fromStr) {
        const d = new Date(fromStr);
        if (!isNaN(d.getTime())) {
          d.setHours(0, 0, 0, 0);
          range.from = d;
        }
      }
      if (toStr) {
        const d = new Date(toStr);
        if (!isNaN(d.getTime())) {
          d.setHours(23, 59, 59, 999);
          range.until = d;
        }
      }
    }

    const days: number | 'all' = rawDays === 'all'
      ? 'all'
      : ['7', '30', '90'].includes(rawDays ?? '')
        ? Number(rawDays)
        : 30;

    const report = await businessReport(c, combined, days, range, branchId);

    const branches = await db.branch.findMany({
      where: { salonId: { in: report.businesses.map(b => b.id) } },
      select: { id: true, name: true, salonId: true },
    });

    const rows: (string | number)[][] = [
      ['Business / Scope Summary'],
      ['Business', 'Invoiced INR', 'Tax INR', 'Collected INR', 'Refunded INR', 'Approved expenses INR', 'Estimated result INR', 'Appointments'],
      ...report.rows.map(r => [
        r.name,
        r.invoiced / 100,
        r.tax / 100,
        r.collected / 100,
        r.refunded / 100,
        r.expenses / 100,
        r.estimatedResult / 100,
        r.appointments,
      ]),
      [],
      ['Branch-wise Breakdown'],
      ['Branch', 'Business', 'Invoices Count', 'Invoiced INR', 'Tax INR'],
      ...report.locations.map(l => {
        const branchName = branches.find(b => b.id === l.branchId)?.name ?? (l.branchId ? 'Unknown branch' : 'Unallocated legacy invoice');
        const bizName = report.businesses.find(b => b.id === l.salonId)?.name ?? 'Salon';
        return [
          branchName,
          bizName,
          l._count,
          (l._sum.totalPaise ?? 0) / 100,
          (l._sum.taxPaise ?? 0) / 100,
        ];
      }),
      [],
      ['Top Services Breakdown'],
      ['Service Name', 'Visits Completed', 'Total Revenue INR'],
      ...report.services.map(s => [
        s.serviceName,
        s._count,
        (s._sum.pricePaise ?? 0) / 100,
      ]),
      [],
      ['Payment Methods Breakdown'],
      ['Business', 'Payment Method', 'Collected INR'],
      ...report.payments.map(p => {
        const bizName = report.businesses.find(b => b.id === p.salonId)?.name ?? 'Salon';
        return [
          bizName,
          p.method,
          (p._sum.amountPaise ?? 0) / 100,
        ];
      }),
      [],
      ['Approved Expenses by Category'],
      ['Business', 'Category', 'Expense INR'],
      ...report.expenses.map(e => {
        const bizName = report.businesses.find(b => b.id === e.salonId)?.name ?? 'Salon';
        return [
          bizName,
          e.category,
          (e._sum.amountPaise ?? 0) / 100,
        ];
      }),
    ];

    const dateSlug = range?.from && range?.until
      ? `${fromStr}_to_${toStr}`
      : days === 'all'
        ? 'all-time'
        : `${days}d`;
    const filename = `saloonsync-report-${dateSlug}.csv`;

    return new NextResponse(
      '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n'),
      {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'private, no-store',
        },
      }
    );
  } catch {
    return NextResponse.json(
      { error: 'Report unavailable' },
      { status: 403, headers: { 'Cache-Control': 'private, no-store' } }
    );
  }
}
