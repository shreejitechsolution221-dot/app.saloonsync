'use client';

import { useState } from 'react';

type BranchOption = {
  id: string;
  name: string;
};

type ReportExportFormProps = {
  branches: BranchOption[];
  initialBranchId?: string;
  isOwner: boolean;
  initialScope?: 'selected' | 'owned';
  initialDays?: string;
  initialFrom?: string;
  initialTo?: string;
};

export function ReportExportForm({
  branches,
  initialBranchId = 'all',
  isOwner,
  initialScope = 'selected',
  initialDays = '30',
  initialFrom = '',
  initialTo = '',
}: ReportExportFormProps) {
  const [scope, setScope] = useState<'selected' | 'owned'>(initialScope);
  const [mode, setMode] = useState<'preset' | 'custom'>(
    initialFrom || initialTo ? 'custom' : 'preset'
  );
  const [days, setDays] = useState<string>(
    ['7', '30', '90', 'all'].includes(initialDays) ? initialDays : '30'
  );
  const [dateFrom, setDateFrom] = useState<string>(initialFrom);
  const [dateTo, setDateTo] = useState<string>(initialTo);
  const [branchId, setBranchId] = useState<string>(initialBranchId);

  // Build the export API query
  const params = new URLSearchParams();
  params.set('scope', scope);

  if (mode === 'custom' && (dateFrom || dateTo)) {
    if (dateFrom) params.set('from', dateFrom);
    if (dateTo) params.set('to', dateTo);
  } else {
    params.set('days', days);
  }

  if (branchId && branchId !== 'all') {
    params.set('branchId', branchId);
  }

  const exportUrl = `/api/salon-report?${params.toString()}`;

  const selectedBranchName =
    branchId === 'all'
      ? 'All authorized branches'
      : branches.find(b => b.id === branchId)?.name ?? 'Selected branch';

  const timeLabel =
    mode === 'custom'
      ? dateFrom && dateTo
        ? `${dateFrom} to ${dateTo}`
        : dateFrom
          ? `Since ${dateFrom}`
          : dateTo
            ? `Up to ${dateTo}`
            : 'Custom range'
      : days === 'all'
        ? 'All time (complete ledger)'
        : `Last ${days} days`;

  return (
    <div className="export-builder-container">
      {/* Scope Selector for owners */}
      {isOwner && (
        <div className="export-section">
          <label className="export-field-label">Organization Scope</label>
          <div className="export-pill-group">
            <button
              type="button"
              className={`export-pill ${scope === 'selected' ? 'active' : ''}`}
              onClick={() => setScope('selected')}
            >
              This Salon Only
            </button>
            <button
              type="button"
              className={`export-pill ${scope === 'owned' ? 'active' : ''}`}
              onClick={() => setScope('owned')}
            >
              All Businesses I Own
            </button>
          </div>
        </div>
      )}

      {/* Branch Selection */}
      <div className="export-section">
        <label className="export-field-label">Branch / Location</label>
        <div className="export-select-wrap">
          <select
            className="export-dropdown"
            value={branchId}
            onChange={e => setBranchId(e.target.value)}
          >
            <option value="all">All authorized branches (Combined)</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Date Range Selection */}
      <div className="export-section">
        <label className="export-field-label">Reporting Timeframe</label>
        <div className="export-pill-group">
          <button
            type="button"
            className={`export-pill ${mode === 'preset' && days === '7' ? 'active' : ''}`}
            onClick={() => {
              setMode('preset');
              setDays('7');
            }}
          >
            Past 7 Days
          </button>
          <button
            type="button"
            className={`export-pill ${mode === 'preset' && days === '30' ? 'active' : ''}`}
            onClick={() => {
              setMode('preset');
              setDays('30');
            }}
          >
            Past 30 Days
          </button>
          <button
            type="button"
            className={`export-pill ${mode === 'preset' && days === '90' ? 'active' : ''}`}
            onClick={() => {
              setMode('preset');
              setDays('90');
            }}
          >
            Past 90 Days
          </button>
          <button
            type="button"
            className={`export-pill ${mode === 'preset' && days === 'all' ? 'active' : ''}`}
            onClick={() => {
              setMode('preset');
              setDays('all');
            }}
          >
            All Time
          </button>
          <button
            type="button"
            className={`export-pill ${mode === 'custom' ? 'active' : ''}`}
            onClick={() => setMode('custom')}
          >
            Custom Date Range
          </button>
        </div>

        {/* Custom Date Pickers */}
        {mode === 'custom' && (
          <div className="export-custom-dates">
            <div className="date-input-group">
              <label htmlFor="export-from" className="date-label">
                Date From
              </label>
              <input
                id="export-from"
                type="date"
                className="date-picker-input"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
              />
            </div>
            <div className="date-input-group">
              <label htmlFor="export-to" className="date-label">
                Date To
              </label>
              <input
                id="export-to"
                type="date"
                className="date-picker-input"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Export Summary Card */}
      <div className="export-summary-card">
        <div className="export-summary-header">
          <div>
            <span className="export-badge">Live Export Configuration</span>
            <h3 className="export-summary-title">Business Report CSV</h3>
          </div>
          <span className="export-format-badge">UTF-8 CSV (Excel / Sheets)</span>
        </div>

        <div className="export-parameters-preview">
          <div className="param-item">
            <span className="param-name">Timeframe:</span>
            <strong className="param-val">{timeLabel}</strong>
          </div>
          <div className="param-item">
            <span className="param-name">Location:</span>
            <strong className="param-val">{selectedBranchName}</strong>
          </div>
          <div className="param-item">
            <span className="param-name">Scope:</span>
            <strong className="param-val">
              {scope === 'owned' ? 'All Owned Businesses' : 'This Salon'}
            </strong>
          </div>
        </div>

        <div className="export-contents-list">
          <p className="contents-title">What will be included in this export:</p>
          <ul className="contents-bullets">
            <li>
              <strong>P&amp;L Executive Summary:</strong> Invoiced revenue, collections, GST/tax, refunds, approved costs &amp; estimated result.
            </li>
            <li>
              <strong>Branch-Wise Breakdown:</strong> Performance, invoice count, and revenue partitioned by each salon location.
            </li>
            <li>
              <strong>Top Completed Services:</strong> Treatment volume and total revenue generated per service.
            </li>
            <li>
              <strong>Payment Methods:</strong> Collections categorized by UPI, Cash, Card, and Direct Transfers.
            </li>
            <li>
              <strong>Operating Expenses:</strong> Approved expenses broken down by recorded category.
            </li>
          </ul>
        </div>

        <div className="export-action-row">
          <a
            href={exportUrl}
            download
            className="export-download-btn"
          >
            <svg
              width="18"
              height="18"
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
            Download CSV Report
          </a>
          <span className="export-safety-note">
            Formula injection safe · RFC 4180 compliant with UTF-8 BOM
          </span>
        </div>
      </div>

      {/* Quick 1-Click Downloads */}
      <div className="export-quick-presets">
        <h4 className="quick-presets-title">Quick 1-Click Standard Exports</h4>
        <div className="quick-presets-grid">
          <a
            href={`/api/salon-report?scope=${scope}&days=30${branchId !== 'all' ? `&branchId=${branchId}` : ''}`}
            className="quick-preset-card"
          >
            <span className="quick-card-title">Past 30 Days (Monthly Close)</span>
            <span className="quick-card-desc">Standard calendar monthly reporting for reconciliation</span>
            <span className="quick-card-action">Download CSV →</span>
          </a>

          <a
            href={`/api/salon-report?scope=${scope}&days=all${branchId !== 'all' ? `&branchId=${branchId}` : ''}`}
            className="quick-preset-card"
          >
            <span className="quick-card-title">All Time (Complete Ledger)</span>
            <span className="quick-card-desc">Full historical audit and archival ledger</span>
            <span className="quick-card-action">Download CSV →</span>
          </a>

          <a
            href={`/api/salon-report?scope=${scope}&days=7${branchId !== 'all' ? `&branchId=${branchId}` : ''}`}
            className="quick-preset-card"
          >
            <span className="quick-card-title">Past 7 Days (Weekly Review)</span>
            <span className="quick-card-desc">Recent week performance and staff commission prep</span>
            <span className="quick-card-action">Download CSV →</span>
          </a>
        </div>
      </div>
    </div>
  );
}

