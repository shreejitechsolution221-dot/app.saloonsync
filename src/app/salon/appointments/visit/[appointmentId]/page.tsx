import Link from 'next/link';
import {VisitPortfolio} from '@/components/operations/visit-portfolio';
import {notFound} from 'next/navigation';
import {z} from 'zod';
import {db} from '@/lib/db';
import {requireModule} from '@/lib/salon/context';
import {appointmentBackUrl} from '@/lib/salon/appointment-navigation';
import {SalonShell,PageHeading} from '@/components/salon/shell';
import {ActionForm} from '@/components/salon/forms';
import {VisitStatusActions} from '@/components/salon/visit-status-actions';
import {ServiceTimerRefresh} from '@/components/salon/service-timer-refresh';
import {completeServiceStep} from '@/server/visit-actions';
export default async function Visit({params,searchParams}:{params:Promise<{appointmentId:string}>;searchParams:Promise<{returnTo?:string}>}){
 const c=await requireModule('appointments');const parsed=z.uuid().safeParse((await params).appointmentId);if(!parsed.success)notFound();
 const row=await db.appointment.findFirst({where:{id:parsed.data,salonId:c.salonId,branchId:{in:c.branches.map(b=>b.id)},...(c.operator?{}:{assignedUserId:c.user.id})},include:{salonCustomer:{select:{id:true,displayName:true,notes:true,phone:true,photoConsentAt:true}},customer:{select:{displayName:true}},branch:{select:{name:true}},assignedMembership:{select:{user:{select:{displayName:true}}}}}});if(!row)notFound();
 const query=await searchParams;
 const back=appointmentBackUrl(row.id,row.startsAt,query.returnTo);
 const customer=row.salonCustomer?.displayName??row.customer?.displayName??'Salon visit';
 const done=row.checklist.filter((_,index)=>row.completedSteps.includes(index)).length;
 const canWork=['checked_in','in_service'].includes(row.status);
 return <SalonShell active="appointments">
  {row.status==='in_service'&&<ServiceTimerRefresh/>}
  <PageHeading eyebrow="VISIT DETAILS" title={customer} description="Everything your team needs for this visit." action={<Link className="secondary visit-back" href={back} prefetch={false}>← Back to appointment</Link>}/>
  <div className="studio-content visit-workspace">
   <section className="studio-panel visit-hero" aria-label="Visit summary"><div><div className="visit-hero-meta"><span className={`state-pill ${row.status}`}>{row.status.replaceAll('_',' ')}</span><span>Visit #{row.id.slice(0,8)}</span></div><h2>{row.serviceName}</h2><p className="visit-scheduled">{row.startsAt.toLocaleDateString('en-IN',{timeZone:'Asia/Kolkata',weekday:'long',day:'numeric',month:'long',year:'numeric'})} · {row.startsAt.toLocaleTimeString('en-IN',{timeZone:'Asia/Kolkata',hour:'2-digit',minute:'2-digit'})} IST</p><dl className="visit-summary-grid"><div><dt>Team member</dt><dd>{row.assignedMembership?.user.displayName??'Unassigned'}</dd></div><div><dt>Branch</dt><dd>{row.branch.name}</dd></div><div><dt>Duration</dt><dd>{row.durationMinutes} min</dd></div><div><dt>Service price</dt><dd>{new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format(row.pricePaise/100)}</dd></div></dl></div><div className="visit-hero-actions"><h3>Manage this visit</h3><VisitStatusActions id={row.id} status={row.status} startsAt={row.startsAt.toISOString()} operator={c.operator}/>{row.status==='in_service'&&<p className="hint">The service timer is running. Completion is automatic when its duration ends and all checklist steps are done, or you can complete it above.</p>}</div></section>
   <div className="visit-detail-columns">
    <section className="studio-panel visit-checklist"><div className="visit-panel-heading"><div><p className="eyebrow">SERVICE WORKFLOW</p><h2>Service checklist</h2></div><span className="visit-progress-label">{done} / {row.checklist.length} complete</span></div>{row.checklist.length>0?<><progress className="visit-progress" aria-label="Service checklist progress" value={done} max={row.checklist.length}/><ol className="visit-step-list">{row.checklist.map((step,index)=>{const completed=row.completedSteps.includes(index);return <li key={index} className={completed?'is-done':''}><span className="visit-step-number" aria-hidden="true">{completed?'✓':index+1}</span><div><strong>{step}</strong><small>{completed?'Completed':canWork?'Ready to complete':'Pending'}</small></div>{completed?<span className="state-pill completed">Done</span>:canWork?<ActionForm action={completeServiceStep} submit="Mark done"><input type="hidden" name="appointmentId" value={row.id}/><input type="hidden" name="step" value={index}/></ActionForm>:null}</li>;})}</ol></>:<div className="visit-checklist-empty"><span aria-hidden="true">✓</span><h3>No checklist needed</h3><p>This service has no configured steps. Use the visit actions above when the service is finished.</p></div>}<p className="visit-panel-note">Complete each configured step before finishing the service.</p></section>
    <aside className="studio-panel visit-customer-notes"><p className="eyebrow">PERSONAL TOUCHES</p><h2>Customer &amp; preferences</h2><div className="visit-customer-card"><span className="staff-avatar tone-0">{customer.split(' ').map(n=>n[0]).slice(0,2).join('')}</span><div><strong>{customer}</strong>{row.salonCustomer?.phone?<a href={`tel:${row.salonCustomer.phone}`}>{row.salonCustomer.phone}</a>:<small>No phone number recorded</small>}</div></div><h3>Preferences &amp; service notes</h3><p className="visit-notes-copy">{row.salonCustomer?.notes||'No preferences recorded yet.'}</p><div className="visit-care-note">Service completion records configured stock usage and eligible commission together.</div></aside>
   </div>
   {row.salonCustomer&&<details className="visit-portfolio-section"><summary>Service photos &amp; portfolio <span>View photos and add service records</span></summary><VisitPortfolio customerId={row.salonCustomer.id} consented={Boolean(row.salonCustomer.photoConsentAt)}/></details>}
  </div>
 </SalonShell>;
}
