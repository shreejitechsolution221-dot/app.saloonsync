import 'server-only';
import type {Prisma} from '@/generated/prisma/client';
import type {Context} from './shared';
export async function audit(tx:Prisma.TransactionClient,c:Context,action:string,targetId:string,metadata?:Prisma.InputJsonValue){await tx.auditEvent.create({data:{salonId:c.salonId,actorUserId:c.user.id,action,targetType:action.split('.')[0],targetId,outcome:'allowed',...(metadata?{metadata}:{})}});}
