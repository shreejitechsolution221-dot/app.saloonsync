'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type BranchOption = {
  id: string;
  name: string;
};

type ReportFilterToolbarProps = {
  currentScope: 'selected' | 'owned';
  isOwner: boolean;
  currentDays: string;
  currentFrom?: string;
  currentTo?: string;
  branches: BranchOption[];
  currentBranchId: string;
};

export function ReportFilterToolbar({
  currentScope,
  isOwner,
  currentDays,
  currentFrom = '',
  currentTo = '',
  branches,
  currentBranchId = 'all',
}: ReportFilterToolbarProps) {
  const router = useRouter();
  const [showCustomDates, setShowCustomDates] = useState(Boolean(currentFrom || currentTo));
  const [dateFrom, setDateFrom] = useState(currentFrom);
  const [dateTo, setDateTo] = useState(currentTo);

  const applyFilters = (updates: {
    scope?: 'selected' | 'owned';
    days?: string;
    from?: string;
    to?: string;
    branchId?: string;
  }) => {
    const params = new URLSearchParams();

    const targetScope = updates.scope !== undefined ? updates.scope : currentScope;
    if (targetScope === 'owned') params.set('scope', 'owned');

    const targetBranch = updates.branchId !== undefined ? updates.branchId : currentBranchId;
    if (targetBranch && targetBranch !== 'all') {
      params.set('branchId', targetBranch);
    }

    const hasCustomRange = updates.from !== undefined || updates.to !== undefined;
    if (hasCustomRange) {
      if (updates.from) params.set('from', updates.from);
      if (updates.to) params.set('to', updates.to);
    } else if (updates.days !== undefined) {
      params.set('days', updates.days);
    } else if (currentFrom || currentTo) {
      if (currentFrom) params.set('from', currentFrom);
      if (currentTo) params.set('to', currentTo);
    } else {
      params.set('days', currentDays);
    }

    const query = params.toString();
    router.push(`/salon/reports${query ? `?${query}` : ''}`);
  };

  const isCustomActive = Boolean(currentFrom || currentTo);

  return (
    <div className="report-toolbar-card">
      {/* Top row: Scope (if owner), Timeframe Presets, and Branch Selector */}
      <div className="report-toolbar-row">
        {isOwner && (
          <div className="report-filter-section">
            <span className="report-filter-label">Scope:</span>
            <div className="report-pill-group">
              <button
                type="button"
                className={`report-filter-pill ${currentScope !== 'owned' ? 'active' : ''}`}
                onClick={() => applyFilters({ scope: 'selected' })}
              >
                This Salon
              </button>
              <button
                type="button"
                className={`report-filter-pill ${currentScope === 'owned' ? 'active' : ''}`}
                onClick={() => applyFilters({ scope: 'owned' })}
              >
                All Businesses I Own
              </button>
            </div>
          </div>
        )}

        <div className="report-filter-section">
          <span className="report-filter-label">Timeframe:</span>
          <div className="report-pill-group">
            <button
              type="button"
              className={`report-filter-pill ${!isCustomActive && currentDays === '7' ? 'active' : ''}`}
              onClick={() => {
                setShowCustomDates(false);
                applyFilters({ days: '7', from: '', to: '' });
              }}
            >
              7 Days
            </button>
            <button
              type="button"
              className={`report-filter-pill ${!isCustomActive && currentDays === '30' ? 'active' : ''}`}
              onClick={() => {
                setShowCustomDates(false);
                applyFilters({ days: '30', from: '', to: '' });
              }}
            >
              30 Days
            </button>
            <button
              type="button"
              className={`report-filter-pill ${!isCustomActive && currentDays === '90' ? 'active' : ''}`}
              onClick={() => {
                setShowCustomDates(false);
                applyFilters({ days: '90', from: '', to: '' });
              }}
            >
              90 Days
            </button>
            <button
              type="button"
              className={`report-filter-pill ${!isCustomActive && currentDays === 'all' ? 'active' : ''}`}
              onClick={() => {
                setShowCustomDates(false);
                applyFilters({ days: 'all', from: '', to: '' });
              }}
            >
              All Time
            </button>
            <button
              type="button"
              className={`report-filter-pill ${showCustomDates || isCustomActive ? 'active' : ''}`}
              onClick={() => setShowCustomDates(!showCustomDates)}
            >
              Custom Range
            </button>
          </div>
        </div>

        {/* Branch Filter dropdown */}
        <div className="report-filter-section branch-section">
          <span className="report-filter-label">Branch:</span>
          <select
            className="report-branch-select"
            value={currentBranchId}
            onChange={e => applyFilters({ branchId: e.target.value })}
          >
            <option value="all">All Branches</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Expandable Custom Date Range Bar */}
      {showCustomDates && (
        <form
          className="report-custom-date-bar"
          onSubmit={e => {
            e.preventDefault();
            applyFilters({ from: dateFrom, to: dateTo, days: undefined });
          }}
        >
          <div className="date-field">
            <label htmlFor="report-from" className="report-field-label">
              Date From:
            </label>
            <input
              id="report-from"
              type="date"
              className="report-date-input"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
            />
          </div>
          <div className="date-field">
            <label htmlFor="report-to" className="report-field-label">
              Date To:
            </label>
            <input
              id="report-to"
              type="date"
              className="report-date-input"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
            />
          </div>
          <button type="submit" className="report-apply-btn">
            Apply Dates
          </button>
          {isCustomActive && (
            <button
              type="button"
              className="report-reset-btn"
              onClick={() => {
                setDateFrom('');
                setDateTo('');
                setShowCustomDates(false);
                applyFilters({ days: '30', from: '', to: '' });
              }}
            >
              Clear
            </button>
          )}
        </form>
      )}
    </div>
  );
}

