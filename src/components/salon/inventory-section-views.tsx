'use client';
import { useId, useRef, useState } from 'react';
import Link from 'next/link';
import { ActionForm, Field } from './forms';
import { Select } from '@/components/operations/ui';
import {
  reviewPurchase,
  receivePurchase,
  requestPurchase,
  saveRecipe,
  removeRecipe,
} from '@/server/growth-inventory';

const formatINR = (paise: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(paise / 100);

/* =========================================================================
   1. REQUEST PURCHASE DRAWER (with ADD SUPPLIER option near supplier field)
   ========================================================================= */
export function RequestPurchaseDrawer({
  branches,
  suppliers,
  products,
}: {
  branches: { id: string; name: string }[];
  suppliers: { id: string; name: string }[];
  products: { id: string; name: string }[];
}) {
  const panel = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const [isAddingNewSupplier, setIsAddingNewSupplier] = useState(suppliers.length === 0);

  function openDrawer() {
    if (!panel.current?.open) {
      panel.current?.showModal();
    }
  }

  function closeDrawer() {
    panel.current?.close();
  }

  return (
    <>
      <button type="button" className="primary" onClick={openDrawer}>
        + Request a purchase
      </button>

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
            <p className="eyebrow">PURCHASING</p>
            <h2 id={headingId}>Request a purchase</h2>
            <p>Procure products from suppliers for stock replenishment across your locations.</p>
          </div>
          <button type="button" aria-label="Close panel" onClick={closeDrawer}>
            ×
          </button>
        </header>

        <div className="side-panel-content">
          <ActionForm
            action={async (state, form) => {
              const res = await requestPurchase(state, form);
              if (!res.error) closeDrawer();
              return res;
            }}
            submit="Submit purchase request"
          >
            <Select name="branchId" label="Receiving location branch" options={branches} />

            {/* SUPPLIER FIELD WITH ADD SUPPLIER OPTION NEAR IT */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--studio-ink)' }}>Supplier</span>
                <button
                  type="button"
                  onClick={() => setIsAddingNewSupplier(!isAddingNewSupplier)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--studio-plum)',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    padding: 0,
                    textDecoration: 'underline',
                  }}
                >
                  {isAddingNewSupplier ? '← Choose existing supplier' : '+ Add new supplier'}
                </button>
              </div>

              {!isAddingNewSupplier ? (
                suppliers.length > 0 ? (
                  <Select name="supplierId" label="" options={suppliers} />
                ) : (
                  <div className="supplier-quick-add" style={{ margin: 0 }}>
                    <p style={{ margin: 0, fontSize: 11, color: 'var(--studio-muted)' }}>
                      No suppliers registered yet. Create your first supplier below:
                    </p>
                    <Field name="newSupplierName" label="New supplier name *" required={true} />
                    <Field name="newSupplierPhone" label="Supplier phone" type="tel" required={false} />
                    <Field name="newSupplierEmail" label="Supplier email" type="email" required={false} />
                  </div>
                )
              ) : (
                <div className="supplier-quick-add">
                  <span style={{ fontSize: 10, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--studio-plum)', fontWeight: 600 }}>
                    NEW SUPPLIER REGISTRATION
                  </span>
                  <Field name="newSupplierName" label="Supplier company / vendor name *" required={true} />
                  <Field name="newSupplierPhone" label="Phone number (for orders)" type="tel" required={false} />
                  <Field name="newSupplierEmail" label="Email address (for orders)" type="email" required={false} />
                  <span className="hint" style={{ fontSize: 10 }}>
                    This vendor will be automatically saved to your supplier directory and linked to this purchase order.
                  </span>
                </div>
              )}
            </div>

            <Select name="productId" label="Product to order" options={products} />
            <Field name="quantity" label="Order quantity (units)" type="number" min={1} />
            <Field name="costRupees" label="Agreed cost per unit (INR)" type="number" min={0} />
            <Field name="note" label="Purchase order note (optional)" required={false} />

            <p className="hint">
              An owner or administrator approves the order. Once approved, clicking &ldquo;Receive stock&rdquo; atomicaly updates location balances.
            </p>
          </ActionForm>
        </div>
      </dialog>
    </>
  );
}

/* =========================================================================
   2. SET SERVICE USAGE DRAWER (Multiple products per service + ml deduction)
   ========================================================================= */
export function SetServiceUsageDrawer({
  services,
  products,
  preselectedServiceId,
  triggerLabel = '+ Set service usage',
  secondary = false,
}: {
  services: { id: string; name: string }[];
  products: { id: string; name: string }[];
  preselectedServiceId?: string;
  triggerLabel?: string;
  secondary?: boolean;
}) {
  const panel = useRef<HTMLDialogElement>(null);
  const headingId = useId();

  const [serviceId, setServiceId] = useState(preselectedServiceId || services[0]?.id || '');
  const [productLines, setProductLines] = useState<
    { productId: string; quantity: number; unit: string }[]
  >([{ productId: products[0]?.id || '', quantity: 60, unit: 'ml' }]);

  function openDrawer() {
    if (!panel.current?.open) {
      if (preselectedServiceId) setServiceId(preselectedServiceId);
      panel.current?.showModal();
    }
  }

  function closeDrawer() {
    panel.current?.close();
  }

  function addProductLine() {
    setProductLines(prev => [
      ...prev,
      { productId: products[0]?.id || '', quantity: 30, unit: 'ml' },
    ]);
  }

  function removeProductLine(index: number) {
    if (productLines.length <= 1) return;
    setProductLines(prev => prev.filter((_, i) => i !== index));
  }

  function updateLine(index: number, key: 'productId' | 'quantity' | 'unit', value: string | number) {
    setProductLines(prev =>
      prev.map((line, i) => (i === index ? { ...line, [key]: value } : line))
    );
  }

  return (
    <>
      <button type="button" className={secondary ? 'secondary' : 'primary'} onClick={openDrawer}>
        {triggerLabel}
      </button>

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
            <p className="eyebrow">SERVICE STOCK RECIPES</p>
            <h2 id={headingId}>Configure service usage</h2>
            <p>Define multiple backbar products and ml/gram/unit quantities automatically deducted when visits complete.</p>
          </div>
          <button type="button" aria-label="Close panel" onClick={closeDrawer}>
            ×
          </button>
        </header>

        <div className="side-panel-content">
          <ActionForm
            action={async (state, form) => {
              const res = await saveRecipe(state, form);
              if (!res.error) closeDrawer();
              return res;
            }}
            submit="Save service recipe"
          >
            <label className="field">
              Target service
              <select
                name="serviceId"
                value={serviceId}
                onChange={e => setServiceId(e.target.value)}
                required
              >
                {services.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>

            {/* MULTIPLE PRODUCTS CONSUMPTION SECTION */}
            <div style={{ marginTop: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--studio-ink)' }}>
                  Products consumed per completed visit
                </span>
                <span className="muted" style={{ fontSize: 10 }}>
                  Supports ml, grams & units
                </span>
              </div>

              {productLines.map((line, index) => (
                <div className="recipe-product-row" key={index}>
                  <div>
                    <label style={{ fontSize: 10, color: 'var(--studio-muted)', display: 'block', marginBottom: 4 }}>
                      Product #{index + 1}
                    </label>
                    <select
                      value={line.productId}
                      onChange={e => updateLine(index, 'productId', e.target.value)}
                      required
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        border: '1px solid var(--studio-line)',
                        borderRadius: 6,
                        background: '#fff',
                        fontSize: 11,
                      }}
                    >
                      {products.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: 10, color: 'var(--studio-muted)', display: 'block', marginBottom: 4 }}>
                      Deduction qty
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={10000}
                      value={line.quantity}
                      onChange={e => updateLine(index, 'quantity', Number(e.target.value) || 1)}
                      required
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        border: '1px solid var(--studio-line)',
                        borderRadius: 6,
                        background: '#fff',
                        fontSize: 11,
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 10, color: 'var(--studio-muted)', display: 'block', marginBottom: 4 }}>
                      Unit
                    </label>
                    <select
                      value={line.unit}
                      onChange={e => updateLine(index, 'unit', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 6px',
                        border: '1px solid var(--studio-line)',
                        borderRadius: 6,
                        background: '#fff',
                        fontSize: 11,
                      }}
                    >
                      <option value="ml">ml</option>
                      <option value="g">grams</option>
                      <option value="units">units</option>
                      <option value="pumps">pumps</option>
                    </select>
                  </div>

                  <div>
                    {productLines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeProductLine(index)}
                        style={{
                          background: 'none',
                          border: '1px solid #eccdd6',
                          borderRadius: 6,
                          color: '#983d54',
                          padding: '6px 10px',
                          cursor: 'pointer',
                          fontSize: 13,
                        }}
                        title="Remove product"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
              ))}

              <button
                type="button"
                className="secondary"
                onClick={addProductLine}
                style={{
                  width: '100%',
                  marginTop: 6,
                  fontSize: 11,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                + Add another product to this service
              </button>
            </div>

            {/* Hidden field encoding items for batch save */}
            <input
              type="hidden"
              name="items"
              value={JSON.stringify(
                productLines.map(l => ({ productId: l.productId, quantity: l.quantity }))
              )}
            />

            <p className="hint">
              When an appointment with this service is completed, each product&apos;s configured quantity (e.g. 60 ml) will be automatically deducted from the branch&apos;s inventory.
            </p>
          </ActionForm>
        </div>
      </dialog>
    </>
  );
}

/* =========================================================================
   3. PURCHASES VIEW
   ========================================================================= */
export function InventoryPurchasesView({
  orders,
  lines,
  suppliers,
  products,
  branches,
  administrator,
}: {
  orders: {
    id: string;
    branchId: string;
    supplierId: string;
    status: string;
    note: string;
    createdAt: Date;
    receivedAt: Date | null;
  }[];
  lines: {
    id: string;
    orderId: string;
    productId: string;
    quantity: number;
    unitCostPaise: number;
  }[];
  suppliers: { id: string; name: string }[];
  products: { id: string; name: string }[];
  branches: { id: string; name: string }[];
  administrator: boolean;
}) {
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'received' | 'rejected'>('all');

  const pendingCount = orders.filter(o => o.status === 'pending').length;
  const approvedCount = orders.filter(o => o.status === 'approved').length;
  const receivedCount = orders.filter(o => o.status === 'received').length;

  const filteredOrders = orders.filter(o => {
    if (filter === 'all') return true;
    return o.status === filter;
  });

  return (
    <div>
      {/* Metric Stat Cards */}
      <div className="inventory-stats">
        <div className="inventory-stat-card">
          <span>All purchase orders</span>
          <strong>{orders.length}</strong>
          <small>Total procurement orders placed</small>
        </div>
        <div
          className="inventory-stat-card"
          style={{ cursor: 'pointer' }}
          onClick={() => setFilter(filter === 'pending' ? 'all' : 'pending')}
        >
          <span>Pending approval</span>
          <strong style={{ color: pendingCount ? '#c47838' : 'inherit' }}>{pendingCount}</strong>
          <small>Awaiting manager or owner review</small>
        </div>
        <div
          className="inventory-stat-card"
          style={{ cursor: 'pointer' }}
          onClick={() => setFilter(filter === 'approved' ? 'all' : 'approved')}
        >
          <span>Ready to receive</span>
          <strong style={{ color: approvedCount ? '#508055' : 'inherit' }}>{approvedCount}</strong>
          <small>Approved orders awaiting delivery</small>
        </div>
        <div className="inventory-stat-card">
          <span>Completed receipts</span>
          <strong>{receivedCount}</strong>
          <small>Stock added to active locations</small>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="inventory-toolbar">
        <div className="inventory-filter-pills" role="tablist" aria-label="Purchase order status filters">
          {(['all', 'pending', 'approved', 'received', 'rejected'] as const).map(tab => {
            const count = tab === 'all' ? orders.length : orders.filter(o => o.status === tab).length;
            return (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={filter === tab}
                className={`inventory-pill-btn ${filter === tab ? 'active' : ''}`}
                onClick={() => setFilter(tab)}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                <span className="inventory-pill-badge">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Orders List */}
      <div className="inventory-orders-list">
        {filteredOrders.map(o => {
          const supplier = suppliers.find(s => s.id === o.supplierId);
          const branch = branches.find(b => b.id === o.branchId);
          const orderLines = lines.filter(l => l.orderId === o.id);
          const totalCost = orderLines.reduce((acc, l) => acc + l.quantity * l.unitCostPaise, 0);

          return (
            <article className="inventory-order-card" key={o.id}>
              <div className="inventory-order-header">
                <div>
                  <div className="inventory-order-title">
                    <h3>{supplier?.name ?? 'Supplier'}</h3>
                    <span className={`state-pill ${o.status}`}>{o.status.replaceAll('_', ' ')}</span>
                  </div>
                  <div className="inventory-order-meta">
                    <span>PO Ref: <strong>#{o.id.slice(0, 8).toUpperCase()}</strong></span>
                    <span>•</span>
                    <span>Location: <strong>{branch?.name ?? 'Branch'}</strong></span>
                    <span>•</span>
                    <span>
                      Date: {new Date(o.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        timeZone: 'Asia/Kolkata',
                      })}
                    </span>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: 10, color: 'var(--studio-muted)', display: 'block' }}>ORDER TOTAL</span>
                  <strong style={{ fontSize: 18, color: 'var(--studio-plum)' }}>{formatINR(totalCost)}</strong>
                </div>
              </div>

              {/* Order Lines */}
              <div className="inventory-order-lines">
                {orderLines.map(line => {
                  const product = products.find(p => p.id === line.productId);
                  return (
                    <div className="inventory-order-line-item" key={line.id}>
                      <div>
                        <strong>{product?.name ?? 'Product'}</strong>
                        <span className="muted" style={{ marginLeft: 8 }}>
                          {line.quantity} units × {formatINR(line.unitCostPaise)}
                        </span>
                      </div>
                      <strong>{formatINR(line.quantity * line.unitCostPaise)}</strong>
                    </div>
                  );
                })}
              </div>

              {o.note && (
                <p className="hint" style={{ margin: 0, fontStyle: 'italic' }}>
                  Note: &quot;{o.note}&quot;
                </p>
              )}

              {/* Actions Footer */}
              <div className="inventory-order-footer">
                <div>
                  {o.receivedAt && (
                    <span className="muted" style={{ fontSize: 11 }}>
                      ✓ Stock received on{' '}
                      {new Date(o.receivedAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        timeZone: 'Asia/Kolkata',
                      })}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  {administrator && o.status === 'pending' && (
                    <>
                      <ActionForm action={reviewPurchase} submit="Approve order">
                        <input type="hidden" name="id" value={o.id} />
                        <input type="hidden" name="status" value="approved" />
                      </ActionForm>
                      <ActionForm action={reviewPurchase} submit="Reject">
                        <input type="hidden" name="id" value={o.id} />
                        <input type="hidden" name="status" value="rejected" />
                      </ActionForm>
                    </>
                  )}

                  {o.status === 'approved' && (
                    <ActionForm action={receivePurchase} submit="Receive stock into inventory">
                      <input type="hidden" name="id" value={o.id} />
                    </ActionForm>
                  )}
                </div>
              </div>
            </article>
          );
        })}

        {!filteredOrders.length && (
          <div className="studio-empty" style={{ background: '#fff', border: '1px solid var(--studio-line)', borderRadius: 12 }}>
            <span aria-hidden="true">✧</span>
            <h3>No purchase orders {filter !== 'all' ? `marked as ${filter}` : 'recorded yet'}.</h3>
            <p>Use the &ldquo;+ Request a purchase&rdquo; button above to create a stock purchase order.</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================================================================
   4. SUPPLIERS VIEW
   ========================================================================= */
export function InventorySuppliersView({
  suppliers,
}: {
  suppliers: { id: string; name: string; phone: string; email: string }[];
}) {
  const [query, setQuery] = useState('');

  const phoneCount = suppliers.filter(s => s.phone).length;
  const emailCount = suppliers.filter(s => s.email).length;

  const filteredSuppliers = suppliers.filter(s => {
    const q = query.trim().toLowerCase();
    return (
      !q ||
      s.name.toLowerCase().includes(q) ||
      s.phone.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q)
    );
  });

  return (
    <div>
      {/* Metric Stat Cards */}
      <div className="inventory-stats">
        <div className="inventory-stat-card">
          <span>Registered suppliers</span>
          <strong>{suppliers.length}</strong>
          <small>Active vendors for product orders</small>
        </div>
        <div className="inventory-stat-card">
          <span>Phone contact available</span>
          <strong>{phoneCount}</strong>
          <small>Suppliers with mobile or landline</small>
        </div>
        <div className="inventory-stat-card">
          <span>Email contact available</span>
          <strong>{emailCount}</strong>
          <small>Suppliers reachable via email</small>
        </div>
      </div>

      {/* Toolbar: Search input */}
      <div className="inventory-toolbar">
        <div className="inventory-search-wrap">
          <span className="inventory-search-icon" aria-hidden="true">⌕</span>
          <input
            type="search"
            aria-label="Search suppliers"
            placeholder="Search suppliers by name, phone or email…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
        <span className="muted" style={{ fontSize: 11 }}>
          Showing {filteredSuppliers.length} of {suppliers.length} suppliers
        </span>
      </div>

      {/* Suppliers Grid */}
      <div className="inventory-supplier-grid">
        {filteredSuppliers.map(s => {
          const initials = s.name
            .split(' ')
            .map(n => n[0])
            .slice(0, 2)
            .join('')
            .toUpperCase();

          return (
            <article className="inventory-supplier-card" key={s.id}>
              <div className="inventory-supplier-top">
                <div className="inventory-supplier-avatar">{initials || 'SP'}</div>
                <div className="inventory-supplier-info">
                  <h3 title={s.name}>{s.name}</h3>
                  <span>Authorized vendor</span>
                </div>
              </div>

              <div className="inventory-supplier-contacts">
                <div>
                  <span className="muted" style={{ fontSize: 10, display: 'block', marginBottom: 2 }}>PHONE</span>
                  {s.phone ? (
                    <a href={`tel:${s.phone}`} title="Call supplier">
                      📞 {s.phone}
                    </a>
                  ) : (
                    <span className="muted">No phone provided</span>
                  )}
                </div>
                <div>
                  <span className="muted" style={{ fontSize: 10, display: 'block', marginBottom: 2 }}>EMAIL</span>
                  {s.email ? (
                    <a href={`mailto:${s.email}`} title="Email supplier">
                      ✉️ {s.email}
                    </a>
                  ) : (
                    <span className="muted">No email provided</span>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'auto' }}>
                <Link
                  href="/salon/inventory/purchases"
                  className="inventory-row-btn"
                  title="Create purchase order"
                >
                  Request purchase ↗
                </Link>
              </div>
            </article>
          );
        })}
      </div>

      {!filteredSuppliers.length && (
        <div className="studio-empty" style={{ background: '#fff', border: '1px solid var(--studio-line)', borderRadius: 12 }}>
          <span aria-hidden="true">✧</span>
          <h3>{query ? 'No suppliers match your search.' : 'No suppliers registered yet.'}</h3>
          <p>
            {query
              ? 'Try searching with a different name or contact number.'
              : 'Add your product vendors and distributors using the &ldquo;+ Add supplier&rdquo; button above.'}
          </p>
        </div>
      )}
    </div>
  );
}

/* =========================================================================
   5. STOCK MOVEMENTS VIEW
   ========================================================================= */
export function InventoryMovementsView({
  movements,
  products,
}: {
  movements: {
    id: string;
    productId: string;
    quantity: number;
    reason: string;
    createdAt: Date;
  }[];
  products: { id: string; name: string }[];
}) {
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'inbound' | 'outbound'>('all');

  const inboundMovements = movements.filter(m => m.quantity > 0);
  const outboundMovements = movements.filter(m => m.quantity < 0);
  const totalInboundUnits = inboundMovements.reduce((acc, m) => acc + m.quantity, 0);
  const totalOutboundUnits = Math.abs(outboundMovements.reduce((acc, m) => acc + m.quantity, 0));

  const filteredMovements = movements.filter(m => {
    if (typeFilter === 'inbound' && m.quantity <= 0) return false;
    if (typeFilter === 'outbound' && m.quantity >= 0) return false;

    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    const productName = products.find(p => p.id === m.productId)?.name ?? '';
    return productName.toLowerCase().includes(q) || m.reason.toLowerCase().includes(q);
  });

  return (
    <div>
      {/* Metric Stat Cards */}
      <div className="inventory-stats">
        <div className="inventory-stat-card">
          <span>Movement entries</span>
          <strong>{movements.length}</strong>
          <small>Audited stock change events</small>
        </div>
        <div
          className="inventory-stat-card"
          style={{ cursor: 'pointer' }}
          onClick={() => setTypeFilter(typeFilter === 'inbound' ? 'all' : 'inbound')}
        >
          <span>Inbound units</span>
          <strong style={{ color: '#3b733a' }}>+{totalInboundUnits.toLocaleString('en-IN')}</strong>
          <small>Intake, receipts and positive adjustments</small>
        </div>
        <div
          className="inventory-stat-card"
          style={{ cursor: 'pointer' }}
          onClick={() => setTypeFilter(typeFilter === 'outbound' ? 'all' : 'outbound')}
        >
          <span>Outbound units</span>
          <strong style={{ color: '#8c3b4e' }}>-{totalOutboundUnits.toLocaleString('en-IN')}</strong>
          <small>Service usage, sales and write-offs</small>
        </div>
      </div>

      {/* Toolbar: Search and Filter Pills */}
      <div className="inventory-toolbar">
        <div className="inventory-search-wrap">
          <span className="inventory-search-icon" aria-hidden="true">⌕</span>
          <input
            type="search"
            aria-label="Search movements"
            placeholder="Search by product name or movement reason…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>

        <div className="inventory-filter-pills" role="tablist" aria-label="Movement type filters">
          <button
            type="button"
            role="tab"
            aria-selected={typeFilter === 'all'}
            className={`inventory-pill-btn ${typeFilter === 'all' ? 'active' : ''}`}
            onClick={() => setTypeFilter('all')}
          >
            All movements ({movements.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={typeFilter === 'inbound'}
            className={`inventory-pill-btn ${typeFilter === 'inbound' ? 'active' : ''}`}
            onClick={() => setTypeFilter('inbound')}
          >
            Inbound only (+{inboundMovements.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={typeFilter === 'outbound'}
            className={`inventory-pill-btn ${typeFilter === 'outbound' ? 'active' : ''}`}
            onClick={() => setTypeFilter('outbound')}
          >
            Outbound only (-{outboundMovements.length})
          </button>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="inventory-table-container">
        <div className="table-scroll">
          <table className="studio-table">
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Product</th>
                <th>Reason / Transaction</th>
                <th style={{ textAlign: 'right' }}>Quantity change</th>
              </tr>
            </thead>
            <tbody>
              {filteredMovements.map(m => {
                const product = products.find(p => p.id === m.productId);
                const isPositive = m.quantity > 0;
                return (
                  <tr key={m.id}>
                    <td>
                      <time className="muted">
                        {new Date(m.createdAt).toLocaleString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          timeZone: 'Asia/Kolkata',
                        })}
                      </time>
                    </td>
                    <td>
                      <strong>{product?.name ?? 'Product'}</strong>
                    </td>
                    <td>
                      <span className="state-pill" style={{ textTransform: 'none' }}>
                        {m.reason}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span className={`qty-pill ${isPositive ? 'positive' : 'negative'}`}>
                        {isPositive ? `+${m.quantity}` : m.quantity} units
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!filteredMovements.length && (
          <div className="studio-empty">
            <span aria-hidden="true">✧</span>
            <h3>No stock movements found.</h3>
            <p>Every product intake, adjustment and service consumption is recorded here with full audit history.</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================================================================
   6. SERVICE USAGE VIEW (Grouped by service with multi-product & ml deduction)
   ========================================================================= */
export function InventoryUsageView({
  recipes,
  services,
  products,
  administrator,
}: {
  recipes: {
    id: string;
    serviceId: string;
    productId: string;
    quantity: number;
  }[];
  services: { id: string; name: string }[];
  products: { id: string; name: string }[];
  administrator: boolean;
}) {
  const [query, setQuery] = useState('');

  // Group recipes by serviceId
  const serviceMap = new Map<string, { id: string; serviceId: string; productId: string; quantity: number }[]>();
  for (const r of recipes) {
    const list = serviceMap.get(r.serviceId) ?? [];
    list.push(r);
    serviceMap.set(r.serviceId, list);
  }

  const distinctServicesCount = serviceMap.size;
  const distinctProductsCount = new Set(recipes.map(r => r.productId)).size;

  // Filter services by search query
  const filteredServices = services.filter(service => {
    const serviceRecipes = serviceMap.get(service.id);
    if (!serviceRecipes?.length) return false;

    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    const matchesService = service.name.toLowerCase().includes(q);
    const matchesProduct = serviceRecipes.some(r => {
      const p = products.find(prod => prod.id === r.productId);
      return p?.name.toLowerCase().includes(q);
    });
    return matchesService || matchesProduct;
  });

  return (
    <div>
      {/* Informative Helper Banner */}
      <div className="inventory-banner">
        <div className="inventory-banner-icon" aria-hidden="true">✧</div>
        <div className="inventory-banner-text">
          <strong>Automated Multi-Product Backbar Tracking (ml & units)</strong>
          <p>
            When an appointment for a configured service completes, all configured products and their specific deduction quantities
            (e.g., 60 ml Color Tube + 60 ml Developer + 10 ml Serum) are automatically deducted from this branch&apos;s inventory.
          </p>
        </div>
      </div>

      {/* Metric Stat Cards */}
      <div className="inventory-stats">
        <div className="inventory-stat-card">
          <span>Services with active recipes</span>
          <strong>{distinctServicesCount}</strong>
          <small>Services consuming stock automatically</small>
        </div>
        <div className="inventory-stat-card">
          <span>Products utilized</span>
          <strong>{distinctProductsCount}</strong>
          <small>Distinct backbar retail/bulk products linked</small>
        </div>
        <div className="inventory-stat-card">
          <span>Configured product linkages</span>
          <strong>{recipes.length}</strong>
          <small>Total product deduction rules</small>
        </div>
      </div>

      {/* Toolbar */}
      <div className="inventory-toolbar">
        <div className="inventory-search-wrap">
          <span className="inventory-search-icon" aria-hidden="true">⌕</span>
          <input
            type="search"
            aria-label="Search service recipes"
            placeholder="Search by service or product name…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
        <span className="muted" style={{ fontSize: 11 }}>
          Showing {filteredServices.length} configured services
        </span>
      </div>

      {/* Grouped Service Usage Cards */}
      <div className="inventory-usage-grid">
        {filteredServices.map(service => {
          const serviceRecipes = serviceMap.get(service.id) ?? [];

          return (
            <article className="inventory-usage-card" key={service.id}>
              <div className="inventory-usage-header">
                <div>
                  <span className="eyebrow" style={{ fontSize: 9, color: 'var(--studio-muted)', display: 'block', marginBottom: 4 }}>
                    SERVICE
                  </span>
                  <h3>{service.name}</h3>
                  <span className="muted" style={{ fontSize: 11 }}>
                    {serviceRecipes.length} {serviceRecipes.length === 1 ? 'product' : 'products'} consumed
                  </span>
                </div>
                {administrator && (
                  <SetServiceUsageDrawer
                    services={services}
                    products={products}
                    preselectedServiceId={service.id}
                    triggerLabel="Configure ↗"
                    secondary={true}
                  />
                )}
              </div>

              {/* List of Products consumed by this service */}
              <div className="recipe-items-list">
                {serviceRecipes.map(r => {
                  const product = products.find(p => p.id === r.productId);
                  return (
                    <div className="recipe-item-pill" key={r.id}>
                      <div>
                        <strong>{product?.name ?? 'Product'}</strong>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="ml-pill">
                          {r.quantity >= 10 ? `${r.quantity} ml` : `${r.quantity} ${r.quantity === 1 ? 'unit' : 'units'}`}
                        </span>
                        {administrator && (
                          <ActionForm action={removeRecipe} submit="×" className="inline-action">
                            <input type="hidden" name="serviceId" value={service.id} />
                            <input type="hidden" name="productId" value={r.productId} />
                          </ActionForm>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
          );
        })}
      </div>

      {!filteredServices.length && (
        <div className="studio-empty" style={{ background: '#fff', border: '1px solid var(--studio-line)', borderRadius: 12 }}>
          <span aria-hidden="true">✧</span>
          <h3>{query ? 'No matching service usage recipes.' : 'No service recipes configured yet.'}</h3>
          <p>
            {query
              ? 'Try searching with another service or product name.'
              : 'Click &ldquo;+ Set service usage&rdquo; above to link multiple products and ml deduction quantities to your services.'}
          </p>
        </div>
      )}
    </div>
  );
}
