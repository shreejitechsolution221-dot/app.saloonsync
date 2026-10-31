import 'server-only';
import {Prisma} from '@/generated/prisma/client';
import {db} from '@/lib/db';
import {completionEffects} from './bookings';
import {DomainError,type Context} from './shared';

export async function completeTimedService(id:string,c?:Context){
 return db.$transaction(async tx=>{
  const row=await tx.appointment.findFirst({where:{id,status:'in_service',...(c?{salonId:c.salonId,branchId:{in:c.branches.map(b=>b.id)},...(c.operator?{}:{assignedUserId:c.user.id})}:{})}});
  if(!row)return false;
  const started=await tx.auditEvent.findFirst({where:{salonId:row.salonId,targetId:id,action:'appointment.in_service',outcome:'allowed'},orderBy:{occurredAt:'desc'},select:{occurredAt:true,actorUserId:true}});
  if(!started||started.occurredAt.getTime()+row.durationMinutes*60000>Date.now())return false;
  const actorUserId=c?.user.id??started.actorUserId;if(!actorUserId)throw new DomainError('Complete this service manually to record its operator.');
  if(row.checklist.some((_,index)=>!row.completedSteps.includes(index)))throw new DomainError('Service time is finished. Complete the service checklist to finish this appointment.');
  const changed=await tx.appointment.updateMany({where:{id,salonId:row.salonId,status:'in_service'},data:{status:'completed'}});
  if(!changed.count)return false;
  await completionEffects(tx,{salonId:row.salonId,user:{id:actorUserId}},row);
  await tx.auditEvent.create({data:{salonId:row.salonId,actorUserId,action:'appointment.completed',targetType:'appointment',targetId:id,outcome:'allowed',metadata:{automatic:true}}});
  return true;
 },{timeout:15000});
}

export function dueServiceQuery(c?:Context){
 const scope=c?Prisma.sql`AND a."salonId"=${c.salonId}::uuid AND a."branchId" IN (${Prisma.join(c.branches.map(b=>Prisma.sql`${b.id}::uuid`))}) ${c.operator?Prisma.empty:Prisma.sql`AND a."assignedUserId"=${c.user.id}::uuid`}`:Prisma.empty;
 return Prisma.sql`
  SELECT a.id FROM app."Appointment" a
  JOIN LATERAL (SELECT e."occurredAt" FROM app."AuditEvent" e WHERE e."salonId"=a."salonId" AND e."targetId"=a.id::text AND e.action='appointment.in_service' AND e.outcome='allowed' ORDER BY e."occurredAt" DESC LIMIT 1) started ON true
  WHERE a.status='in_service' AND started."occurredAt"+make_interval(mins=>a."durationMinutes")<=now()
  AND cardinality(a.checklist)=cardinality(a."completedSteps") ${scope}
  ORDER BY started."occurredAt" LIMIT 25`;
}
export async function completeDueServices(c?:Context){
 if(c&&!c.branches.length)return {completed:0,blocked:0};
 const due=await db.$queryRaw<{id:string}[]>(dueServiceQuery(c));
 let completed=0,blocked=0;
 for(const row of due){try{if(await completeTimedService(row.id,c))completed++;}catch{blocked++;}}
 return {completed,blocked};
}
