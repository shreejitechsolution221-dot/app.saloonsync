import 'server-only';
import {db} from '@/lib/db';
import type {Context} from './shared';
export type LocationProduct={id:string;name:string;sku:string;barcode:string|null;pricePaise:number;costPaise:number;reorderAt:number;stock:number;globalStock:number};
export async function locationProducts(c:Context,q='',limit=200,availableOnly=false){return db.$queryRaw<LocationProduct[]>`SELECT p.id,p.name,p.sku,p.barcode,p."pricePaise",p."costPaise",p."reorderAt",p.stock AS "globalStock",coalesce(sum(l.stock),0)::int AS stock FROM app."Product" p LEFT JOIN app."LocationStock" l ON l."productId"=p.id AND l."salonId"=p."salonId" AND l."branchId"=ANY(${c.branches.map(b=>b.id)}::uuid[]) WHERE p."salonId"=${c.salonId}::uuid AND (${q}='' OR p.barcode=${q} OR p.sku=${q} OR p.name ILIKE '%'||${q}||'%') GROUP BY p.id HAVING (NOT ${availableOnly} OR coalesce(sum(l.stock),0)>0) ORDER BY p.name,p.id LIMIT ${limit}`;}
