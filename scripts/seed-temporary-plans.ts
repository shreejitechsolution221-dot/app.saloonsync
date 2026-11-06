import {config} from 'dotenv';
import {Client} from 'pg';
import {randomUUID} from 'node:crypto';
import {parseRecord} from '../src/lib/platform/validation';
config({path:'.env.local',quiet:true});
const client=new Client({connectionString:process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL,connectionTimeoutMillis:10000});
const plans=[
 {title:'Temporary Starter',code:'temp-starter',branchLimit:1,staffLimit:5,trialDays:14,graceDays:7,entitlements:'online_booking, appointments, customers'},
 {title:'Temporary Growth',code:'temp-growth',branchLimit:3,staffLimit:15,trialDays:30,graceDays:7,entitlements:'online_booking, appointments, customers, inventory, reports'},
 {title:'Temporary Pro',code:'temp-pro',branchLimit:10,staffLimit:50,trialDays:30,graceDays:14,entitlements:'online_booking, appointments, customers, inventory, reports, marketing'},
];
try{
 await client.connect();await client.query('BEGIN');
 await client.query('SELECT pg_advisory_xact_lock(81320711)');
 const custodians=await client.query<{id:string}>(`SELECT u.id FROM app."User" u WHERE u."disabledAt" IS NULL AND EXISTS (SELECT 1 FROM app."PlatformPrivilege" p WHERE p."userId"=u.id AND p.privilege='platform.manage' AND p.status='active' AND p."revokedAt" IS NULL) AND EXISTS (SELECT 1 FROM app."PlatformPrivilege" p WHERE p."userId"=u.id AND p.privilege='platform.subscriptions.manage' AND p.status='active' AND p."revokedAt" IS NULL) ORDER BY u."createdAt",u.id LIMIT 1`);
 const custodian=custodians.rows[0]?.id;if(!custodian)throw new Error('An active subscription-management operator is required to own these draft records.');
 const output: {code:string;result:string}[]=[];
 for(const plan of plans){
  const form=new FormData();for(const [key,value] of Object.entries({...plan,id:'',kind:'plan',status:'draft',salonId:'',assigneeId:'',version:0,pricePaise:0}))form.set(key,String(value));
  const input=parseRecord(form);const key=`plan:${plan.code}`;
  const existing=await client.query('SELECT id FROM app."PlatformRecord" WHERE key=$1',[key]);
  if(existing.rowCount){output.push({code:plan.code,result:'already exists; retained unchanged'});continue;}
  const id=randomUUID();
  await client.query(`INSERT INTO app."PlatformRecord" (id,kind,key,title,status,payload,"createdBy","updatedBy","updatedAt") VALUES ($1,'plan',$2,$3,'draft',$4::jsonb,$5,$5,now())`,[id,key,input.title,JSON.stringify({...input.payload,temporary:true}),custodian]);
  // The administrative operator is the record custodian, not the attributed seed actor.
  await client.query(`INSERT INTO app."AuditEvent" (id,action,"targetType","targetId",outcome,metadata) VALUES ($1,'platform.plan.seeded','PlatformRecord',$2,'allowed',$3::jsonb)`,[randomUUID(),id,JSON.stringify({mechanism:'user-requested-temporary-plan-seed',recordCustodianId:custodian,status:'draft',planCode:plan.code,pricePaise:0})]);
  output.push({code:plan.code,result:'created draft'});
 }
 await client.query('COMMIT');console.log(JSON.stringify({plans:output,subscriptionAssignmentsChanged:false,paymentsCreated:false}));
}catch(error){await client.query('ROLLBACK').catch(()=>{});console.error(JSON.stringify({event:'temporary_plans.seed_failed',code:(error as {code?:string}).code??'validation',reason:error instanceof Error&&error.message.startsWith('An active subscription')?error.message:undefined}));process.exitCode=1;}
finally{await client.end().catch(()=>{});}
