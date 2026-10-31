import {measuredPage} from '@/lib/performance/database-timing';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {z} from 'zod';
import {receiptDocument} from '@/lib/operations/receipt-query';
import {requireOperations,money} from '@/lib/salon/context';
import {SalonShell,PageHeading} from '@/components/salon/shell';
import {PrintReceipt} from '@/components/operations/print-receipt';
async function Receipt({params}:{params:Promise<{invoiceId:string}>}){
 const c=await requireOperations(false,'billing');const parsed=z.uuid().safeParse((await params).invoiceId);if(!parsed.success)notFound();
 const invoice=await receiptDocument(c,parsed.data);if(!invoice)notFound();
 const {lines,refunds}=invoice;
 const paid=invoice.payments.reduce((n,p)=>n+p.amountPaise,0),due=Math.max(0,invoice.totalPaise-paid),refunded=refunds.reduce((n,r)=>n+r.amountPaise,0);
 const date=(value:Date)=>value.toLocaleString('en-IN',{timeZone:'Asia/Kolkata',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
 const branch=c.branches.find(b=>b.id===invoice.branchId);
 return <SalonShell active="billing"><div className="billing-workspace"><PageHeading eyebrow="BILLING & POS" title="A bill worth keeping." description="A clear receipt, ready to print or save as PDF." action={<PrintReceipt/>}/><div className="studio-content receipt-workspace"><Link className="receipt-back no-print" href="/salon/billing">← Back to billing</Link><article className="printable-receipt receipt-paper">
  <header className="receipt-brand"><div><span className="receipt-mark" aria-hidden="true">S</span><h2>{c.membership.salon.name}</h2><p>{branch?.name??'Salon'}</p></div><div className="receipt-document"><p>INVOICE / RECEIPT</p><strong>INV-{invoice.id.slice(0,8).toUpperCase()}</strong><span>{date(invoice.createdAt)} IST</span><b className={due?'receipt-unpaid':'receipt-paid'}>{due?'PAYMENT DUE':'PAID'}</b></div></header>
  <div className="receipt-customer"><div><span>BILLED TO</span><h3>{invoice.customerName}</h3><p>{invoice.appointmentId?'Appointment service':'Direct / walk-in purchase'}</p></div><div><span>INVOICE TOTAL</span><strong>{money(invoice.totalPaise)}</strong></div></div>
  <div className="receipt-table-wrap"><table className="receipt-table"><thead><tr><th>Service / product</th><th>Qty</th><th>Unit price</th><th>Amount</th></tr></thead><tbody>{(lines.length?lines:[{id:'legacy',description:invoice.serviceName,quantity:1,unitPricePaise:invoice.basePaise}]).map(l=><tr key={l.id}><td>{l.description}</td><td>{l.quantity}</td><td>{money(l.unitPricePaise)}</td><td>{money(l.quantity*l.unitPricePaise)}</td></tr>)}</tbody></table></div>
  <div className="receipt-summary"><div className="receipt-payment"><h3>Payment details</h3>{invoice.payments.length?invoice.payments.map(p=><div key={p.id}><span>{p.method.replaceAll('_',' ').toUpperCase()}<small>{date(p.recordedAt)}</small></span><strong>{money(p.amountPaise)}</strong></div>):<p>Payment has not been recorded.</p>}{refunded>0&&<p>Refunds recorded: <strong>{money(refunded)}</strong></p>}</div><dl className="receipt-totals"><div><dt>Subtotal</dt><dd>{money(invoice.basePaise)}</dd></div><div><dt>Additional discount</dt><dd>− {money(invoice.discountPaise-invoice.loyaltyPoints*100)}</dd></div>{invoice.loyaltyPoints>0&&<div><dt>Loyalty · {invoice.loyaltyPoints} points</dt><dd>− {money(invoice.loyaltyPoints*100)}</dd></div>}<div><dt>Tax ({invoice.taxBps/100}%)</dt><dd>{money(invoice.taxPaise)}</dd></div><div className="receipt-grand-total"><dt>Total</dt><dd>{money(invoice.totalPaise)}</dd></div><div><dt>Paid</dt><dd>{money(paid)}</dd></div><div className="receipt-due"><dt>Balance due</dt><dd>{money(due)}</dd></div></dl></div>
  <footer className="receipt-thanks"><h3>Thank you for visiting.</h3><p>We look forward to seeing you again.</p><span>Invoice reference: {invoice.id}</span><small>Powered by Saloonsync</small></footer>
 </article></div></div></SalonShell>;
}

export default measuredPage("billing.receipt",Receipt);
