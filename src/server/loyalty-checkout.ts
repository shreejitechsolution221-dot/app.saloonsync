'use server';
import {randomBytes} from 'node:crypto';
import {z} from 'zod';
import {db} from '@/lib/db';
import {requireOperations} from '@/lib/salon/context';
import {perform,id,audit,DomainError} from '@/lib/operations/shared';
import {customerScope} from '@/lib/operations/customer-scope';
import {checkoutLoyalty,loyaltyHash} from '@/lib/operations/checkout';
import type {FormState} from './auth-actions';

export async function issueLoyaltyCode(_:FormState,form:FormData):Promise<FormState>{
 let code='';let points=0;
 const result=await perform(async c=>{
  await requireOperations(false,'customers');
  const customerId=id(form,'customerId');points=z.coerce.number().int().min(1).max(100000).parse(form.get('points'));
  code=randomBytes(8).toString('hex').toUpperCase();
  await db.$transaction(async tx=>{
   if(!await tx.salonCustomer.findFirst({where:{...customerScope(c,true),id:customerId}}))throw new DomainError('Customer is unavailable.');
   await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${c.salonId+customerId},4))::text`;
   const account=await tx.loyaltyAccount.findUnique({where:{salonId_customerId:{salonId:c.salonId,customerId}}});
   if(!account||account.points<points)throw new DomainError('This customer does not have enough points.');
   const row=await tx.loyaltyRedemption.create({data:{salonId:c.salonId,customerId,codeHash:loyaltyHash(code),points,expiresAt:new Date(Date.now()+24*60*60*1000)}});
   await audit(tx,c,'loyalty.code_issued',row.id,{customerId,points});
  });
 });
 return result.error?result:{message:`Redemption code: ${code} · ${points} points = ₹${points}. Valid for 24 hours, for this customer only. Points are deducted when a bill is saved.`};
}
export async function verifyLoyaltyCode(customerId:string,code:string):Promise<{error?:string;points?:number}>{
 let points=0;
 const result=await perform(async c=>{
  await requireOperations(false,'billing');
  z.uuid().parse(customerId);
  await db.$transaction(async tx=>{
   const customer=await tx.salonCustomer.findFirst({where:{...customerScope(c,true),id:customerId}});
   if(!customer)throw new DomainError('Customer is unavailable.');
   const row=await checkoutLoyalty(tx,c,customerId,z.string().trim().min(1).max(40).parse(code));
   points=row?.points??0;
  });
 },{paths:[],operation:'loyalty.verify-code'});
 return result.error?{error:result.error}:{points};
}
