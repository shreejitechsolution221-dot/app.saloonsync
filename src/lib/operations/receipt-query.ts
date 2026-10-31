import 'server-only';
import {Prisma} from '@/generated/prisma/client';
import {db} from '@/lib/db';
import type {Context} from './shared';
type Payment={id:string;amountPaise:number;method:string;recordedAt:string};
type Refund={id:string;amountPaise:number;createdAt:string};
export type ReceiptRow={id:string;branchId:string|null;appointmentId:string|null;customerName:string;serviceName:string;basePaise:number;discountPaise:number;loyaltyPoints:number;taxBps:number;taxPaise:number;totalPaise:number;createdAt:Date;lines:{id:string;description:string;quantity:number;unitPricePaise:number}[];payments:Payment[];refunds:Refund[]};
export function receiptQuery(c:Context,id:string){return Prisma.sql`
 SELECT i.id,i."branchId",i."appointmentId",i."customerName",i."serviceName",i."basePaise",i."discountPaise",i."loyaltyPoints",i."taxBps",i."taxPaise",i."totalPaise",i."createdAt",
 coalesce((SELECT jsonb_agg(jsonb_build_object('id',l.id,'description',l.description,'quantity',l.quantity,'unitPricePaise',l."unitPricePaise") ORDER BY l."createdAt",l.id) FROM app."InvoiceLine" l WHERE l."salonId"=i."salonId" AND l."invoiceId"=i.id),'[]'::jsonb) AS lines,
 coalesce((SELECT jsonb_agg(jsonb_build_object('id',p.id,'amountPaise',p."amountPaise",'method',p.method,'recordedAt',p."recordedAt") ORDER BY p."recordedAt",p.id) FROM app."Payment" p WHERE p."salonId"=i."salonId" AND p."invoiceId"=i.id),'[]'::jsonb) AS payments,
 coalesce((SELECT jsonb_agg(jsonb_build_object('id',r.id,'amountPaise',r."amountPaise",'createdAt',r."createdAt") ORDER BY r."createdAt",r.id) FROM app."Refund" r WHERE r."salonId"=i."salonId" AND r."invoiceId"=i.id),'[]'::jsonb) AS refunds
 FROM app."Invoice" i WHERE i.id=${id}::uuid AND i."salonId"=${c.salonId}::uuid AND i."branchId"=ANY(${c.branches.map(b=>b.id)}::uuid[]) LIMIT 1`;
}
export async function receiptDocument(c:Context,id:string){const [row]=await db.$queryRaw<ReceiptRow[]>(receiptQuery(c,id));if(!row)return null;return {...row,payments:row.payments.map(p=>({...p,recordedAt:new Date(p.recordedAt)})),refunds:row.refunds.map(r=>({...r,createdAt:new Date(r.createdAt)}))};}
