import { notFound, redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { requireOperations } from '@/lib/salon/context';
import { SalonShell, PageHeading } from '@/components/salon/shell';
import { ActionForm, Field } from '@/components/salon/forms';
import { ModuleTabs } from '@/components/operations/ui';
import { SidePanel } from '@/components/salon/side-panel';
import { addSupplier } from '@/server/growth-inventory';
import {
  RequestPurchaseDrawer,
  SetServiceUsageDrawer,
  InventoryPurchasesView,
  InventorySuppliersView,
  InventoryMovementsView,
  InventoryUsageView,
} from '@/components/salon/inventory-section-views';

export const dynamic = 'force-dynamic';

export default async function InventorySection({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!['purchases', 'suppliers', 'movements', 'usage'].includes(section)) notFound();

  const c = await requireOperations(false, 'inventory');
  const editor = c.administrator || c.membership.role === 'inventory';
  if (!editor && section !== 'movements') redirect('/salon/access-denied');

  let body: React.ReactNode = null;
  let action: React.ReactNode = null;

  if (section === 'purchases') {
    const [{ orders, lines }, suppliers, products] = await Promise.all([
      (async () => {
        const orders = await db.purchaseOrder.findMany({
          where: { salonId: c.salonId, branchId: { in: c.branches.map(b => b.id) } },
          orderBy: { createdAt: 'desc' },
          take: 100,
        });
        const lines = await db.purchaseLine.findMany({
          where: { salonId: c.salonId, orderId: { in: orders.map(o => o.id) } },
          select: { id: true, orderId: true, productId: true, quantity: true, unitCostPaise: true },
        });
        return { orders, lines };
      })(),
      db.supplier.findMany({ where: { salonId: c.salonId }, select: { id: true, name: true }, take: 200 }),
      db.product.findMany({ where: { salonId: c.salonId }, select: { id: true, name: true }, take: 500 }),
    ]);

    action = (
      <RequestPurchaseDrawer
        branches={c.branches}
        suppliers={suppliers}
        products={products}
      />
    );

    body = (
      <InventoryPurchasesView
        orders={orders}
        lines={lines}
        suppliers={suppliers}
        products={products}
        branches={c.branches}
        administrator={c.administrator}
      />
    );
  } else if (section === 'suppliers') {
    const rows = await db.supplier.findMany({
      where: { salonId: c.salonId },
      select: { id: true, name: true, phone: true, email: true },
      orderBy: { name: 'asc' },
      take: 200,
    });

    action = (
      <SidePanel
        label="+ Add supplier"
        eyebrow="SUPPLIERS"
        title="Add supplier"
        description="Register an authorized vendor or distributor for product purchasing."
      >
        <ActionForm action={addSupplier} submit="Add supplier">
          <Field name="name" label="Supplier name" />
          <Field name="phone" label="Phone" type="tel" required={false} />
          <Field name="email" label="Email" type="email" required={false} />
        </ActionForm>
      </SidePanel>
    );

    body = <InventorySuppliersView suppliers={rows} />;
  } else if (section === 'movements') {
    const [rows, products] = await Promise.all([
      db.stockMovement.findMany({
        where: {
          salonId: c.salonId,
          OR: [{ branchId: null }, { branchId: { in: c.branches.map(b => b.id) } }],
        },
        orderBy: { createdAt: 'desc' },
        take: 150,
      }),
      db.product.findMany({ where: { salonId: c.salonId }, select: { id: true, name: true }, take: 500 }),
    ]);

    body = <InventoryMovementsView movements={rows} products={products} />;
  } else if (section === 'usage') {
    const [recipes, services, products] = await Promise.all([
      db.serviceProduct.findMany({ where: { salonId: c.salonId }, take: 500 }),
      db.service.findMany({ where: { salonId: c.salonId, active: true }, select: { id: true, name: true }, take: 200 }),
      db.product.findMany({ where: { salonId: c.salonId }, select: { id: true, name: true }, take: 500 }),
    ]);

    if (c.administrator) {
      action = (
        <SetServiceUsageDrawer
          services={services}
          products={products}
        />
      );
    }

    body = (
      <InventoryUsageView
        recipes={recipes}
        services={services}
        products={products}
        administrator={c.administrator}
      />
    );
  }

  const titles: Record<string, { title: string; description: string }> = {
    purchases: {
      title: 'From order to shelf, in sync.',
      description: 'Procure salon products, manage vendor orders and track receipt approvals.',
    },
    suppliers: {
      title: 'Your trusted suppliers.',
      description: 'Maintain authorized vendor directories and direct contact points for reordering.',
    },
    movements: {
      title: 'Every little movement, recorded.',
      description: 'A comprehensive audit ledger of intake, adjustments, transfers and service usage.',
    },
    usage: {
      title: 'The essentials behind every service.',
      description: 'Automate backbar inventory tracking with product-to-service recipes and ml deductions.',
    },
  };

  const meta = titles[section] ?? { title: 'Inventory', description: 'Salon inventory and stock controls.' };

  return (
    <SalonShell active="inventory">
      <PageHeading title={meta.title} description={meta.description} action={action} />
      <ModuleTabs module="inventory" active={'/' + section} />
      <div className="studio-content">{body}</div>
    </SalonShell>
  );
}
