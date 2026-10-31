import 'server-only';
import type {Prisma} from '@/generated/prisma/client';
export async function cashLock(tx:Prisma.TransactionClient,salonId:string,branchId:string){await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${salonId+branchId},2))::text`;}
