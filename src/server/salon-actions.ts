'use server';
import {checkoutLoyalty,consumeCheckoutLoyalty} from '@/lib/operations/checkout';
import {saveError} from '@/lib/operations/save-error';
import {invalidateServiceOptions} from '@/lib/operations/service-options';
import {invalidateSalonLayout} from '@/lib/salon/layout-data';
import {optionalCommissionRate} from '@/lib/salon/commission';
import {bookVisits,bookAppointmentGroup,completionEffects} from '@/lib/operations/bookings';
import {completeTimedService,completeDueServices} from '@/lib/operations/timed-services';
import {earliestServiceStart,serviceStartMessage} from '@/lib/salon/booking-time';
import {settings,cashLock,DomainError,localTime,branch} from '@/lib/operations/shared';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { requireSameOrigin, rateLimit } from '@/lib/security';
import { requireOperations, salonContext, requireModule } from '@/lib/salon/context';
import { bookingInput,customerInput,serviceInput,productInput,transitions } from '@/lib/salon/validation';
import type { FormState } from './auth-actions';
import type { Prisma } from '@/generated/prisma/client';
async function audit(tx:Prisma.TransactionClient,userId:string,salonId:string,action:string,targetId:string) {
 await tx.auditEvent.create({data:{actorUserId:userId,salonId,action,targetType:action.split('.')[0],targetId,outcome:'allowed'}});
}
function rupees(value:FormDataEntryValue|null) { const v=z.string().regex(/^\d{1,7}(\.\d{1,2})?$/).parse(value); return Math.round(Number(v)*100); }
async function mutation(work:()=>Promise<void>):Promise<FormState> {
 try { await requireSameOrigin(); await work(); revalidatePath('/salon','layout'); return {message:'Saved successfully.'}; }
 catch(error) { return {error:saveError(error,'salon.write')}; }
}
export async function addCustomer(_:FormState,form:FormData) {
 let customer:{id:string;displayName:string}|undefined;
 const result=await mutation(async()=>{
 const c=await requireOperations(); const input=customerInput.parse(Object.fromEntries(form)); await rateLimit('customer-create',c.user.id,60);
 customer=await db.$transaction(async tx=>{const row=await tx.salonCustomer.create({data:{...input,salonId:c.salonId,originBranchId:branch(form,c)}});await audit(tx,c.user.id,c.salonId,'customer.created',row.id);return {id:row.id,displayName:row.displayName};});
 });
 return result.error?result:{...result,customer};
}
export async function addService(_:FormState,form:FormData) {return mutation(async()=>{
 const c=await requireOperations(true); const input=serviceInput.parse({...Object.fromEntries(form),pricePaise:rupees(form.get('priceRupees'))});
 await db.$transaction(async tx=>{const checklist=String(form.get('checklist')??'').split('\n').map(v=>v.trim()).filter(Boolean).slice(0,30);if(checklist.some(v=>v.length>160))throw new DomainError('Keep checklist steps under 160 characters.');const eligibleUserIds=z.array(z.uuid()).max(100).parse(form.getAll('eligibleUserIds'));if(eligibleUserIds.length&&await tx.salonMembership.count({where:{salonId:c.salonId,userId:{in:eligibleUserIds},status:'active'}})!==new Set(eligibleUserIds).size)throw new Error('Invalid eligibility');const row=await tx.service.create({data:{...input,salonId:c.salonId,kind:z.enum(['service','package','addon']).parse(form.get('kind')??'service'),checklist,eligibleUserIds,commissionEligible:form.get('commissionEligible')==='on',commissionBps:optionalCommissionRate(form.get('commissionPercent'))}});await audit(tx,c.user.id,c.salonId,'service.created',row.id);});invalidateServiceOptions(c.salonId);await invalidateSalonLayout(c.salonId);
});}
export async function addProduct(_:FormState,form:FormData) {return mutation(async()=>{
 const c=await requireOperations(true,'inventory');if(c.membership.branchScope!=='all')throw new DomainError('The shared catalog is managed by an all-location administrator.'); const input=productInput.parse({...Object.fromEntries(form),pricePaise:rupees(form.get('priceRupees'))});
 await db.$transaction(async tx=>{const branchId=branch(form,c);const row=await tx.product.create({data:{...input,stock:0,salonId:c.salonId,barcode:z.string().trim().max(80).parse(form.get('barcode')??'')||null,costPaise:form.get('costRupees')?rupees(form.get('costRupees')):0}});await tx.locationStock.create({data:{salonId:c.salonId,branchId,productId:row.id,stock:input.stock}});if(input.stock)await tx.stockMovement.create({data:{salonId:c.salonId,branchId,productId:row.id,actorUserId:c.user.id,quantity:input.stock,reason:'Opening stock'}});await audit(tx,c.user.id,c.salonId,'product.created',row.id);});
});}
export async function adjustStock(_:FormState,form:FormData) {return mutation(async()=>{
 const c=await requireOperations(true,'inventory');const id=z.uuid().parse(form.get('id'));const delta=z.coerce.number().int().min(-100000).max(100000).refine(v=>v!==0).parse(form.get('delta'));const reason=z.string().trim().min(3).max(200).parse(form.get('reason'));
 await db.$transaction(async tx=>{const branchId=branch(form,c);await tx.$queryRaw`SELECT id FROM app."Product" WHERE id=${id}::uuid AND "salonId"=${c.salonId}::uuid FOR UPDATE`;if(delta>0){if(!await tx.product.findFirst({where:{id,salonId:c.salonId}}))throw new Error('Unknown product');await tx.locationStock.upsert({where:{salonId_branchId_productId:{salonId:c.salonId,branchId,productId:id}},create:{salonId:c.salonId,branchId,productId:id,stock:delta},update:{stock:{increment:delta}}});}else{const result=await tx.locationStock.updateMany({where:{salonId:c.salonId,branchId,productId:id,stock:{gte:-delta}},data:{stock:{increment:delta}}});if(result.count!==1)throw new DomainError('This location has insufficient stock.');}await tx.stockMovement.create({data:{salonId:c.salonId,branchId,productId:id,actorUserId:c.user.id,quantity:delta,reason}});await tx.auditEvent.create({data:{actorUserId:c.user.id,salonId:c.salonId,action:'product.stock_adjusted',targetType:'Product',targetId:id,outcome:'allowed',metadata:{delta,reason}}});});
});}
export async function createAppointment(_:FormState,form:FormData) {return mutation(async()=>{
 const c=await salonContext();if(!c.operator)throw new Error('Forbidden');const input=bookingInput.parse(Object.fromEntries(form));
 if(!c.branches.some(b=>b.id===input.branchId))throw new Error('Forbidden');
 const startsAt=localTime(input.startsAt);if(!Number.isFinite(startsAt.getTime())||startsAt<new Date()||startsAt.getTime()>Date.now()+366*86400000)throw new Error('Invalid date');
 await rateLimit('booking-create',c.user.id,60);
 const count=z.coerce.number().int().min(1).max(12).parse(form.get('recurrenceCount')??1),weeks=z.coerce.number().int().min(1).max(12).parse(form.get('recurrenceWeeks')??1);
 await bookVisits(c,{...input,startsAt,count,weeks});
});}
export async function createGroupAppointment(_:FormState,form:FormData){return saveAppointmentGroup(form);}
export async function createGroupWalkIn(_:FormState,form:FormData){return saveAppointmentGroup(form,true);}
async function saveAppointmentGroup(form:FormData,walkIn=false){return mutation(async()=>{
 const c=await requireModule('appointments');if(!c.operator)throw new DomainError('You cannot create appointments.');
 await rateLimit('booking-create',c.user.id,60);
 const people=z.coerce.number().int().min(1).max(10).parse(form.get('personCount'));
 const count=walkIn?1:z.coerce.number().int().min(1).max(12).parse(form.get('recurrenceCount')??1);
 const walkInStart=new Date((Math.floor(Date.now()/60000)+1)*60000);
 const visits=[];
 for(let person=0;person<people;person++){
  const prefix=`person.${person}.`;
  const salonCustomerId=z.uuid().parse(form.get(prefix+'salonCustomerId'));
  const serviceIds=z.array(z.uuid()).min(1).max(10).parse(form.getAll(prefix+'serviceId'));
  if(new Set(serviceIds).size!==serviceIds.length)throw new DomainError('Choose each service once per person.');
  const assignedUserId=z.uuid().parse(form.get(prefix+'assignedUserId'));
  const branchId=z.uuid().parse(form.get(prefix+'branchId'));
  let startsAt=walkIn?walkInStart:localTime(form.get(prefix+'startsAt'));
  if(startsAt<new Date()||startsAt.getTime()>Date.now()+366*86400000)throw new DomainError('Choose a future time within the next year.');
  const services=await db.service.findMany({where:{salonId:c.salonId,active:true,id:{in:serviceIds}},select:{id:true,durationMinutes:true}});
  if(services.length!==serviceIds.length)throw new DomainError('A selected service is unavailable.');
  for(const serviceId of serviceIds){
   visits.push({salonCustomerId,serviceId,assignedUserId,branchId,startsAt,count,weeks:1,...(walkIn?{checkedIn:true}:{})});
   startsAt=new Date(startsAt.getTime()+services.find(s=>s.id===serviceId)!.durationMinutes*60000);
  }
 }
 if(visits.length>40)throw new DomainError('Choose up to 40 services per booking.');
 await bookAppointmentGroup(c,visits);
});}
export async function changeAppointment(_:FormState,form:FormData) {
 let serviceStartedAt:string|undefined;
 const saved=await mutation(async()=>{
 const c=await requireModule('appointments');const id=z.uuid().parse(form.get('id'));const status=z.enum(['checked_in','in_service','completed','cancelled','no_show']).parse(form.get('status'));
 await db.$transaction(async tx=>{
 const row=await tx.appointment.findFirst({where:{id,salonId:c.salonId,branchId:{in:c.branches.map(b=>b.id)},...(!c.operator?{assignedUserId:c.user.id}:{})}});
 if(!row)throw new DomainError('This appointment is no longer available in your workspace. Refresh the calendar.');
 if(!c.operator&&!['in_service','completed'].includes(status))throw new DomainError('Your role cannot make this appointment change.');
 if(!transitions[row.status]?.includes(status))throw new DomainError(status==='in_service'&&row.status==='confirmed'?'Check in the appointment before starting the service.':`This appointment is ${row.status.replaceAll('_',' ')}. Refresh the calendar to see its available actions.`);
 if(status==='in_service'&&Date.now()<earliestServiceStart(row.startsAt))throw new DomainError(serviceStartMessage(row.startsAt));
 if(status==='completed'&&row.checklist.some((_,index)=>!row.completedSteps.includes(index)))throw new DomainError('Complete all service checklist steps before completing this appointment. Open the full visit to review them.');
 const result=await tx.appointment.updateMany({where:{id,salonId:c.salonId,status:row.status},data:{status}});if(result.count!==1)throw new Error('Booking changed');if(status==='completed')await completionEffects(tx,c,row);
 if(status==='in_service'){const now=new Date();serviceStartedAt=now.toISOString();await tx.auditEvent.create({data:{actorUserId:c.user.id,salonId:c.salonId,action:'appointment.in_service',targetType:'appointment',targetId:id,outcome:'allowed',occurredAt:now}});}else await audit(tx,c.user.id,c.salonId,'appointment.'+status,id);
 },{timeout:15000});
 });return saved.error?saved:{...saved,serviceStartedAt};
}
export async function completeServiceTimer(_:FormState,form:FormData){
 let completed=false;
 const saved=await mutation(async()=>{const c=await requireModule('appointments');const id=z.uuid().parse(form.get('id'));await rateLimit('service-timer',c.user.id,120);completed=await completeTimedService(id,c);});
 return {...saved,completed:!saved.error&&completed};
}
export async function refreshServiceTimers(){
 await requireSameOrigin();const c=await requireModule('appointments');await rateLimit('service-timer-refresh',c.user.id,120);
 const result=await completeDueServices(c);if(result.completed)revalidatePath('/salon','layout');return result;
}
export async function createInvoice(_:FormState,form:FormData) {return mutation(async()=>{
 const c=await requireOperations(false,'billing');const id=z.uuid().parse(form.get('id'));
 const discountPaise=form.get('discountRupees')?rupees(form.get('discountRupees')):0;
 const offerCode=String(form.get('offerCode')??'').trim().toUpperCase();
 const loyaltyCode=z.string().trim().max(40).parse(form.get('loyaltyCode')??'');const method=z.enum(['unpaid','cash','upi','card','transfer']).parse(form.get('method')??'unpaid');
 await db.$transaction(async tx=>{
 const [booking,salon]=await Promise.all([tx.appointment.findFirst({where:{id,salonId:c.salonId,branchId:{in:c.branches.map(b=>b.id)},status:'completed'},include:{customer:{select:{displayName:true}},salonCustomer:{select:{displayName:true}}}}),tx.salon.findUniqueOrThrow({where:{id:c.salonId},select:{settings:true}})]);
 if(!booking)throw new DomainError('Complete the visit before creating an invoice.');const rules=settings(salon.settings);let discount=discountPaise;
 if(offerCode){const offer=await tx.offer.findFirst({where:{salonId:c.salonId,code:offerCode,active:true,expiresAt:{gt:new Date()}}});if(!offer)throw new DomainError('Offer is invalid or expired.');discount+=offer.kind==='fixed'?offer.value:Math.floor(booking.pricePaise*offer.value/10000);}
 if(discount>booking.pricePaise||(!['owner','admin','accountant'].includes(c.membership.role)&&discount>Math.floor(booking.pricePaise*rules.discountLimitBps/10000)))throw new DomainError('Discount exceeds your approved limit.');
 const loyalty=await checkoutLoyalty(tx,c,booking.salonCustomerId,loyaltyCode);const loyaltyPoints=loyalty?.points??0;discount+=loyaltyPoints*100;if(discount>booking.pricePaise)throw new DomainError('Total discounts cannot exceed the service price.');
 const taxPaise=Math.round((booking.pricePaise-discount)*rules.taxBps/10000);
 if(method==='cash')await cashLock(tx,c.salonId,booking.branchId);
 const row=await tx.invoice.create({data:{salonId:c.salonId,branchId:booking.branchId,appointmentId:id,salonCustomerId:booking.salonCustomerId,loyaltyPoints,customerName:booking.salonCustomer?.displayName??booking.customer?.displayName??'Customer',serviceName:booking.serviceName,basePaise:booking.pricePaise,discountPaise:discount,taxBps:rules.taxBps,taxPaise,totalPaise:booking.pricePaise-discount+taxPaise}});
 await tx.invoiceLine.create({data:{salonId:c.salonId,invoiceId:row.id,description:booking.serviceName,quantity:1,unitPricePaise:booking.pricePaise}});await consumeCheckoutLoyalty(tx,c,loyalty,row.id);if(method!=='unpaid'&&row.totalPaise>0){const payment=await tx.payment.create({data:{salonId:c.salonId,invoiceId:row.id,amountPaise:row.totalPaise,method}});await audit(tx,c.user.id,c.salonId,'payment.recorded',payment.id);}await audit(tx,c.user.id,c.salonId,'invoice.created',row.id);
 });
});}
export async function recordPayment(_:FormState,form:FormData) {return mutation(async()=>{
 const c=await requireOperations(false,'billing');const invoiceId=z.uuid().parse(form.get('invoiceId'));const amountPaise=z.coerce.number().int().positive().max(100000000).parse(rupees(form.get('amountRupees')));const method=z.enum(['cash','upi','card','transfer']).parse(form.get('method'));
 await db.$transaction(async tx=>{const invoice=await tx.invoice.findFirst({where:{id:invoiceId,salonId:c.salonId,branchId:{in:c.branches.map(b=>b.id)}}});if(!invoice)throw new DomainError('This invoice is unavailable in the selected location. Refresh Billing and try again.');if(method==='cash'&&invoice.branchId)await cashLock(tx,c.salonId,invoice.branchId);const row=await tx.payment.create({data:{salonId:c.salonId,invoiceId,amountPaise,method}});await audit(tx,c.user.id,c.salonId,'payment.recorded',row.id);});
});}
export async function updateSalon(_:FormState,form:FormData) {return mutation(async()=>{
 const c=await requireOperations(true);const name=z.string().trim().min(2).max(120).parse(form.get('name'));
 await db.$transaction(async tx=>{await tx.salon.update({where:{id:c.salonId},data:{name}});await audit(tx,c.user.id,c.salonId,'salon.updated',c.salonId);});
 await invalidateSalonLayout(c.salonId);
});}
export async function rescheduleAppointment(_:FormState,form:FormData) {return mutation(async()=>{
 const c=await requireModule('appointments');if(!c.operator)throw new Error('Forbidden');const id=z.uuid().parse(form.get('id'));const local=z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/).parse(form.get('startsAt'));const startsAt=localTime(local);
 if(!Number.isFinite(startsAt.getTime())||startsAt<new Date()||startsAt.getTime()>Date.now()+366*86400000)throw new Error('Invalid date');
 await db.$transaction(async tx=>{const row=await tx.appointment.findFirst({where:{id,salonId:c.salonId,branchId:{in:c.branches.map(b=>b.id)},status:{in:['confirmed','checked_in']}}});if(!row)throw new Error('Visit cannot be rescheduled');const result=await tx.appointment.updateMany({where:{id,salonId:c.salonId,status:row.status,startsAt:row.startsAt},data:{startsAt}});if(result.count!==1)throw new Error('Visit changed');await tx.messageJob.updateMany({where:{salonId:c.salonId,appointmentId:id,kind:'reminder',status:{in:['queued','configuration_required']}},data:{nextAttemptAt:new Date(Math.max(Date.now(),startsAt.getTime()-24*3600000))}});await audit(tx,c.user.id,c.salonId,'appointment.rescheduled',id);});
});}

