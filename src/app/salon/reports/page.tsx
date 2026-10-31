import Link from 'next/link';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { requireModule, requireOperations, money } from '@/lib/salon/context';
import { businessReport } from '@/lib/operations/reports';
import { locationProducts } from '@/lib/operations/location-stock';
import { SalonShell, PageHeading } from '@/components/salon/shell';
import { ModuleTabs, Panel, Metric } from '@/components/operations/ui';
import { ReportFilterToolbar } from '@/components/salon/report-filter-toolbar';

export const dynamic = 'force-dynamic';

export default async function Reports({
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
  const c = await requireModule('reports');
  if (c.membership.role === 'staff') redirect('/salon/team/performance');
  await requireOperations(false, 'reports');

  // Handle inventory role
  if (c.membership.role === 'inventory') {
    const products = await locationProducts(c, '', 500);
    return (
      <SalonShell active="reports">
        <PageHeading
          title="Your shelves, at a glance."
          description="Current balances, reorder alerts and weighted recorded purchase cost."
        />
        <div className="studio-content">
          <div className="metric-grid">
            <Metric
              label="Recorded stock value"
              value={money(products.reduce((n, p) => n + p.stock * p.costPaise, 0))}
              note="Based on recorded unit costs, not a profit figure"
            />
          </div>
          <Panel title="Stock report">
            {products.map(p => (
              <div className="visit-row" key={p.id}>
                <strong>{p.name}</strong>
                <span>
                  {p.stock} units · {money(p.stock * p.costPaise)}
                </span>
                <span className="state-pill">{p.stock <= p.reorderAt ? 'Reorder' : 'In stock'}</span>
              </div>
            ))}
          </Panel>
        </div>
      </SalonShell>
    );
  }

  const query = await searchParams;
  const combined = query.scope === 'owned';
  if (combined && c.membership.role !== 'owner') redirect('/salon/access-denied');

  const rawDays = query.days;
  const fromStr = query.from || '';
  const toStr = query.to || '';
  const branchId = query.branchId && query.branchId !== 'all' ? query.branchId : undefined;

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

  const daysParam = rawDays === 'all' ? 'all' : ['7', '30', '90'].includes(rawDays ?? '') ? rawDays : '30';
  const reportDays: number | 'all' = daysParam === 'all' ? 'all' : Number(daysParam);

  const r = await businessReport(c, combined, range ? 'all' : reportDays, range, branchId);

  const allSalonIds = r.businesses.map(b => b.id);
  const branches = await db.branch.findMany({
    where: {
      salonId: { in: allSalonIds },
      status: 'active',
      ...(c.membership.branchScope === 'selected'
        ? { id: { in: c.branches.map(b => b.id) } }
        : {}),
    },
    select: { id: true, name: true, salonId: true, address: true },
    orderBy: { name: 'asc' },
  });

  const totals = r.rows.reduce(
    (a, b) => ({
      invoiced: a.invoiced + b.invoiced,
      collected: a.collected + b.collected,
      expenses: a.expenses + b.expenses,
      result: a.result + b.estimatedResult,
      tax: a.tax + b.tax,
      refunds: a.refunds + b.refunded,
      refundsNet: a.refundsNet + b.refundedNet,
      appointments: a.appointments + b.appointments,
    }),
    {
      invoiced: 0,
      collected: 0,
      expenses: 0,
      result: 0,
      tax: 0,
      refunds: 0,
      refundsNet: 0,
      appointments: 0,
    }
  );

  const selectedBranchObj = branchId ? branches.find(b => b.id === branchId) : null;

  // Build export link with identical parameters
  const exportParams = new URLSearchParams();
  exportParams.set('scope', combined ? 'owned' : 'selected');
  if (fromStr) exportParams.set('from', fromStr);
  if (toStr) exportParams.set('to', toStr);
  if (!fromStr && !toStr) exportParams.set('days', String(daysParam));
  if (branchId) exportParams.set('branchId', branchId);
  const exportHref = `/salon/reports/export?${exportParams.toString()}`;

  // Timeframe description label
  const timeDescription =
    fromStr || toStr
      ? `Custom range: ${fromStr || 'Beginning'} to ${toStr || 'Today'}`
      : daysParam === 'all'
        ? 'All time (Complete ledger)'
        : `Last ${daysParam} days`;

  const locationDescription = combined
    ? 'All owned salon businesses'
    : selectedBranchObj
      ? `Branch: ${selectedBranchObj.name}`
      : 'All authorized branches';

  // Compute branch-wise comparison statistics
  const branchMetrics = branches.map(branch => {
    const loc = r.locations.find(l => l.branchId === branch.id);
    const invoiced = loc?._sum.totalPaise ?? 0;
    const tax = loc?._sum.taxPaise ?? 0;
    const count = loc?._count ?? 0;
    const share = totals.invoiced > 0 ? (invoiced / totals.invoiced) * 100 : 0;
    return {
      ...branch,
      invoiced,
      tax,
      count,
      share,
    };
  });

  const unallocatedLoc = r.locations.find(l => !l.branchId);

  // Group payments by method
  const paymentMethods = r.payments.reduce<Record<string, number>>((acc, p) => {
    const method = p.method.toUpperCase();
    acc[method] = (acc[method] ?? 0) + (p._sum.amountPaise ?? 0);
    return acc;
  }, {});

  const maxServiceCount = r.services[0]?._count || 1;

  return (
    <SalonShell active="reports">
      <PageHeading
        title={combined ? 'Enterprise Portfolio Reports' : 'Business & Financial Reports'}
        description={`${timeDescription} · ${locationDescription}`}
        action={
          <Link className="report-export-cta" href={exportHref}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export CSV ↗
          </Link>
        }
      />
      <ModuleTabs module="reports" />

      <div className="studio-content">
        {/* Interactive Filter Toolbar */}
        <ReportFilterToolbar
          currentScope={combined ? 'owned' : 'selected'}
          isOwner={c.membership.role === 'owner'}
          currentDays={String(daysParam)}
          currentFrom={fromStr}
          currentTo={toStr}
          branches={branches}
          currentBranchId={branchId ?? 'all'}
        />

        {/* Branch Filter Alert Banner if filtered */}
        {selectedBranchObj && (
          <div className="report-branch-alert">
            <span className="branch-alert-text">
              Showing reports specifically for <strong>{selectedBranchObj.name}</strong>
              {selectedBranchObj.address ? ` (${selectedBranchObj.address})` : ''}
            </span>
            <Link
              href={`/salon/reports?scope=${combined ? 'owned' : 'selected'}&days=${daysParam}${fromStr ? `&from=${fromStr}` : ''}${toStr ? `&to=${toStr}` : ''}`}
              className="branch-alert-clear"
            >
              Show all branches ✕
            </Link>
          </div>
        )}

        {/* Executive Summary Metrics */}
        <div className="report-kpi-grid">
          <div className="report-kpi-card">
            <span className="kpi-label">Invoiced Total</span>
            <strong className="kpi-value">{money(totals.invoiced)}</strong>
            <span className="kpi-note">Gross billed revenue across all services &amp; products</span>
          </div>

          <div className="report-kpi-card">
            <span className="kpi-label">Collected</span>
            <strong className="kpi-value">{money(totals.collected)}</strong>
            <span className="kpi-note">Actual cash, UPI &amp; card payments received</span>
          </div>

          <div className="report-kpi-card">
            <span className="kpi-label">Approved Expenses</span>
            <strong className="kpi-value">{money(totals.expenses)}</strong>
            <span className="kpi-note">Verified salon operations, rent &amp; supply purchases</span>
          </div>

          <div className="report-kpi-card highlight">
            <span className="kpi-label">Estimated Operating Result</span>
            <strong className="kpi-value">{money(totals.result)}</strong>
            <span className={`kpi-tag ${totals.result >= 0 ? 'positive' : 'negative'}`}>
              {totals.result >= 0 ? 'Operating Surplus' : 'Operating Deficit'}
            </span>
            <span className="kpi-note">Invoiced less tax, net refunds and approved expenses</span>
          </div>

          <div className="report-kpi-card">
            <span className="kpi-label">Appointments &amp; Visits</span>
            <strong className="kpi-value">{totals.appointments}</strong>
            <span className="kpi-note">Client visits booked &amp; completed in this timeframe</span>
          </div>

          <div className="report-kpi-card">
            <span className="kpi-label">Tax &amp; Refunds</span>
            <strong className="kpi-value">{money(totals.tax)}</strong>
            <span className="kpi-note">
              GST/Tax recorded · {money(totals.refunds)} refunded
            </span>
          </div>
        </div>

        {/* Branch-Wise Performance Section */}
        <section className="studio-panel">
          <div className="panel-intro">
            <div className="panel-header-flex">
              <div>
                <h2>Branch-Wise Performance</h2>
                <p className="muted">
                  Revenue contribution, invoice count, and location breakdown.
                </p>
              </div>
              <span className="report-pill-counter">
                {branches.length} {branches.length === 1 ? 'Location' : 'Locations'}
              </span>
            </div>
          </div>

          <div className="branch-performance-container">
            <div className="table-scroll">
              <table className="studio-table branch-table">
                <thead>
                  <tr>
                    <th>Branch Location</th>
                    <th>Invoiced Revenue</th>
                    <th>Tax Recorded</th>
                    <th>Invoices</th>
                    <th>Revenue Share</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {branchMetrics.map(bm => {
                    const isCurrent = branchId === bm.id;
                    const filterLink = `/salon/reports?scope=${combined ? 'owned' : 'selected'}&days=${daysParam}${fromStr ? `&from=${fromStr}` : ''}${toStr ? `&to=${toStr}` : ''}&branchId=${bm.id}`;
                    return (
                      <tr key={bm.id} className={isCurrent ? 'branch-row-active' : ''}>
                        <td>
                          <div className="branch-name-col">
                            <strong>{bm.name}</strong>
                            {bm.address ? <small className="branch-city-tag">{bm.address}</small> : null}
                          </div>
                        </td>
                        <td>
                          <strong>{money(bm.invoiced)}</strong>
                        </td>
                        <td>{money(bm.tax)}</td>
                        <td>{bm.count} invoices</td>
                        <td>
                          <div className="branch-share-cell">
                            <span className="share-text">{bm.share.toFixed(1)}%</span>
                            <div className="share-progress-track">
                              <div
                                className="share-progress-fill"
                                style={{ width: `${Math.min(100, Math.max(0, bm.share))}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="text-right">
                          {isCurrent ? (
                            <span className="branch-selected-badge">✓ Active Filter</span>
                          ) : (
                            <Link href={filterLink} className="branch-filter-btn">
                              View Branch →
                            </Link>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {unallocatedLoc && (unallocatedLoc._sum.totalPaise ?? 0) > 0 && (
                    <tr className="legacy-row">
                      <td>
                        <strong>Legacy / Unallocated Invoices</strong>
                        <small className="muted">Invoices created prior to multi-branch tagging</small>
                      </td>
                      <td>
                        <strong>{money(unallocatedLoc._sum.totalPaise ?? 0)}</strong>
                      </td>
                      <td>{money(unallocatedLoc._sum.taxPaise ?? 0)}</td>
                      <td>{unallocatedLoc._count} invoices</td>
                      <td>
                        <span className="share-text">
                          {(
                            ((unallocatedLoc._sum.totalPaise ?? 0) / (totals.invoiced || 1)) *
                            100
                          ).toFixed(1)}
                          %
                        </span>
                      </td>
                      <td className="text-right">
                        <span className="muted">—</span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Multi-business comparison if combined is active */}
        {combined && (
          <Panel
            title="Business Comparison"
            description="Consolidated operating results across each registered salon company."
          >
            <div className="table-scroll">
              <table className="studio-table">
                <thead>
                  <tr>
                    <th>Business</th>
                    <th>Invoices</th>
                    <th>Collected</th>
                    <th>Expenses</th>
                    <th>Est. Operating Result</th>
                    <th>Visits</th>
                  </tr>
                </thead>
                <tbody>
                  {r.rows.map(row => (
                    <tr key={row.id}>
                      <td>
                        <strong>{row.name}</strong>
                      </td>
                      <td>{money(row.invoiced)}</td>
                      <td>{money(row.collected)}</td>
                      <td>{money(row.expenses)}</td>
                      <td>
                        <strong className={row.estimatedResult >= 0 ? 'text-positive' : 'text-negative'}>
                          {money(row.estimatedResult)}
                        </strong>
                      </td>
                      <td>{row.appointments}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )}

        {/* Visual Analytics Grid */}
        <div className="overview-columns">
          {/* Top Services */}
          <Panel
            title="Top Completed Services"
            description="Most popular treatments by visit frequency and billings."
          >
            {r.services.length === 0 ? (
              <p className="muted" style={{ padding: '16px 0' }}>
                No completed service visits in this period.
              </p>
            ) : (
              r.services.map(s => (
                <div className="report-chart-row" key={s.serviceName}>
                  <div className="service-name-cell">
                    <strong>{s.serviceName}</strong>
                    <small>{money(s._sum.pricePaise ?? 0)}</small>
                  </div>
                  <div className="report-bar">
                    <i style={{ width: `${(s._count / maxServiceCount) * 100}%` }} />
                  </div>
                  <span className="service-count-cell">{s._count} visits</span>
                </div>
              ))
            )}
          </Panel>

          {/* Payment Methods */}
          <Panel
            title="Payment Method Breakdown"
            description="Collections distribution by recorded tender."
          >
            {Object.keys(paymentMethods).length === 0 ? (
              <p className="muted" style={{ padding: '16px 0' }}>
                No payment transactions recorded in this period.
              </p>
            ) : (
              Object.entries(paymentMethods).map(([method, amount]) => {
                const share = totals.collected > 0 ? (amount / totals.collected) * 100 : 0;
                return (
                  <div className="report-chart-row" key={method}>
                    <strong>{method}</strong>
                    <div className="report-bar">
                      <i style={{ width: `${Math.min(100, Math.max(0, share))}%` }} />
                    </div>
                    <div className="text-right">
                      <strong>{money(amount)}</strong>
                      <small className="muted" style={{ display: 'block', fontSize: '10px' }}>
                        {share.toFixed(1)}%
                      </small>
                    </div>
                  </div>
                );
              })
            )}
          </Panel>
        </div>

        <div className="overview-columns">
          {/* Busy Hours */}
          <Panel
            title="Busiest Hours (IST)"
            description="Appointment distribution across the working day."
          >
            {r.hours.length === 0 ? (
              <p className="muted" style={{ padding: '16px 0' }}>
                No appointment timing data for this timeframe.
              </p>
            ) : (
              r.hours.map(h => (
                <div className="visit-row" key={h.hour}>
                  <strong>{String(h.hour).padStart(2, '0')}:00 IST</strong>
                  <span>{h.count} appointments</span>
                </div>
              ))
            )}
          </Panel>

          {/* Operating Expense Breakdown */}
          <Panel
            title="Approved Expenses by Category"
            description="Direct and overhead expenses incurred in this period."
          >
            {r.expenses.length === 0 ? (
              <p className="muted" style={{ padding: '16px 0' }}>
                No approved expenses recorded in this period.
              </p>
            ) : (
              r.expenses.map(e => (
                <div className="visit-row" key={e.salonId + e.category}>
                  <span>
                    <strong>{e.category}</strong>
                    {combined && (
                      <small style={{ display: 'block', color: '#888' }}>
                        {r.businesses.find(b => b.id === e.salonId)?.name}
                      </small>
                    )}
                  </span>
                  <strong>{money(e._sum.amountPaise ?? 0)}</strong>
                </div>
              ))
            )}
          </Panel>
        </div>

        {/* Operational Clarification Note */}
        <p className="availability-note">
          Estimates depend on complete expense and cost entry. Collections can relate to earlier
          invoices. Refunds are deducted net of their allocated invoice tax in their recorded period;
          commission estimates are shown under Team and are costs here only when recorded as
          approved expenses. These are operational management reports, not statutory accounts.
        </p>
      </div>
    </SalonShell>
  );
}
