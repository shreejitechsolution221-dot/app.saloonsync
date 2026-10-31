import {config} from 'dotenv';
import {performance} from 'node:perf_hooks';
import {workspaceQuery,type WorkspaceRow} from '../src/lib/salon/workspace-query';
config({path:'.env.local',quiet:true});
const {PrismaClient}=await import('../src/generated/prisma/client');
const {PrismaPg}=await import('@prisma/adapter-pg');
const db=new PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL,max:5,connectionTimeoutMillis:10000},{schema:'app'})});
const median=(values:number[])=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
try{
 const member=await db.salonMembership.findFirst({where:{status:'active',salon:{status:'active'},user:{disabledAt:null}},select:{salonId:true,userId:true}});
 if(!member)throw new Error('No active membership available for read-only benchmark');
 const previous=async()=>{
  const active=await db.salonMembership.findMany({where:{userId:member.userId,status:'active',salon:{status:'active'}}});
  if(!active.some(m=>m.salonId===member.salonId))throw new Error('Membership changed');
  const m=await db.salonMembership.findUniqueOrThrow({where:{salonId_userId:{salonId:member.salonId,userId:member.userId}},include:{salon:true,branches:true}});
  return db.branch.findMany({where:{salonId:member.salonId,status:'active',...(m.branchScope==='selected'?{id:{in:m.branches.map(b=>b.branchId)}}:{})},orderBy:{name:'asc'}});
 };
 const optimized=()=>db.$queryRaw<WorkspaceRow[]>(workspaceQuery(member.userId,member.salonId));
 const oldRows=await previous(),newRows=await optimized();
 if(oldRows.map(b=>b.id).sort().join()!==newRows[0]?.branches.map(b=>b.id).sort().join())throw new Error('Workspace scope mismatch');
 const oldMs:number[]=[],newMs:number[]=[];
 for(let i=0;i<3;i++){let start=performance.now();await previous();oldMs.push(performance.now()-start);start=performance.now();await optimized();newMs.push(performance.now()-start);}
 console.log(JSON.stringify({scopeEquivalent:true,samples:3,previousMedianMs:Math.round(median(oldMs)),optimizedMedianMs:Math.round(median(newMs)),note:'Warm workspace database lookup only; excludes login, rendering and network to browser.'}));
}finally{await db.$disconnect();}
