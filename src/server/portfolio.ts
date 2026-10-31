'use server';
import {customerScope} from '@/lib/operations/customer-scope';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {db} from '@/lib/db';
import {perform,id,audit,DomainError,requireRoles} from '@/lib/operations/shared';
import {privateStorage,verifyPrivateBucket,preparePrivateImage} from '@/lib/operations/private-storage';
import type {FormState} from './auth-actions';
export async function uploadPortfolio(_:FormState,f:FormData){return perform(async c=>{
 requireRoles(c,['owner','admin','manager','receptionist','staff']);const customerId=id(f,'customerId'),kind=z.enum(['before','after']).parse(f.get('kind')),caption=z.string().trim().max(300).parse(f.get('caption')??'');
 const customer=await db.salonCustomer.findFirst({where:{...customerScope(c,true),id:customerId,photoConsentAt:{not:null}}});
 if(!customer||(!c.operator&&!await db.appointment.findFirst({where:{salonId:c.salonId,salonCustomerId:customerId,assignedUserId:c.user.id,branchId:{in:c.branches.map(b=>b.id)}}})))throw new DomainError('Customer consent and authorized care access are required.');
 const file=f.get('photo');if(!(file instanceof File))throw new DomainError('Choose a photo.');
 const buffer=await preparePrivateImage(file),storage=privateStorage(),objectPath=`${c.salonId}/customers/${customerId}/${randomUUID()}.jpg`;
 await verifyPrivateBucket(storage);const {error}=await storage.client.storage.from(storage.bucket).upload(objectPath,buffer,{contentType:'image/jpeg',cacheControl:'0',upsert:false});if(error)throw new DomainError('Private upload failed. Check the configured private bucket.');
 try{await db.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM app."SalonCustomer" WHERE id=${customerId}::uuid AND "salonId"=${c.salonId}::uuid FOR UPDATE`;const current=await tx.salonCustomer.findFirst({where:{...customerScope(c,true),id:customerId,photoConsentAt:{not:null}}});if(!current?.photoConsentAt)throw new DomainError('Photo consent has been withdrawn.');const row=await tx.portfolioPhoto.create({data:{salonId:c.salonId,customerId,objectPath,kind,caption,consentedAt:current.photoConsentAt,uploadedBy:c.user.id}});await audit(tx,c,'portfolio.uploaded',row.id);});}
 catch(error){await storage.client.storage.from(storage.bucket).remove([objectPath]);throw error;}
});}
