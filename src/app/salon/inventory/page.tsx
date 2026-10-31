import { locationProducts } from '@/lib/operations/location-stock';
import { transferStock } from '@/server/growth-inventory';
import { Select } from '@/components/operations/ui';
import { ModuleTabs } from '@/components/operations/ui';
import { requireOperations } from '@/lib/salon/context';
import { SalonShell, PageHeading } from '@/components/salon/shell';
import { ActionForm, Field } from '@/components/salon/forms';
import { SidePanel } from '@/components/salon/side-panel';
import { addProduct } from '@/server/salon-actions';
import { InventoryProductsView } from '@/components/salon/inventory-products-view';

export const dynamic = 'force-dynamic';

export default async function Inventory({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const c = await requireOperations(false, 'inventory');
  const editor = c.administrator || c.membership.role === 'inventory';
  const catalogEditor = editor && c.membership.branchScope === 'all';
  const q = (await searchParams).q?.trim().slice(0, 120) ?? '';
  const products = await locationProducts(c, q);

  return (
    <SalonShell active="inventory">
      <PageHeading
        title="A little care behind the scenes."
        description="A shared catalog, with separate stock balances for the selected locations."
        action={
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {editor && c.availableBranches.length > 1 && (
              <SidePanel
                label="Transfer stock"
                secondary={true}
                eyebrow="STOCK TRANSFER"
                title="Transfer between locations"
                description="Move inventory safely from one salon branch to another."
              >
                <ActionForm action={transferStock} submit="Transfer stock">
                  <Select name="productId" label="Product" options={products} />
                  <Select name="branchId" label="From" options={c.branches} />
                  <Select name="targetBranchId" label="To" options={c.availableBranches} />
                  <Field name="quantity" label="Quantity" type="number" min={1} />
                </ActionForm>
              </SidePanel>
            )}
            {catalogEditor && (
              <SidePanel
                label="+ Add product"
                eyebrow="INVENTORY CATALOG"
                title="An essential for your shelves."
                description="Add a new retail or backbar product, opening stock and reorder alert thresholds."
              >
                <ActionForm action={addProduct} submit="Add product">
                  <Select name="branchId" label="Opening stock location" options={c.branches} />
                  <Field name="name" label="Product name" />
                  <Field name="sku" label="SKU" />
                  <Field name="barcode" label="Barcode (scan or type)" required={false} />
                  <Field name="costRupees" label="Opening unit cost (INR)" type="number" min={0} value={0} />
                  <Field name="stock" label="Opening stock" type="number" min={0} />
                  <Field name="reorderAt" label="Low stock threshold" type="number" min={0} value={5} />
                  <Field name="priceRupees" label="Unit price (INR)" type="number" min={0} />
                </ActionForm>
              </SidePanel>
            )}
          </div>
        }
      />
      <ModuleTabs module="inventory" />
      <div className="studio-content">
        <InventoryProductsView
          products={products}
          branches={c.branches}
          editor={editor}
          catalogEditor={catalogEditor}
        />
      </div>
    </SalonShell>
  );
}
