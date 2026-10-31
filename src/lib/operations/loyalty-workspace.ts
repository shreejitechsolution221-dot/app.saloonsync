import 'server-only';
import {Prisma} from '@/generated/prisma/client';
import {db} from '@/lib/db';
import type {Context} from './shared';
import {checkoutCustomersQuery} from './checkout-options';
type Workspace={customers:{id:string;displayName:string;phone:string|null}[];accounts:{id:string;customerId:string;points:number;membershipName:string;referralCode:string}[]};
export function loyaltyWorkspaceQuery(c:Context){return Prisma.sql`WITH choices AS (${checkoutCustomersQuery(c)})
 SELECT coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'displayName',c."displayName",'phone',c.phone) ORDER BY c."displayName",c.id) FROM choices c),'[]'::jsonb) AS customers,
 coalesce((SELECT jsonb_agg(jsonb_build_object('id',a.id,'customerId',a."customerId",'points',a.points,'membershipName',a."membershipName",'referralCode',a."referralCode") ORDER BY a."updatedAt" DESC,a.id) FROM (SELECT la.id,la."customerId",la.points,la."membershipName",la."referralCode",la."updatedAt" FROM app."LoyaltyAccount" la JOIN choices c ON c.id=la."customerId" WHERE la."salonId"=${c.salonId}::uuid ORDER BY la."updatedAt" DESC,la.id LIMIT 200) a),'[]'::jsonb) AS accounts`;}
export async function loyaltyWorkspace(c:Context){const [row]=await db.$queryRaw<Workspace[]>(loyaltyWorkspaceQuery(c));return row??{customers:[],accounts:[]};}
