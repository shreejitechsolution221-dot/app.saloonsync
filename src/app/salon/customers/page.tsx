import {measuredPage} from '@/lib/performance/database-timing';
import {customerScope} from '@/lib/operations/customer-scope';
import {ModuleTabs,Select} from '@/components/operations/ui';
import Link from 'next/link';
import {db} from '@/lib/db';
import {requireOperations} from '@/lib/salon/context';
import {SalonShell,PageHeading,Empty} from '@/components/salon/shell';
import {ActionForm,Field} from '@/components/salon/forms';
import {SidePanel} from '@/components/salon/side-panel';
import {CustomerSearch} from '@/components/salon/customer-search';
import {CustomerManager} from '@/components/salon/customer-manager';
import {addCustomer} from '@/server/salon-actions';
export const dynamic='force-dynamic';
async function Customers({searchParams}:{searchParams:Promise<{q?:string}>}){
 const c=await requireOperations();const q=(await searchParams).q?.trim().slice(0,120)??'';
 const customers=await db.salonCustomer.findMany({where:{...customerScope(c),...(q?{AND:[{OR:[{displayName:{contains:q,mode:'insensitive' as const}},{phone:{contains:q}}]}]}:{})},orderBy:{displayName:'asc'},take:100,select:{id:true,displayName:true,phone:true,notes:true,_count:{select:{bookings:{where:{branchId:{in:c.branches.map(b=>b.id)}}}}}}});
 return <SalonShell active="customers"><PageHeading eyebrow="YOUR CUSTOMER BOOK" title="People behind every visit." description="Find, update and care for your customer relationships." action={<SidePanel label="+ Add customer" title="A new familiar face." description="Add their details now. Build the relationship with every visit."><ActionForm action={addCustomer} submit="Add customer"><div className="form-grid"><Field name="displayName" label="Full name"/><Field name="phone" label="Phone (optional)" type="tel" required={false}/></div><Select name="branchId" label="First location" options={c.branches}/><label className="field">Preferences &amp; notes<textarea name="notes" maxLength={2000}/></label></ActionForm></SidePanel>}/><ModuleTabs module="customers"/>
  <div className="studio-content customer-workspace"><div className="customer-toolbar"><CustomerSearch initialQuery={q}/><div className="customer-toolbar-count"><strong>{customers.length}</strong> customers shown <span>· Up to 100 results</span></div></div>
   <section className="customer-scroll customer-directory" aria-label="Customer directory"><div className="customer-directory-header"><span>Customer</span><span>Phone</span><span>Visits</span><span>Preferences</span><span>Manage</span></div>{customers.length?customers.map((x,index)=><article className="customer-directory-row" key={x.id}><div className="customer-person"><span className={`staff-avatar tone-${index%4}`}>{x.displayName.split(' ').map(n=>n[0]).slice(0,2).join('')}</span><div><Link href={`/salon/customers/profile/${x.id}`}>{x.displayName}</Link><small>Customer #{x.id.slice(0,6)}</small></div></div><div className="customer-phone">{x.phone?<a href={`tel:${x.phone}`}>{x.phone}</a>:<span className="muted">No phone added</span>}</div><span className="customer-visit-count">{x._count.bookings} <small>visits</small></span><p className="customer-row-notes">{x.notes||'No preferences yet'}</p><CustomerManager customer={x} administrator={c.administrator}/></article>):<Empty title="No customers found." description="Try another name or number, or add a new customer."/>}</section>
  </div>
 </SalonShell>;
}

export default measuredPage("customers",Customers);
