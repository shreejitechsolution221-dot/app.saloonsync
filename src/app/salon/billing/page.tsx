import {measuredPage} from '@/lib/performance/database-timing';
import Link from 'next/link';
import {serviceOptions} from '@/lib/operations/service-options';
import {InvoiceOptions} from '@/components/salon/invoice-options';
import {checkoutCustomers} from '@/lib/operations/checkout-options';
import {ModuleTabs,MoneyMethod} from '@/components/operations/ui';
import {db} from '@/lib/db';
import {requireOperations,money} from '@/lib/salon/context';
import {SalonShell,PageHeading,Empty} from '@/components/salon/shell';
import {ActionForm,Field} from '@/components/salon/forms';
import {SidePanel} from '@/components/salon/side-panel';
import {redeemGiftCard} from '@/server/growth-inventory';
import {BillingStats} from '@/components/salon/billing-ui';
import {DirectBill} from '@/components/salon/direct-bill';
import {getSettings} from '@/lib/operations/shared';
import {createInvoice,recordPayment} from '@/server/salon-actions';
export const dynamic='force-dynamic';
async function Billing(){
 const c=await requireOperations(false,'billing');
 const [customers,services,rules,invoices,bookings]=await Promise.all([
  checkoutCustomers(c),serviceOptions(c.salonId),getSettings(c),
  db.invoice.findMany({where:{salonId:c.salonId,branchId:{in:c.branches.map(b=>b.id)}},select:{id:true,appointmentId:true,customerName:true,serviceName:true,createdAt:true,loyaltyPoints:true,basePaise:true,discountPaise:true,taxPaise:true,totalPaise:true,payments:{select:{id:true,method:true,amountPaise:true,recordedAt:true}}},orderBy:{createdAt:'desc'},take:100}),
  db.appointment.findMany({where:{salonId:c.salonId,branchId:{in:c.branches.map(b=>b.id)},status:'completed'},select:{id:true,salonCustomerId:true,serviceName:true,pricePaise:true,customer:{select:{displayName:true}},salonCustomer:{select:{displayName:true}}},orderBy:{startsAt:'desc'},take:100}),
 ]);
 const invoiced=new Set(invoices.map(i=>i.appointmentId)),ready=bookings.filter(b=>!invoiced.has(b.id));
 const total=invoices.reduce((n,i)=>n+i.totalPaise,0),collected=invoices.reduce((n,i)=>n+i.payments.reduce((s,p)=>s+p.amountPaise,0),0);
 const outstanding=invoices.reduce((n,i)=>n+Math.max(0,i.totalPaise-i.payments.reduce((s,p)=>s+p.amountPaise,0)),0);
 const date=(d:Date)=>d.toLocaleDateString('en-IN',{timeZone:'Asia/Kolkata',day:'numeric',month:'short',year:'numeric'});
 const canLoyalty=['owner','admin','manager','receptionist'].includes(c.membership.role);
 return <SalonShell active="billing"><div className="billing-workspace"><PageHeading eyebrow="BILLING & POS" title="Good service. Great checkout." description="Bills, balances and customer rewards, brought together." action={<SidePanel id="direct-bill" label="+ Create direct bill" title="Create a direct bill" description="Find a customer, add services, apply loyalty and record payment. No appointment needed." eyebrow="WALK-IN CHECKOUT"><DirectBill branches={c.branches} taxBps={rules.taxBps} customers={customers} services={services}/></SidePanel>}/><ModuleTabs module="billing"/>
 <div className="studio-content"><BillingStats items={[{label:'Total billed',value:money(total),note:'Latest 100 invoices'},{label:'Payments received',value:money(collected),note:'Collected against these invoices'},{label:'Outstanding balance',value:money(outstanding),note:'Awaiting collection'},{label:'Ready to invoice',value:ready.length,note:'Completed appointments'}]}/>
 <div className="overview-columns billing-ledger"><section className="studio-panel invoice-collection"><div className="invoice-collection-heading"><div><p className="eyebrow">YOUR BILLING DESK</p><h2>Recent invoices <span className="billing-count">{invoices.length}</span></h2><p>Every visit, payment and reward in one clear record.</p></div>{canLoyalty&&<Link className="invoice-loyalty-link" href="/salon/customers/loyalty">Manage loyalty ↗</Link>}</div>
 {invoices.length?invoices.map(i=>{
  const paid=i.payments.reduce((n,p)=>n+p.amountPaise,0),due=Math.max(0,i.totalPaise-paid);
  return <article className={'billing-invoice '+(due?'has-balance':'is-settled')} key={i.id}><header><span className="invoice-customer-avatar" aria-hidden="true">{i.customerName.split(' ').filter(Boolean).map(n=>n[0]).slice(0,2).join('')}</span><div className="invoice-customer-detail"><h3>{i.customerName}</h3><div><Link href={'/salon/billing/receipt/'+i.id}>INV-{i.id.slice(0,8).toUpperCase()}</Link><span>·</span><time dateTime={i.createdAt.toISOString()}>{date(i.createdAt)}</time></div></div><span className={'state-pill '+(due?'pending':'approved')}>{due?'Outstanding':'Paid'}</span></header>
   <p className="invoice-service-description">{i.serviceName}</p><div className="invoice-value-strip"><div><span>Bill total</span><strong>{money(i.totalPaise)}</strong></div><div><span>Paid</span><strong>{money(paid)}</strong></div><div className={due?'invoice-balance':''}><span>Balance due</span><strong>{money(due)}</strong></div></div>
   <div className="invoice-charge-note"><span>Subtotal {money(i.basePaise)}</span><span>Discount {money(i.discountPaise)}</span><span>Tax {money(i.taxPaise)}</span>{i.loyaltyPoints>0&&<span className="invoice-reward-tag">✧ {i.loyaltyPoints} loyalty points redeemed</span>}</div>
   <footer><Link className="invoice-receipt-button" href={'/salon/billing/receipt/'+i.id}>View / print bill ↗</Link>{due>0?<SidePanel key={i.id+':'+due} label="Record payment" title="Record payment" description={`${i.customerName} · Balance due ${money(due)}`} eyebrow="PAYMENT COLLECTION"><div className="payment-balance-banner"><span>Outstanding balance</span><strong>{money(due)}</strong><small>INV-{i.id.slice(0,8).toUpperCase()}</small></div><ActionForm action={recordPayment} submit="Save payment"><input type="hidden" name="invoiceId" value={i.id}/><Field name="amountRupees" label="Amount received (₹)" type="number" min={0.01} max={due/100} value={due/100}/><MoneyMethod/></ActionForm><details className="payment-alternative"><summary>Redeem a gift card instead</summary><ActionForm action={redeemGiftCard} submit="Redeem gift card"><input type="hidden" name="invoiceId" value={i.id}/><Field name="code" label="Gift card code"/><Field name="amountRupees" label="Amount to redeem (₹)" type="number" min={0.01} max={due/100}/></ActionForm></details></SidePanel>:<span className="invoice-settled-label">✓ Collected in full</span>}</footer>
   {i.payments.length>0&&<details className="invoice-payment-history"><summary>{i.payments.length} payment{i.payments.length===1?'':'s'} recorded</summary>{i.payments.map(p=><div key={p.id}><span>{p.method.toUpperCase()} · {date(p.recordedAt)}</span><strong>{money(p.amountPaise)}</strong></div>)}</details>}
  </article>;
 }):<Empty title="Your first bill starts here." description="Use Create direct bill or invoice a completed appointment."/>}</section>
 <aside className="studio-panel invoice-ready-panel"><p className="eyebrow">COMPLETED VISITS</p><div className="billing-panel-heading"><h2>Ready to invoice</h2><span className="billing-count">{ready.length}</span></div><p className="muted">Service prices stay as booked.</p>{ready.map(b=><article className="ready-bill" key={b.id}><strong>{b.salonCustomer?.displayName??b.customer?.displayName??'Customer'}</strong><p>{b.serviceName}</p><div><strong>{money(b.pricePaise)}</strong><SidePanel label="Create invoice" title="Invoice completed visit" description={b.serviceName+' · '+money(b.pricePaise)} secondary eyebrow="APPOINTMENT BILLING"><ActionForm action={createInvoice} submit="Create invoice"><input type="hidden" name="id" value={b.id}/><Field name="discountRupees" label="Additional discount (₹)" type="number" min={0} value={0} required={false}/><Field name="offerCode" label="Offer code (optional)" required={false}/><InvoiceOptions customerId={b.salonCustomerId}/></ActionForm></SidePanel></div></article>)}{!ready.length&&<Empty title="All caught up." description="Completed visits awaiting an invoice will appear here."/>}<div className="invoice-rewards-note"><span aria-hidden="true">✧</span><strong>Make every return rewarding.</strong><p>Generate a customer’s loyalty code, then apply it while creating a bill. 1 point = ₹1 off.</p>{canLoyalty&&<Link href="/salon/customers/loyalty">Open loyalty rewards ↗</Link>}</div></aside></div>
 </div></div></SalonShell>;
}
export default measuredPage('billing',Billing);
