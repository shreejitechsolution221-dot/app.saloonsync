import 'server-only';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import type {Prisma} from '@/generated/prisma/client';
import {customerScope} from './customer-scope';
import type {Context} from './shared';
import {DomainError} from './errors';
import {audit} from './audit';

export const loyaltyHash=(code:string)=>createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
export async function checkoutCustomer(tx:Prisma.TransactionClient,c:Context,form:FormData){
 const value=form.get('customerId');
 if(!value)return {id:null,displayName:z.string().trim().min(1).max(120).parse(form.get('customerName')??'Walk-in customer')};
 const id=z.uuid().parse(value);
 const customer=await tx.salonCustomer.findFirst({where:{...customerScope(c,true),id},select:{id:true,displayName:true}});
 if(!customer)throw new DomainError('Choose a customer you can access.');
 return customer;
}
export async function checkoutLoyalty(tx:Prisma.TransactionClient,c:Context,customerId:string|null,code:string){
 if(!code.trim())return null;
 if(!customerId)throw new DomainError('Select the customer before applying a loyalty code.');
 await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${c.salonId+customerId},4))::text`;
 const redemption=await tx.loyaltyRedemption.findFirst({where:{salonId:c.salonId,customerId,codeHash:loyaltyHash(code),redeemedAt:null,expiresAt:{gt:new Date()}}});
 if(!redemption)throw new DomainError('The loyalty code is invalid, expired, already used or belongs to another customer.');
 const account=await tx.loyaltyAccount.findUnique({where:{salonId_customerId:{salonId:c.salonId,customerId}}});
 if(!account||account.points<redemption.points)throw new DomainError('This customer no longer has enough loyalty points.');
 return redemption;
}
export async function consumeCheckoutLoyalty(tx:Prisma.TransactionClient,c:Context,redemption:{id:string;customerId:string;points:number}|null,invoiceId:string){
 if(!redemption)return;
 const used=await tx.loyaltyRedemption.updateMany({where:{id:redemption.id,salonId:c.salonId,redeemedAt:null,expiresAt:{gt:new Date()}},data:{redeemedAt:new Date(),invoiceId}});
 if(used.count!==1)throw new DomainError('This loyalty code is no longer available.');
 const balance=await tx.loyaltyAccount.updateMany({where:{salonId:c.salonId,customerId:redemption.customerId,points:{gte:redemption.points}},data:{points:{decrement:redemption.points}}});
 if(balance.count!==1)throw new DomainError('Insufficient loyalty points.');
 const entry=await tx.loyaltyEntry.create({data:{salonId:c.salonId,customerId:redemption.customerId,points:-redemption.points,reason:'Bill redemption · '+invoiceId,actorUserId:c.user.id}});
 await audit(tx,c,'loyalty.redeemed',entry.id,{invoiceId,points:redemption.points});
}
