'use server';
import {invalidateServiceOptions} from '@/lib/operations/service-options';
import {invalidateSalonLayout} from '@/lib/salon/layout-data';
import {optionalCommissionRate} from '@/lib/salon/commission';
import {z} from 'zod';
import {db} from '@/lib/db';
import {perform,id,paise,businessRoles,requireRoles,audit,DomainError} from '@/lib/operations/shared';
import {serviceInput} from '@/lib/salon/validation';
import type {FormState} from './auth-actions';
export async function deleteService(_:FormState,f:FormData){return perform(async c=>{
 requireRoles(c,businessRoles,true);const serviceId=id(f);if(f.get('confirm')!=='on')throw new DomainError('Confirm removal of this service.');
 await db.$transaction(async tx=>{
  const row=await tx.service.updateMany({where:{id:serviceId,salonId:c.salonId,active:true},data:{active:false}});
  if(row.count!==1)throw new DomainError('This service is unavailable or has already been removed.');
  await audit(tx,c,'service.removed',serviceId,{archived:true});
 });invalidateServiceOptions(c.salonId);await invalidateSalonLayout(c.salonId);
});}
export async function editService(_:FormState,f:FormData){return perform(async c=>{requireRoles(c,businessRoles,true);const serviceId=id(f),input=serviceInput.parse({...Object.fromEntries(f),pricePaise:paise(f.get('priceRupees'))}),kind=z.enum(['service','package','addon']).parse(f.get('kind')),eligibleUserIds=[...new Set(z.array(z.uuid()).max(100).parse(f.getAll('eligibleUserIds')))];const checklist=String(f.get('checklist')??'').split('\n').map(v=>v.trim()).filter(Boolean);if(checklist.length>30||checklist.some(v=>v.length>160))throw new DomainError('Use up to 30 checklist steps, each under 160 characters.');await db.$transaction(async tx=>{if(eligibleUserIds.length&&await tx.salonMembership.count({where:{salonId:c.salonId,userId:{in:eligibleUserIds},role:{in:['owner','admin','manager','staff']},status:'active'}})!==eligibleUserIds.length)throw new DomainError('Choose active service team members.');const row=await tx.service.updateMany({where:{id:serviceId,salonId:c.salonId},data:{...input,kind,eligibleUserIds,checklist,active:f.get('active')==='on',commissionEligible:f.get('commissionEligible')==='on',commissionBps:optionalCommissionRate(f.get('commissionPercent'))}});if(row.count!==1)throw new DomainError('Service is unavailable.');await audit(tx,c,'service.updated',serviceId);});invalidateServiceOptions(c.salonId);await invalidateSalonLayout(c.salonId);});}
export async function editProduct(_:FormState,f:FormData){return perform(async c=>{requireRoles(c,['owner','admin','inventory'],true);const productId=id(f),name=z.string().trim().min(2).max(120).parse(f.get('name')),barcode=z.string().trim().max(80).parse(f.get('barcode')??'')||null,pricePaise=paise(f.get('priceRupees'));await db.$transaction(async tx=>{const row=await tx.product.updateMany({where:{id:productId,salonId:c.salonId},data:{name,barcode,pricePaise}});if(row.count!==1)throw new DomainError('Product is unavailable.');await audit(tx,c,'product.updated',productId);});});}
