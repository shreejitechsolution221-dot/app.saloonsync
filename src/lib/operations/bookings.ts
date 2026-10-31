import 'server-only';
import {commissionRate} from '@/lib/salon/commission';
import {customerScope} from './customer-scope';
import {messageKey} from './calculations';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {db} from '@/lib/db';
import {settings,staffAt,DomainError,type Context} from './shared';
import type {Prisma} from '@/generated/prisma/client';
type VisitInput={branchId:string;salonCustomerId?:string;serviceId:string;assignedUserId:string;startsAt:Date;count:number;weeks:number;checkedIn?:boolean;walkIn?:{displayName:string;phone:string}};
export async function bookVisits(c:Context,input:VisitInput){
 return db.$transaction(tx=>bookVisit(tx,c,input),{timeout:15000});
}
export async function bookAppointmentGroup(c:Context,visits:VisitInput[]){
 if(!visits.length||visits.length>40)throw new DomainError('Choose between 1 and 40 services.');
 return db.$transaction(async tx=>{
  const ids:string[]=[];
  for(const visit of visits)ids.push(...await bookVisit(tx,c,visit));
  await tx.auditEvent.create({data:{salonId:c.salonId,actorUserId:c.user.id,action:'appointment.group_booked',targetType:'Appointment',targetId:ids[0],outcome:'allowed',metadata:{appointmentIds:ids}}});
  return ids;
 },{timeout:15000});
}
async function bookVisit(tx:Prisma.TransactionClient,c:Context,input:VisitInput){
 if(!c.operator||!c.branches.some(b=>b.id===input.branchId))throw new DomainError('Choose an accessible location.');
 const key=randomUUID();
  const [salon,service,staff]=await Promise.all([tx.salon.findUniqueOrThrow({where:{id:c.salonId},select:{settings:true}}),tx.service.findFirst({where:{id:input.serviceId,salonId:c.salonId,active:true}}),staffAt(tx,c,input.assignedUserId,input.branchId)]);
  if(!service)throw new DomainError('Service is unavailable.');const rules=settings(salon.settings);
  if(service.eligibleUserIds.length&&!service.eligibleUserIds.includes(staff.userId))throw new DomainError('This team member is not eligible for the selected service.');
  const known=input.walkIn?.phone?await tx.salonCustomer.findMany({where:{...customerScope(c,true),phone:input.walkIn.phone,displayName:{equals:input.walkIn.displayName,mode:'insensitive'}},take:2}):[];if(known.length>1)throw new DomainError('More than one matching customer exists. Choose the customer using New appointment.');const customer=input.walkIn?(known[0]??await tx.salonCustomer.create({data:{salonId:c.salonId,originBranchId:input.branchId,...input.walkIn}})):await tx.salonCustomer.findFirst({where:{...customerScope(c,true),id:input.salonCustomerId}});
  if(!customer)throw new DomainError('Choose a customer from this salon.');
  if(rules.noShowLimit>0&&await tx.appointment.count({where:{salonId:c.salonId,salonCustomerId:customer.id,status:'no_show',startsAt:{gte:new Date(Date.now()-90*86400000)}}})>=rules.noShowLimit)throw new DomainError('This customer has reached the salon’s no-show limit. Ask an administrator to review the booking policy.');
  const recipes=rules.automaticStockUsage?await tx.serviceProduct.findMany({where:{salonId:c.salonId,serviceId:service.id},select:{productId:true,quantity:true}}):[];
  const data=[];
  for(let index=0;index<input.count;index++){
   const startsAt=new Date(input.startsAt.getTime()+index*input.weeks*7*86400000),endsAt=new Date(startsAt.getTime()+service.durationMinutes*60000);
   if(startsAt.getTime()>Date.now()+366*86400000)throw new DomainError('The full series must fall within the next year.');
   const localStart=new Date(startsAt.getTime()+330*60000),localEnd=new Date(endsAt.getTime()+330*60000);
   if(localStart.getUTCHours()<rules.openingHour||(localEnd.getTime()-Date.UTC(localStart.getUTCFullYear(),localStart.getUTCMonth(),localStart.getUTCDate()))/60000>rules.closingHour*60)throw new DomainError('The full service must fit within the configured opening hours.');
   if(rules.requireShift&&!await tx.shift.findFirst({where:{salonId:c.salonId,branchId:input.branchId,userId:staff.userId,cancelledAt:null,startsAt:{lte:startsAt},endsAt:{gte:endsAt}}}))throw new DomainError('This booking must fit within an assigned staff shift.');
   data.push({id:randomUUID(),salonId:c.salonId,branchId:input.branchId,salonCustomerId:customer.id,customerUserId:customer.userId,assignedUserId:staff.userId,startsAt,status:input.walkIn||input.checkedIn?'checked_in':'confirmed',serviceName:service.name,durationMinutes:service.durationMinutes,pricePaise:service.pricePaise,commissionEligible:service.commissionEligible,commissionBps:service.commissionBps??null,checklist:service.checklist,stockRecipe:recipes,recurrenceKey:input.count>1?key:null});
  }
  await tx.appointment.createMany({data});
  if(rules.automatedMessages&&customer.whatsappConsentAt){const jobs=[{salonId:c.salonId,customerId:customer.id,appointmentId:data[0].id,kind:'confirmation',dedupeKey:messageKey(c.salonId,data[0].id,'confirmation')}];await tx.messageJob.createMany({data:jobs,skipDuplicates:true});const reminders=data.filter(v=>v.startsAt.getTime()-24*3600000>Date.now()).map(v=>({salonId:c.salonId,customerId:customer.id,appointmentId:v.id,kind:'reminder',dedupeKey:messageKey(c.salonId,v.id,'reminder'),nextAttemptAt:new Date(v.startsAt.getTime()-24*3600000)}));if(reminders.length)await tx.messageJob.createMany({data:reminders,skipDuplicates:true});}
  await tx.auditEvent.create({data:{salonId:c.salonId,actorUserId:c.user.id,action:input.walkIn||input.checkedIn?'appointment.walk_in':'appointment.booked',targetType:'Appointment',targetId:data[0].id,outcome:'allowed',metadata:{count:data.length,recurrenceKey:key}}});
  return data.map(v=>v.id);
}
export async function completionEffects(tx:Prisma.TransactionClient,c:{salonId:string;user:{id:string}},row:{id:string;salonId:string;branchId:string;assignedUserId:string|null;pricePaise:number;stockRecipe:Prisma.JsonValue;commissionEligible:boolean;commissionBps?:number|null;salonCustomerId:string|null}){
 const recipe=z.array(z.object({productId:z.uuid(),quantity:z.number().int().positive().max(10000)})).max(50).parse(row.stockRecipe);
 if(new Set(recipe.map(item=>item.productId)).size!==recipe.length)throw new DomainError('The booked service has a duplicate product recipe. Ask an administrator to review it.');
 if(recipe.length){
  await tx.$queryRaw`SELECT id FROM app."Product" WHERE "salonId"=${c.salonId}::uuid AND id=ANY(${recipe.map(item=>item.productId)}::uuid[]) ORDER BY id FOR UPDATE`;
  const updated=await tx.$queryRaw<{productId:string}[]>`UPDATE app."LocationStock" l SET stock=l.stock-v.quantity,"updatedAt"=clock_timestamp() FROM jsonb_to_recordset(${JSON.stringify(recipe)}::jsonb) AS v("productId" uuid,quantity integer) WHERE l."salonId"=${c.salonId}::uuid AND l."branchId"=${row.branchId}::uuid AND l."productId"=v."productId" AND l.stock>=v.quantity RETURNING l."productId"`;
  if(updated.length!==recipe.length)throw new DomainError('A configured service product has insufficient stock at this location. Replenish it before completing the visit.');
  await tx.stockMovement.createMany({data:recipe.map(item=>({salonId:c.salonId,branchId:row.branchId,productId:item.productId,appointmentId:row.id,actorUserId:c.user.id,quantity:-item.quantity,reason:'Service completed'}))});
 }
 const salon=await tx.salon.findUniqueOrThrow({where:{id:c.salonId},select:{settings:true}});if(settings(salon.settings).automatedMessages&&row.salonCustomerId){const customer=await tx.salonCustomer.findFirst({where:{id:row.salonCustomerId,salonId:c.salonId,whatsappConsentAt:{not:null}}});if(customer)await tx.messageJob.upsert({where:{dedupeKey:messageKey(c.salonId,row.id,'feedback')},create:{salonId:c.salonId,customerId:customer.id,appointmentId:row.id,kind:'feedback',dedupeKey:messageKey(c.salonId,row.id,'feedback')},update:{}});}
 if(row.commissionEligible&&row.assignedUserId){const profile=await tx.staffProfile.findFirst({where:{salonId:c.salonId,userId:row.assignedUserId,active:true}});const rate=commissionRate(row.commissionBps,profile?.commissionBps);if(rate>0)await tx.commissionEntry.create({data:{salonId:c.salonId,branchId:row.branchId,appointmentId:row.id,userId:row.assignedUserId,basePaise:row.pricePaise,rateBps:rate,amountPaise:Math.floor(row.pricePaise*rate/10000)}});}
}


