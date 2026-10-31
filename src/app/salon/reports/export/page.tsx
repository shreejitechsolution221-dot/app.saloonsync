import { redirect } from 'next/navigation';
import { requireOperations } from '@/lib/salon/context';
import { SalonShell, PageHeading } from '@/components/salon/shell';
import { ModuleTabs } from '@/components/operations/ui';
import { ReportExportForm } from '@/components/salon/report-export-form';
import { db } from '@/lib/db';

export default async function Export({
  searchParams,
}: {
  searchParams: Promise<{
    scope?: string;
    days?: string;
    from?: string;
    to?: string;
    branchId?: string;
  }>;
}) {
  const c = await requireOperations(false, 'reports');
  if (!['owner', 'admin', 'manager', 'accountant'].includes(c.membership.role)) {
    redirect('/salon/access-denied');
  }

  const q = await searchParams;
  const scope = q.scope === 'owned' ? 'owned' : 'selected';
  if (scope === 'owned' && c.membership.role !== 'owner') {
    redirect('/salon/access-denied');
  }

  const branches = await db.branch.findMany({
    where: {
      salonId: c.salonId,
      status: 'active',
      ...(c.membership.branchScope === 'selected'
        ? { id: { in: c.branches.map(b => b.id) } }
        : {}),
    },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  return (
    <SalonShell active="reports">
      <PageHeading
        title="Export Financial & Operations Data"
        description="Download detailed CSV spreadsheets with custom date ranges, branch filters, or full historical records."
      />
      <ModuleTabs module="reports" active="/export" />
      <div className="studio-content">
        <ReportExportForm
          branches={branches}
          initialBranchId={q.branchId}
          isOwner={c.membership.role === 'owner'}
          initialScope={scope}
          initialDays={q.days}
          initialFrom={q.from}
          initialTo={q.to}
        />
      </div>
    </SalonShell>
  );
}
