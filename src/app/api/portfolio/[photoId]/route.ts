import {customerScope} from '@/lib/operations/customer-scope';
import {NextResponse} from 'next/server';
import {z} from 'zod';
import {canModule} from '@/lib/salon/modules';
import {salonContext} from '@/lib/salon/context';
import {db} from '@/lib/db';
import {privateStorage,verifyPrivateBucket} from '@/lib/operations/private-storage';
export async function GET(_request:Request,{params}:{params:Promise<{photoId:string}>}){
 try{const photoId=z.uuid().parse((await params).photoId),c=await salonContext();const photo=await db.portfolioPhoto.findFirst({where:{id:photoId,salonId:c.salonId}});if(!photo)throw new Error('Unavailable');
 const customer=await db.salonCustomer.findFirst({where:{...customerScope(c,true),id:photo.customerId,photoConsentAt:{not:null}}});if(!customer)throw new Error('Consent required');
 if(!canModule(c.membership.role,'appointments'))throw new Error('Forbidden');const allowed=c.operator||await db.appointment.findFirst({where:{salonId:c.salonId,salonCustomerId:photo.customerId,assignedUserId:c.user.id,branchId:{in:c.branches.map(b=>b.id)}},select:{id:true}});if(!allowed)throw new Error('Forbidden');
 const storage=privateStorage();await verifyPrivateBucket(storage);const {data,error}=await storage.client.storage.from(storage.bucket).createSignedUrl(photo.objectPath,60);if(error||!data)throw new Error('Storage unavailable');return NextResponse.redirect(data.signedUrl,{headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}});
 }catch{return NextResponse.json({error:'Photo unavailable'},{status:403,headers:{'Cache-Control':'private, no-store'}});}
}
