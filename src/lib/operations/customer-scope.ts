import type {Prisma} from '@/generated/prisma/client';
import type {Context} from './shared';
export function customerScope(c:Context,permissionOnly=false):Prisma.SalonCustomerWhereInput{const limited=c.membership.branchScope==='selected',filtered=limited||!permissionOnly&&Boolean(c.selectedBranchId);const ids=(permissionOnly?c.availableBranches:c.branches).map(b=>b.id);return {salonId:c.salonId,...(filtered?{OR:[{originBranchId:{in:ids}},{bookings:{some:{branchId:{in:ids}}}}]}:{})};}
