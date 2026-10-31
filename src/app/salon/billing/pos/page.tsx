import {measuredPage} from '@/lib/performance/database-timing';
import Link from 'next/link';
import {db} from '@/lib/db';
import {locationProducts} from '@/lib/operations/location-stock';
import {BillingStats} from '@/components/salon/billing-ui';
import {requireOperations,money} from '@/lib/salon/context';
import {SalonShell,PageHeading} from '@/components/salon/shell';
import {ModuleTabs,MoneyMethod} from '@/components/operations/ui';
import {ActionForm,Field} from '@/components/salon/forms';
import {recordPayment} from '@/server/salon-actions';
import {SidePanel} from '@/components/salon/side-panel';
import {Checkout} from '@/components/salon/checkout';
import {checkoutCustomers} from '@/lib/operations/checkout-options';
import {getSettings} from '@/lib/operations/shared';
async function POS({searchParams}:{searchParams:Promise<{q?:string}>}){
 const c=await requireOperations(false,'billing');
 const [invoices,products,customers,rules]=await Promise.all([db.invoice.findMany({where:{salonId:c.salonId,branchId:{in:c.branches.map(b=>b.id)},serviceName:{startsWith:"Retail · "}},select:{id:true,customerName:true,totalPaise:true,createdAt:true,payments:{select:{amountPaise:true}}},orderBy:{createdAt:"desc"},take:100}),locationProducts(c,'',500,true),checkoutCustomers(c),getSettings(c)]);
 const action=<SidePanel label="+ Add product" title="Create product invoice" description="Search products, apply loyalty rewards and record payment." eyebrow="PRODUCT CHECKOUT"><Checkout kind="product" branches={c.branches} customers={customers} items={products} taxBps={rules.taxBps}/></SidePanel>;
 return <SalonShell active="billing"><div className="billing-workspace"><PageHeading eyebrow="BILLING & POS" title="Product sales, all together." description="Create product invoices, redeem loyalty points and record payments in one checkout." action={action}/><ModuleTabs module="billing" active="/pos"/><div className="studio-content"><BillingStats items={[{label:'Available products',value:products.length,note:'Up to 500 stocked products'},{label:'Units available',value:products.reduce((n,p)=>n+p.stock,0),note:'Across the listed products'},{label:'Loyalty redemption',value:'1 point = ₹1',note:'Apply a verified customer code'}]}/><section className="studio-panel"><div className="billing-panel-heading"><div><p className="eyebrow">PRODUCT SALES</p><h2>Recent product invoices</h2></div><span className="billing-count">{invoices.length}</span></div>{invoices.length?invoices.map(invoice=>{const due=Math.max(0,invoice.totalPaise-invoice.payments.reduce((n,p)=>n+p.amountPaise,0));return <article key={invoice.id} className="finance-record"><div className="finance-record-top"><span className="finance-record-icon" aria-hidden="true">↗</span><div><strong>{invoice.customerName}</strong><small>INV-{invoice.id.slice(0,8).toUpperCase()} · {invoice.createdAt.toLocaleDateString('en-IN',{timeZone:'Asia/Kolkata'})}</small></div><strong className="finance-amount">{money(invoice.totalPaise)}</strong><span className={`state-pill ${due?'pending':'approved'}`}>{due?'Payment due':'Paid'}</span></div><div className="finance-record-foot"><span>{due?'Outstanding '+money(due):'Collected in full'}</span><Link href={'/salon/billing/receipt/'+invoice.id}>View / print bill ↗</Link>{due>0&&<SidePanel label="Record payment" title="Record product payment" description={invoice.customerName+' · Outstanding '+money(due)} secondary eyebrow="PAYMENTS"><ActionForm action={recordPayment} submit="Record payment"><input type="hidden" name="invoiceId" value={invoice.id}/><Field name="amountRupees" label="Amount received (INR)" type="number" min={0.01} max={due/100} value={due/100}/><MoneyMethod/></ActionForm></SidePanel>}</div></article>;}):<div className="studio-empty"><h3>Ready for your first sale.</h3><p>Use Add product to create a product invoice in the right panel.</p></div>}</section></div></div></SalonShell>;
}

export default measuredPage("billing.pos",POS);
