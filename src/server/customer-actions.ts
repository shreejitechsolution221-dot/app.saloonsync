'use server';
import {db} from '@/lib/db';
import {customerScope} from '@/lib/operations/customer-scope';
import {perform,id,requireRoles,businessRoles,frontDeskRoles,DomainError,audit} from '@/lib/operations/shared';
import {customerInput} from '@/lib/salon/validation';
import type {FormState} from './auth-actions';
export async function editCustomer(_:FormState,form:FormData){return perform(async c=>{
 requireRoles(c,frontDeskRoles);const customerId=id(form);const input=customerInput.parse(Object.fromEntries(form));
 await db.$transaction(async tx=>{
  const row=await tx.salonCustomer.findFirst({where:{...customerScope(c,true),id:customerId},select:{id:true}});if(!row)throw new DomainError('This customer is unavailable in your workspace.');
  await tx.salonCustomer.update({where:{id:customerId},data:input});await audit(tx,c,'customer.updated',customerId);
 });
});}
export async function deleteCustomer(_:FormState,form:FormData){return perform(async c=>{
 requireRoles(c,businessRoles);const customerId=id(form);if(form.get('confirm')!=='on')throw new DomainError('Confirm customer deletion first.');
 await db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM app."SalonCustomer" WHERE id=${customerId}::uuid AND "salonId"=${c.salonId}::uuid FOR UPDATE`;
  const row=await tx.salonCustomer.findFirst({where:{...customerScope(c,true),id:customerId},select:{id:true}});if(!row)throw new DomainError('This customer is unavailable in your workspace.');
  const counts=await Promise.all([tx.appointment.count({where:{salonId:c.salonId,salonCustomerId:customerId}}),tx.loyaltyAccount.count({where:{salonId:c.salonId,customerId}}),tx.loyaltyEntry.count({where:{salonId:c.salonId,customerId}}),tx.messageJob.count({where:{salonId:c.salonId,customerId}}),tx.portfolioPhoto.count({where:{salonId:c.salonId,customerId}})]);
  if(counts.some(Boolean))throw new DomainError('This customer has visit, loyalty, message or photo history. Keep the record and edit their details instead.');
  await tx.salonCustomer.delete({where:{id:customerId}});await audit(tx,c,'customer.deleted',customerId);
 });
});}
