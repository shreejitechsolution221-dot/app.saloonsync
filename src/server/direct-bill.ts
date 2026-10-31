'use server';
import {z} from 'zod';
import {db} from '@/lib/db';
import {checkoutCustomer,checkoutLoyalty,consumeCheckoutLoyalty} from '@/lib/operations/checkout';
import {requireOperations} from '@/lib/salon/context';
import {perform,branch,paise,getSettings,cashLock,audit,DomainError} from '@/lib/operations/shared';
import type {FormState} from './auth-actions';

export async function createDirectBill(_:FormState, form:FormData):Promise<FormState> {
 let invoiceId='';
 const result=await perform(async c=>{
  await requireOperations(false,'billing');
  const branchId=branch(form,c);
  const loyaltyCode=z.string().trim().max(40).parse(form.get('loyaltyCode')??'');
  const ids=z.array(z.uuid()).min(1).max(30).parse(form.getAll('serviceId'));
  const quantities=z.array(z.coerce.number().int().min(1).max(1000)).length(ids.length).parse(form.getAll('quantity'));
  const manualDiscount=paise(form.get('discountRupees')??'0');
  const rules=await getSettings(c);
  const method=z.enum(['unpaid','cash','upi','card','transfer']).parse(form.get('method'));
  await db.$transaction(async tx=>{
   const services=await tx.service.findMany({where:{id:{in:ids},salonId:c.salonId,active:true},select:{id:true,name:true,pricePaise:true}});
   const lines=ids.map((id,index)=>{const service=services.find(s=>s.id===id);if(!service)throw new DomainError('A selected service is unavailable.');return {description:service.name,quantity:quantities[index],unitPricePaise:service.pricePaise};});
   const customer=await checkoutCustomer(tx,c,form);
   const loyalty=await checkoutLoyalty(tx,c,customer.id,loyaltyCode);
   const basePaise=lines.reduce((sum,line)=>sum+line.quantity*line.unitPricePaise,0);
   const loyaltyPoints=loyalty?.points??0;
   const discountPaise=manualDiscount+loyaltyPoints*100;
   if(basePaise<=0||basePaise>100000000||discountPaise>basePaise)throw new DomainError('Enter a positive bill up to ₹10,00,000. Total discounts cannot exceed the subtotal.');
   if(!['owner','admin','accountant'].includes(c.membership.role)&&manualDiscount>Math.floor(basePaise*rules.discountLimitBps/10000))throw new DomainError('Discount exceeds your approved limit.');
   const taxPaise=Math.round((basePaise-discountPaise)*rules.taxBps/10000);
   const totalPaise=basePaise-discountPaise+taxPaise;
   if(method==='cash')await cashLock(tx,c.salonId,branchId);
   const invoice=await tx.invoice.create({data:{salonId:c.salonId,branchId,salonCustomerId:customer.id,customerName:customer.displayName,serviceName:lines.map(l=>l.description).join(' · '),basePaise,discountPaise,loyaltyPoints,taxBps:rules.taxBps,taxPaise,totalPaise}});
   invoiceId=invoice.id;
   await tx.invoiceLine.createMany({data:lines.map(line=>({...line,salonId:c.salonId,invoiceId:invoice.id}))});
   await consumeCheckoutLoyalty(tx,c,loyalty,invoice.id);
   if(method!=='unpaid'&&totalPaise>0){
    const payment=await tx.payment.create({data:{salonId:c.salonId,invoiceId:invoice.id,amountPaise:totalPaise,method}});
    await audit(tx,c,'payment.recorded',payment.id);
   }
   await audit(tx,c,'invoice.direct_created',invoice.id);
  });
 });
 return result.error?result:{message:'Walk-in bill created.',link:'/salon/billing/receipt/'+invoiceId};
}
