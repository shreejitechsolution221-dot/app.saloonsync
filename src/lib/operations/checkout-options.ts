import 'server-only';
import {db} from '@/lib/db';
import type {Context} from './shared';
import {Prisma} from '@/generated/prisma/client';
export type CustomerChoice={id:string;displayName:string;phone:string|null;points:number};
export function checkoutCustomersQuery(c:Context){
 const filtered=c.membership.branchScope==='selected'||Boolean(c.selectedBranchId);
 return Prisma.sql`SELECT sc.id,sc."displayName",sc.phone,coalesce(la.points,0)::int AS points
 FROM app."SalonCustomer" sc LEFT JOIN app."LoyaltyAccount" la ON la."salonId"=sc."salonId" AND la."customerId"=sc.id
 WHERE sc."salonId"=${c.salonId}::uuid AND (NOT ${filtered} OR sc."originBranchId"=ANY(${c.branches.map(b=>b.id)}::uuid[]) OR EXISTS(SELECT 1 FROM app."Appointment" a WHERE a."salonId"=sc."salonId" AND a."salonCustomerId"=sc.id AND a."branchId"=ANY(${c.branches.map(b=>b.id)}::uuid[])))
 ORDER BY sc."displayName",sc.id LIMIT 500`;
}
export async function checkoutCustomers(c:Context){
 return db.$queryRaw<CustomerChoice[]>(checkoutCustomersQuery(c));
}
