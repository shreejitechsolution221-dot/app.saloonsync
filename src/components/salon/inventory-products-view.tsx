'use client';
import { useId, useRef, useState } from 'react';
import type { LocationProduct } from '@/lib/operations/location-stock';
import { ActionForm, Field } from './forms';
import { Select } from '@/components/operations/ui';
import { editProduct } from '@/server/catalog-actions';
import { adjustStock } from '@/server/salon-actions';

const formatINR = (paise: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(paise / 100);

export function InventoryProductsView({
  products,
  branches,
  editor,
  catalogEditor,
}: {
  products: LocationProduct[];
  branches: { id: string; name: string }[];
  editor: boolean;
  catalogEditor: boolean;
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'low_stock' | 'in_stock'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<'view' | 'edit' | 'adjust'>('view');

  const panel = useRef<HTMLDialogElement>(null);
  const headingId = useId();

  const selected = products.find(p => p.id === selectedId);

  // Compute metrics
  const totalProducts = products.length;
  const lowStockProducts = products.filter(p => p.stock <= p.reorderAt);
  const totalUnits = products.reduce((acc, p) => acc + Math.max(0, p.stock), 0);
  const totalRetailValue = products.reduce((acc, p) => acc + Math.max(0, p.stock) * p.pricePaise, 0);

  // Filter products based on search query and active tab
  const filteredProducts = products.filter(p => {
    const q = query.trim().toLowerCase();
    const matchesQuery =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.toLowerCase().includes(q));

    if (!matchesQuery) return false;
    if (filter === 'low_stock') return p.stock <= p.reorderAt;
    if (filter === 'in_stock') return p.stock > 0;
    return true;
  });

  function openDrawer(id: string, newMode: 'view' | 'edit' | 'adjust') {
    setSelectedId(id);
    setMode(newMode);
    if (!panel.current?.open) {
      panel.current?.showModal();
    }
  }

  function closeDrawer() {
    panel.current?.close();
    setSelectedId(null);
  }

  return (
    <>
      {/* Metric Stat Cards */}
      <div className="inventory-stats">
        <div className="inventory-stat-card">
          <span>Catalog items</span>
          <strong>{totalProducts}</strong>
          <small>Products configured for salon</small>
        </div>
        <div
          className="inventory-stat-card"
          style={{ cursor: 'pointer' }}
          onClick={() => setFilter(filter === 'low_stock' ? 'all' : 'low_stock')}
          title="Click to toggle low stock filter"
        >
          <span>Low stock alert</span>
          <strong style={{ color: lowStockProducts.length ? '#b66838' : 'inherit' }}>
            {lowStockProducts.length}
          </strong>
          <small>Items at or below reorder threshold</small>
        </div>
        <div className="inventory-stat-card">
          <span>Total stock units</span>
          <strong>{totalUnits.toLocaleString('en-IN')}</strong>
          <small>On shelf across selected locations</small>
        </div>
        <div className="inventory-stat-card">
          <span>Stock retail value</span>
          <strong>{formatINR(totalRetailValue)}</strong>
          <small>Calculated from current unit selling price</small>
        </div>
      </div>

      {/* Toolbar: Search + Filter Tabs */}
      <div className="inventory-toolbar">
        <div className="inventory-search-wrap">
          <span className="inventory-search-icon" aria-hidden="true">⌕</span>
          <input
            type="search"
            aria-label="Search or scan product"
            placeholder="Search by name, SKU or scan barcode…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>

        <div className="inventory-filter-pills" role="tablist" aria-label="Product stock filters">
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'all'}
            className={`inventory-pill-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All products
            <span className="inventory-pill-badge" style={{ background: '#eee5ed', color: '#684560' }}>
              {products.length}
            </span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'low_stock'}
            className={`inventory-pill-btn ${filter === 'low_stock' ? 'active' : ''}`}
            onClick={() => setFilter('low_stock')}
          >
            Low stock alerts
            <span className="inventory-pill-badge">{lowStockProducts.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'in_stock'}
            className={`inventory-pill-btn ${filter === 'in_stock' ? 'active' : ''}`}
            onClick={() => setFilter('in_stock')}
          >
            In stock only
          </button>
        </div>
      </div>

      {/* Products Table */}
      <div className="inventory-table-container">
        <div className="table-scroll">
          <table className="studio-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th>Available stock</th>
                <th>Selling price</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map(p => {
                const isLow = p.stock <= p.reorderAt;
                return (
                  <tr key={p.id}>
                    <td>
                      <div>
                        <strong>{p.name}</strong>
                        {p.barcode && <span className="barcode-chip" style={{ marginLeft: 6 }}>{p.barcode}</span>}
                      </div>
                    </td>
                    <td><span className="muted" style={{ fontFamily: 'monospace' }}>{p.sku}</span></td>
                    <td>
                      <span className={`qty-pill ${p.stock > p.reorderAt ? 'positive' : p.stock > 0 ? 'neutral' : 'negative'}`}>
                        {p.stock} units
                      </span>
                    </td>
                    <td><strong>{formatINR(p.pricePaise)}</strong></td>
                    <td>
                      <span className={`state-pill ${isLow ? 'low-stock' : 'completed'}`}>
                        {isLow ? `Low stock (≤${p.reorderAt})` : 'In stock'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="inventory-row-actions" style={{ justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="inventory-row-btn"
                          onClick={() => openDrawer(p.id, 'view')}
                          title="View product details"
                        >
                          View ↗
                        </button>
                        {editor && (
                          <button
                            type="button"
                            className="inventory-row-btn"
                            onClick={() => openDrawer(p.id, 'adjust')}
                            title="Adjust stock balance"
                          >
                            Adjust
                          </button>
                        )}
                        {catalogEditor && (
                          <button
                            type="button"
                            className="inventory-row-btn"
                            onClick={() => openDrawer(p.id, 'edit')}
                            title="Edit product catalog details"
                          >
                            Edit
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!filteredProducts.length && (
          <div className="studio-empty">
            <span aria-hidden="true">✧</span>
            <h3>{query || filter !== 'all' ? 'No matching products.' : 'Everything in its place.'}</h3>
            <p>
              {query || filter !== 'all'
                ? 'Try a different search term or reset your stock filter.'
                : 'Add your salon products to start keeping track of retail and backbar stock.'}
            </p>
          </div>
        )}
      </div>

      {/* Right-Side Slide Drawer for View / Edit / Adjust */}
      <dialog
        className="studio-dialog side-panel"
        ref={panel}
        aria-labelledby={headingId}
        onClose={closeDrawer}
        onClick={event => {
          if (event.target === panel.current && event.clientX < panel.current.getBoundingClientRect().left) {
            closeDrawer();
          }
        }}
      >
        <header className="side-panel-heading">
          <div>
            <p className="eyebrow">
              {mode === 'view' ? 'PRODUCT DETAILS' : mode === 'edit' ? 'EDIT CATALOG ITEM' : 'STOCK ADJUSTMENT'}
            </p>
            <h2 id={headingId}>{selected?.name ?? 'Product'}</h2>
            <p>
              {mode === 'view'
                ? 'Stock levels, identification and pricing for this product.'
                : mode === 'edit'
                ? 'Update catalog specifications, barcode and retail pricing.'
                : 'Record manual stock intake, usage or count corrections.'}
            </p>
          </div>
          <button type="button" aria-label="Close product panel" onClick={closeDrawer}>
            ×
          </button>
        </header>

        <div className="side-panel-content">
          {selected && mode === 'view' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className={`state-pill ${selected.stock <= selected.reorderAt ? 'low-stock' : 'completed'}`}>
                  {selected.stock <= selected.reorderAt ? 'Low stock' : 'In stock'}
                </span>
                <span className="muted" style={{ fontSize: 11 }}>SKU: {selected.sku}</span>
              </div>

              <div className="inventory-stat-card" style={{ background: '#fbf8fa', padding: 16 }}>
                <span style={{ fontSize: 10, color: 'var(--studio-muted)' }}>RETAIL SELLING PRICE</span>
                <strong style={{ fontSize: 24 }}>{formatINR(selected.pricePaise)}</strong>
                <small>Preserved on customer bills and invoices</small>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ padding: 14, background: '#faf7f9', borderRadius: 8, border: '1px solid #efe4ec' }}>
                  <span style={{ fontSize: 10, color: 'var(--studio-muted)', display: 'block', marginBottom: 4 }}>
                    SELECTED BRANCH STOCK
                  </span>
                  <strong style={{ fontSize: 18, color: 'var(--studio-plum)' }}>{selected.stock} units</strong>
                </div>
                <div style={{ padding: 14, background: '#faf7f9', borderRadius: 8, border: '1px solid #efe4ec' }}>
                  <span style={{ fontSize: 10, color: 'var(--studio-muted)', display: 'block', marginBottom: 4 }}>
                    ALL BRANCHES TOTAL
                  </span>
                  <strong style={{ fontSize: 18, color: 'var(--studio-plum)' }}>{selected.globalStock} units</strong>
                </div>
              </div>

              <div style={{ padding: 14, background: '#faf7f9', borderRadius: 8, border: '1px solid #efe4ec' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span className="muted">Reorder threshold</span>
                  <strong>≤ {selected.reorderAt} units</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span className="muted">Barcode</span>
                  <span>{selected.barcode ? <code>{selected.barcode}</code> : 'None'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="muted">Opening unit cost</span>
                  <span>{formatINR(selected.costPaise)}</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                {editor && (
                  <button type="button" className="primary" style={{ flex: 1 }} onClick={() => setMode('adjust')}>
                    Adjust stock
                  </button>
                )}
                {catalogEditor && (
                  <button type="button" className="secondary" style={{ flex: 1 }} onClick={() => setMode('edit')}>
                    Edit details
                  </button>
                )}
              </div>
            </div>
          )}

          {selected && mode === 'edit' && (
            <ActionForm
              action={async (state, form) => {
                const res = await editProduct(state, form);
                if (!res.error) closeDrawer();
                return res;
              }}
              submit="Save changes"
            >
              <input type="hidden" name="id" value={selected.id} />
              <Field name="name" label="Product name" value={selected.name} />
              <Field name="barcode" label="Barcode (scan or enter)" value={selected.barcode ?? ''} required={false} />
              <Field
                name="priceRupees"
                label="Selling price (INR)"
                type="number"
                min={0}
                value={selected.pricePaise / 100}
              />
              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button type="button" className="secondary" style={{ flex: 1 }} onClick={() => setMode('view')}>
                  Back
                </button>
              </div>
            </ActionForm>
          )}

          {selected && mode === 'adjust' && (
            <ActionForm
              action={async (state, form) => {
                const res = await adjustStock(state, form);
                if (!res.error) closeDrawer();
                return res;
              }}
              submit="Confirm adjustment"
            >
              <input type="hidden" name="id" value={selected.id} />
              <Select name="branchId" label="Location branch" options={branches} />
              <Field
                name="delta"
                label="Quantity change (+ received / - used / counted)"
                type="number"
                min={-10000}
                max={10000}
              />
              <Field
                name="reason"
                label="Reason for adjustment"
                type="text"
                required={true}
                value="Physical inventory count"
              />
              <p className="hint">
                Positive values increase stock (intake/returns). Negative values decrease stock (shrinkage/breakage).
              </p>
              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button type="button" className="secondary" style={{ flex: 1 }} onClick={() => setMode('view')}>
                  Back
                </button>
              </div>
            </ActionForm>
          )}
        </div>
      </dialog>
    </>
  );
}

