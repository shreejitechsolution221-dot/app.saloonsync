'use server';
import {z} from 'zod';
import {db} from '@/lib/db';
import {perform,paise,branch,requireRoles,getSettings,audit,cashLock,DomainError} from '@/lib/operations/shared';
import {checkoutCustomer,checkoutLoyalty,consumeCheckoutLoyalty} from '@/lib/operations/checkout';
import type {FormState} from './auth-actions';
export async function retailSale(_:FormState,f:FormData):Promise<FormState>{
 let invoiceId='';
 const result=await perform(async c=>{
  requireRoles(c,['owner','admin','manager','receptionist','accountant','cashier']);
  const branchId=branch(f,c),ids=z.array(z.uuid()).min(1).max(30).parse(f.getAll('productId'));
  const quantities=z.array(z.coerce.number().int().min(1).max(1000)).length(ids.length).parse(f.getAll('quantity'));
  const manualDiscount=paise(f.get('discountRupees')??'0');
  const method=z.enum(['unpaid','cash','upi','card','transfer']).parse(f.get('method')??'unpaid');
  const code=z.string().trim().max(40).parse(f.get('loyaltyCode')??'');
  const rules=await getSettings(c);
  await db.$transaction(async tx=>{
   const customer=await checkoutCustomer(tx,c,f);
   const loyalty=await checkoutLoyalty(tx,c,customer.id,code);
   const productIds=[...new Set(ids)].sort();
   for(const productId of productIds)await tx.$queryRaw`SELECT id FROM app."Product" WHERE id=${productId}::uuid AND "salonId"=${c.salonId}::uuid FOR UPDATE`;
   const products=await tx.product.findMany({where:{id:{in:productIds},salonId:c.salonId}});
   const lines=ids.map((productId,index)=>{const product=products.find(p=>p.id===productId);if(!product)throw new DomainError('A selected product is unavailable.');return {productId,description:product.name,quantity:quantities[index],unitPricePaise:product.pricePaise,unitCostPaise:product.costPaise};});
   const basePaise=lines.reduce((n,l)=>n+l.quantity*l.unitPricePaise,0);
   const loyaltyPoints=loyalty?.points??0,discountPaise=manualDiscount+loyaltyPoints*100;
   if(basePaise<=0||basePaise>100000000||discountPaise>basePaise)throw new DomainError('Sale total or discount exceeds the allowed amount.');
   if(!['owner','admin','accountant'].includes(c.membership.role)&&manualDiscount>Math.floor(basePaise*rules.discountLimitBps/10000))throw new DomainError('Discount exceeds your approved limit.');
   const taxPaise=Math.round((basePaise-discountPaise)*rules.taxBps/10000),totalPaise=basePaise-discountPaise+taxPaise;
   if(method==='cash')await cashLock(tx,c.salonId,branchId);
   const invoice=await tx.invoice.create({data:{salonId:c.salonId,branchId,salonCustomerId:customer.id,customerName:customer.displayName,serviceName:'Retail · '+lines.map(l=>l.description).join(' · '),basePaise,discountPaise,loyaltyPoints,taxBps:rules.taxBps,taxPaise,totalPaise}});
   invoiceId=invoice.id;
   await tx.invoiceLine.createMany({data:lines.map(line=>({...line,salonId:c.salonId,invoiceId}))});
   for(const productId of productIds){
    const quantity=lines.filter(l=>l.productId===productId).reduce((n,l)=>n+l.quantity,0);
    const balance=await tx.locationStock.updateMany({where:{salonId:c.salonId,branchId,productId,stock:{gte:quantity}},data:{stock:{decrement:quantity}}});
    if(balance.count!==1)throw new DomainError('The selected location has insufficient stock.');
    await tx.stockMovement.create({data:{salonId:c.salonId,branchId,productId,actorUserId:c.user.id,quantity:-quantity,reason:'Retail sale · '+invoiceId.slice(0,8)}});
   }
   await consumeCheckoutLoyalty(tx,c,loyalty,invoiceId);
   if(method!=='unpaid'&&totalPaise>0){const payment=await tx.payment.create({data:{salonId:c.salonId,invoiceId,amountPaise:totalPaise,method}});await audit(tx,c,'payment.recorded',payment.id);}
   await audit(tx,c,'retail.invoiced',invoiceId);
  });
 });
 return result.error?result:{message:'Product invoice created.',link:'/salon/billing/receipt/'+invoiceId};
}
