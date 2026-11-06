import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { beforeAll, afterAll, expect, it, vi } from 'vitest';
import {loyaltyAwardQuery} from '@/lib/operations/loyalty-award';
import {checkoutCustomersQuery} from '@/lib/operations/checkout-options';
import {receiptQuery} from '@/lib/operations/receipt-query';
import {dueServiceQuery} from '@/lib/operations/timed-services';
vi.mock('@/lib/db',()=>({db:{}}));
let pg: PGlite;
const u1='11111111-1111-4111-8111-111111111111', u2='22222222-2222-4222-8222-222222222222', s1='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', s2='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', b1='cccccccc-cccc-4ccc-8ccc-cccccccccccc', b2='dddddddd-dddd-4ddd-8ddd-dddddddddddd', m1='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
beforeAll(async () => {
  pg = new PGlite();
  await pg.exec('CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY, email text, deleted_at timestamptz); CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE supabase_auth_admin;');
  await pg.exec(await readFile('prisma/migrations/202610270001_initial/migration.sql', 'utf8'));
  await pg.exec(await readFile('prisma/migrations/202610270002_integrity/migration.sql', 'utf8'));
  await pg.exec(await readFile('prisma/migrations/202610270003_appointment_assignment/migration.sql', 'utf8'));
  await pg.exec(await readFile('prisma/migrations/202610270004_platform_management/migration.sql', 'utf8'));
  await pg.exec(await readFile('prisma/migrations/202610270005_owner_registration_details/migration.sql', 'utf8'));
  await pg.exec(await readFile('prisma/migrations/202610280006_signup_email_policy/migration.sql', 'utf8'));
  await pg.exec(await readFile('prisma/migrations/202610280007_runtime_role/migration.sql', 'utf8'));
  await pg.exec(await readFile('prisma/migrations/202610280008_email_lookup/migration.sql', 'utf8'));
  await pg.exec(await readFile('prisma/migrations/202610290009_salon_operations/migration.sql','utf8'));
  await pg.exec(await readFile('prisma/migrations/202610290010_payment_lock/migration.sql','utf8'));
  await pg.exec(await readFile('prisma/migrations/202610290011_workspace_query_indexes/migration.sql','utf8'));
  await pg.exec(await readFile('prisma/migrations/202610290012_business_operations/migration.sql','utf8'));
  await pg.exec(await readFile('prisma/migrations/202610290013_location_stock/migration.sql','utf8'));
  await pg.exec(await readFile('prisma/migrations/202610290014_customer_location/migration.sql','utf8'));
  await pg.exec(await readFile('prisma/migrations/202610310015_service_commission/migration.sql','utf8'));
  await pg.exec(await readFile('prisma/migrations/202610310016_teammate_invitation_profile/migration.sql','utf8'));
  await pg.exec(await readFile('prisma/migrations/202610310017_checkout_loyalty/migration.sql','utf8'));
  await pg.exec(await readFile('prisma/migrations/202610310018_performance_indexes/migration.sql','utf8'));
  await pg.exec(await readFile('prisma/migrations/202611050019_platform_console/migration.sql','utf8'));
  await pg.exec(`BEGIN;
    INSERT INTO auth.users VALUES ('${u1}'),('${u2}');
    INSERT INTO app."User" (id,"displayName","updatedAt") VALUES ('${u1}','Owner',now()),('${u2}','Other',now());
    INSERT INTO app."Salon" (id,name,slug,"onboardingKey","updatedAt") VALUES ('${s1}','A','a','a',now()),('${s2}','B','b','b',now());
    INSERT INTO app."Branch" (id,"salonId",name,"updatedAt") VALUES ('${b1}','${s1}','A',now()),('${b2}','${s2}','B',now());
    INSERT INTO app."SalonMembership" (id,"salonId","userId",role,"updatedAt") VALUES ('${m1}','${s1}','${u1}','owner',now()),(gen_random_uuid(),'${s2}','${u2}','owner',now()); COMMIT;`);
});
afterAll(async () => { await pg?.close(); });
it('stores platform records behind backend-only privileges with foreign-key integrity',async()=>{
  try {
    await pg.exec('BEGIN');
    await pg.query(`INSERT INTO app."PlatformRecord" (id,kind,key,title,status,"salonId","createdBy","updatedBy","updatedAt") VALUES (gen_random_uuid(),'ticket','case:test','Salon setup','open',$1,$2,$2,now())`,[s1,u1]);
    expect((await pg.query(`SELECT title FROM app."PlatformRecord" WHERE key='case:test'`)).rows).toEqual([{title:'Salon setup'}]);
    await pg.exec('SAVEPOINT invalid_record');
    await expect(pg.query(`INSERT INTO app."PlatformRecord" (id,kind,key,title,status,"createdBy","updatedBy","updatedAt") VALUES (gen_random_uuid(),'unknown','invalid','Invalid','open',$1,$1,now())`,[u1])).rejects.toThrow();
    await pg.exec('ROLLBACK TO SAVEPOINT invalid_record');
    await pg.exec('SET LOCAL ROLE authenticated');
    await expect(pg.query(`SELECT * FROM app."PlatformRecord"`)).rejects.toThrow('permission denied');
  } finally { await pg.exec('ROLLBACK'); }
});
it('accepts specialist platform grants and rejects unrecognized privileges',async()=>{
  try {
    await pg.exec('BEGIN');
    await pg.query(`INSERT INTO app."PlatformPrivilege" (id,"userId",privilege) VALUES (gen_random_uuid(),$1,'platform.support.manage')`,[u1]);
    await expect(pg.query(`INSERT INTO app."PlatformPrivilege" (id,"userId",privilege) VALUES (gen_random_uuid(),$1,'platform.everything')`,[u1])).rejects.toThrow('privilege_name');
  } finally { await pg.exec('ROLLBACK'); }
});
it('links invitations only to employee profiles in the same salon',async()=>{
 const own='f4444444-4444-4444-8444-444444444444',foreign='f5555555-5555-4555-8555-555555555555';
 try{
  await pg.exec('BEGIN');await pg.query(`INSERT INTO app."StaffProfile" (id,"salonId","displayName","jobTitle","updatedAt") VALUES ($1,$2,'Own employee','Stylist',now()),($3,$4,'Foreign employee','Stylist',now())`,[own,s1,foreign,s2]);
  await pg.query(`INSERT INTO app."Invitation" (id,"salonId","staffProfileId","intendedEmail",role,"branchScope","tokenHash","invitedBy","expiresAt") VALUES (gen_random_uuid(),$1,$2,'employee@salon.test','staff','all',repeat('a',64),$3,now()+interval '3 days')`,[s1,own,u1]);
  expect((await pg.query<{staffProfileId:string}>(`SELECT "staffProfileId" FROM app."Invitation" WHERE "tokenHash"=repeat('a',64)`)).rows[0].staffProfileId).toBe(own);
  await expect(pg.query(`INSERT INTO app."Invitation" (id,"salonId","staffProfileId","intendedEmail",role,"branchScope","tokenHash","invitedBy","expiresAt") VALUES (gen_random_uuid(),$1,$2,'foreign@salon.test','staff','all',repeat('b',64),$3,now()+interval '3 days')`,[s1,foreign,u1])).rejects.toThrow('Invitation_staffProfile_tenant_fk');
 }finally{await pg.exec('ROLLBACK');}
});
it('validates service-specific commission percentages at the database boundary',async()=>{
 const service='e2222222-2222-4222-8222-222222222222';
 try{await pg.exec('BEGIN');await pg.query(`INSERT INTO app."Service" (id,"salonId",name,category,"durationMinutes","pricePaise","commissionBps","updatedAt") VALUES ($1,$2,'Commission service','Hair',30,10000,1250,now())`,[service,s1]);expect((await pg.query<{commissionBps:number}>(`SELECT "commissionBps" FROM app."Service" WHERE id=$1`,[service])).rows[0].commissionBps).toBe(1250);}finally{await pg.exec('ROLLBACK');}
 await expect(pg.query(`INSERT INTO app."Service" (id,"salonId",name,category,"durationMinutes","pricePaise","commissionBps","updatedAt") VALUES ($1,$2,'Invalid service','Hair',30,10000,10001,now())`,[service,s1])).rejects.toThrow('Service_commissionBps_range');
});
it('finds due service timers from actual start events and respects checklists and scope',async()=>{
 const appointment='f1111111-1111-4111-8111-111111111111';
 try{
  await pg.exec('BEGIN');
  await pg.query(`INSERT INTO app."Appointment" (id,"salonId","branchId","assignedUserId","customerUserId","startsAt",status,"durationMinutes",checklist,"updatedAt") VALUES ($1,$2,$3,$4,$4,'2027-03-20T04:30:00Z','in_service',30,ARRAY['Wash'],now())`,[appointment,s1,b1,u1]);
  await pg.query(`INSERT INTO app."AuditEvent" (id,"actorUserId","salonId",action,"targetType","targetId",outcome,"occurredAt") VALUES (gen_random_uuid(),$1,$2,'appointment.in_service','appointment',$3,'allowed',now()-interval '31 minutes')`,[u1,s1,appointment]);
  let query=dueServiceQuery();expect((await pg.query<{id:string}>(query.text,query.values)).rows.some(r=>r.id===appointment)).toBe(false);
  await pg.query(`UPDATE app."Appointment" SET "completedSteps"=ARRAY[0] WHERE id=$1`,[appointment]);
  expect((await pg.query<{id:string}>(query.text,query.values)).rows.some(r=>r.id===appointment)).toBe(true);
  query=dueServiceQuery({salonId:s2,branches:[{id:b2}],operator:true,user:{id:u2}} as never);
  expect((await pg.query<{id:string}>(query.text,query.values)).rows.some(r=>r.id===appointment)).toBe(false);
 }finally{await pg.exec('ROLLBACK');}
});
it('rejects cross-tenant membership branch grants', async () => {
  await expect(pg.query(`INSERT INTO app."MembershipBranchAccess" ("membershipId","salonId","branchId") VALUES ($1,$2,$3)`, [m1,s1,b2])).rejects.toThrow();
});
it('denies Data API roles at the schema boundary', async () => {
  try {
    await pg.exec('BEGIN; SET LOCAL ROLE anon;');
    await expect(pg.query('SELECT * FROM app."User"')).rejects.toThrow('permission denied');
  } finally { await pg.exec('ROLLBACK;'); }
});
it('RLS still hides records if a Data API table grant is accidentally added', async () => {
  try {
    await pg.exec('BEGIN; GRANT USAGE ON SCHEMA app TO authenticated; GRANT SELECT ON app."User" TO authenticated; SET LOCAL ROLE authenticated;');
    expect((await pg.query('SELECT * FROM app."User"')).rows).toEqual([]);
  } finally { await pg.exec('ROLLBACK;'); }
});
it('protects the last owner against demotion, suspension and deletion', async () => {
  await expect(pg.query(`UPDATE app."SalonMembership" SET role='admin' WHERE id=$1`, [m1])).rejects.toThrow('active owner');
  await expect(pg.query(`UPDATE app."SalonMembership" SET status='suspended' WHERE id=$1`, [m1])).rejects.toThrow('active owner');
  await expect(pg.query(`DELETE FROM app."SalonMembership" WHERE id=$1`, [m1])).rejects.toThrow('active owner');
});
it('protects the last owner against account disablement', async () => {
  await expect(pg.query(`UPDATE app."User" SET "disabledAt"=now() WHERE id=$1`, [u1])).rejects.toThrow('Transfer ownership');
});
it('rejects a selected membership without branch access', async () => {
  await expect(pg.query(`INSERT INTO app."SalonMembership" (id,"salonId","userId",role,"branchScope","updatedAt") VALUES (gen_random_uuid(),$1,$2,'staff','selected',now())`, [s1,u2])).rejects.toThrow('requires a branch');
});
it('rejects provider identities that do not exist', async () => {
  await expect(pg.query(`INSERT INTO app."User" (id,"displayName","updatedAt") VALUES (gen_random_uuid(),'Fake',now())`)).rejects.toThrow();
});
it('rejects a booking whose branch belongs to another salon', async () => {
  await expect(pg.query(`INSERT INTO app."Appointment" (id,"salonId","branchId","customerUserId","startsAt","updatedAt") VALUES (gen_random_uuid(),$1,$2,$3,now(),now())`, [s1,b2,u1])).rejects.toThrow();
});
it('rejects a work assignment to a member of another salon', async () => {
  await expect(pg.query(`INSERT INTO app."Appointment" (id,"salonId","branchId","customerUserId","assignedUserId","startsAt","updatedAt") VALUES (gen_random_uuid(),$1,$2,$3,$4,now(),now())`, [s1,b1,u1,u2])).rejects.toThrow();
});
it('rejects missing audit tenant context', async () => {
  await expect(pg.query(`INSERT INTO app."AuditEvent" (id,"branchId",action,"targetType","targetId",outcome) VALUES (gen_random_uuid(),$1,'test','test','test','allowed')`, [b1])).rejects.toThrow();
});
it('makes revoked invitations immutable and prevents reuse', async () => {
  const result = await pg.query<{id:string}>(`INSERT INTO app."Invitation" (id,"salonId","intendedEmail",role,"branchScope","tokenHash","invitedBy","expiresAt","revokedAt") VALUES (gen_random_uuid(),$1,'invited@example.test','staff','all',$2,$3,now()+interval '1 day',now()) RETURNING id`, [s1,'a'.repeat(64),u1]);
  await expect(pg.query(`UPDATE app."Invitation" SET "revokedAt"=NULL WHERE id=$1`, [result.rows[0].id])).rejects.toThrow('immutable');
});
it('rejects expired invitation acceptance at the database boundary', async () => {
  const result = await pg.query<{id:string}>(`INSERT INTO app."Invitation" (id,"salonId","intendedEmail",role,"branchScope","tokenHash","invitedBy","createdAt","expiresAt") VALUES (gen_random_uuid(),$1,'invited@example.test','staff','all',$2,$3,now()-interval '2 days',now()-interval '1 day') RETURNING id`, [s1,'b'.repeat(64),u1]);
  await expect(pg.query(`UPDATE app."Invitation" SET "acceptedAt"=now(),"acceptedBy"=$2 WHERE id=$1`, [result.rows[0].id,u2])).rejects.toThrow('expired');
});
it('allows an atomic ownership transfer', async () => {
  await pg.exec(`BEGIN;
    INSERT INTO app."SalonMembership" (id,"salonId","userId",role,"updatedAt") VALUES (gen_random_uuid(),'${s1}','${u2}','owner',now());
    UPDATE app."SalonMembership" SET role='admin' WHERE id='${m1}'; COMMIT;`);
  const result = await pg.query<{count:number}>(`SELECT count(*)::int AS count FROM app."SalonMembership" WHERE "salonId"=$1 AND role='owner' AND status='active'`, [s1]);
  expect(result.rows[0].count).toBe(1);
});
it('enforces one subscription record per salon', async () => {
  await pg.query(`INSERT INTO app."SalonSubscription" (id,"salonId","planCode",status,"updatedAt") VALUES (gen_random_uuid(),$1,'published-plan','active',now())`, [s1]);
  await expect(pg.query(`INSERT INTO app."SalonSubscription" (id,"salonId","planCode",status,"updatedAt") VALUES (gen_random_uuid(),$1,'other-plan','trialing',now())`, [s1])).rejects.toThrow();
});
it('rejects subscription records with invalid states', async () => {
  await expect(pg.query(`INSERT INTO app."SalonSubscription" (id,"salonId","planCode",status,"updatedAt") VALUES (gen_random_uuid(),$1,'published-plan','paid-simulation',now())`, [s2])).rejects.toThrow();
});
it('keeps named subscription privileges separate from entry and operator management', async () => {
  await pg.query(`INSERT INTO app."PlatformPrivilege" (id,"userId",privilege) VALUES (gen_random_uuid(),$1,'platform.subscriptions.manage')`, [u1]);
  const rows = await pg.query(`SELECT privilege FROM app."PlatformPrivilege" WHERE "userId"=$1`, [u1]);
  expect(rows.rows).toEqual([{privilege:'platform.subscriptions.manage'}]);
});
it('enforces mobile format and salon-name length on saved registration details', async () => {
  await expect(pg.query(`UPDATE app."User" SET "mobileNumber"='not-a-number' WHERE id=$1`,[u1])).rejects.toThrow();
  await expect(pg.query(`UPDATE app."User" SET "salonRegistrationName"='x' WHERE id=$1`,[u1])).rejects.toThrow();
  await pg.query(`UPDATE app."User" SET "mobileNumber"='+919876543210',"salonRegistrationName"='Test Studio' WHERE id=$1`,[u1]);
});
it('Auth hook blocks disposable subdomains and reserved fake emails',async()=>{
  for(const email of ['x@mailinator.com','x@sub.mailinator.com','x@example.invalid']){
    const r=await pg.query<{result:{error:{http_code:number}}}>('SELECT app.before_user_created($1::jsonb) AS result',[JSON.stringify({user:{email}})]);
    expect(r.rows[0].result.error.http_code).toBe(400);
  }
});
it('Auth hook permits ordinary domains without granting browser access',async()=>{
  const r=await pg.query<{result:object}>('SELECT app.before_user_created($1::jsonb) AS result',[JSON.stringify({user:{email:'x@gmail.com'}})]);expect(r.rows[0].result).toEqual({});
  try{await pg.exec('BEGIN; SET LOCAL ROLE anon;');await expect(pg.query('SELECT app.before_user_created($1::jsonb)',[JSON.stringify({user:{email:'x@gmail.com'}})])).rejects.toThrow('permission denied');}finally{await pg.exec('ROLLBACK;');}
});
it('Supabase Auth role can run only the hook and read its blocklist',async()=>{
  try{
    await pg.exec('BEGIN; SET LOCAL ROLE supabase_auth_admin;');
    const r=await pg.query<{result:object}>('SELECT app.before_user_created($1::jsonb) AS result',[JSON.stringify({user:{email:'x@gmail.com'}})]);expect(r.rows[0].result).toEqual({});
    await expect(pg.query('SELECT * FROM app."User"')).rejects.toThrow('permission denied');
  }finally{await pg.exec('ROLLBACK;');}
});

it('runtime role cannot bypass RLS or administer schema, Auth credentials, or audit history',async()=>{
 const role=await pg.query<{rolbypassrls:boolean;rolsuper:boolean}>("SELECT rolbypassrls,rolsuper FROM pg_roles WHERE rolname='saloonsync_runtime'");
 expect(role.rows[0]).toEqual({rolbypassrls:false,rolsuper:false});
 const grants=await pg.query<{audit_update:boolean;auth_update:boolean;schema_create:boolean;profile_read:boolean}>(`SELECT has_table_privilege('saloonsync_runtime','app."AuditEvent"','UPDATE') AS audit_update, has_table_privilege('saloonsync_runtime','auth.users','UPDATE') AS auth_update,has_schema_privilege('saloonsync_runtime','app','CREATE') AS schema_create,has_table_privilege('saloonsync_runtime','app."User"','SELECT') AS profile_read`);
 expect(grants.rows[0]).toEqual({audit_update:false,auth_update:false,schema_create:false,profile_read:true});
});

it('runtime lookup returns only a boolean without direct access to Auth records',async()=>{
 await pg.exec(`UPDATE auth.users SET email='owner@example.test' WHERE id='${u1}'`);
 await pg.exec('SET ROLE saloonsync_runtime');
 try{
  const result=await pg.query<{found:boolean}>("SELECT app.registered_email_exists('owner@example.test') AS found");expect(result.rows[0].found).toBe(true);
  await expect(pg.query('SELECT email FROM auth.users')).rejects.toThrow();
 }finally{await pg.exec('RESET ROLE');}
});
it('rejects a salon-local customer from another tenant',async()=>{
 const customer=await pg.query<{id:string}>(`INSERT INTO app."SalonCustomer"(id,"salonId","displayName","updatedAt") VALUES(gen_random_uuid(),$1,'Local customer',now()) RETURNING id`,[s2]);
 await expect(pg.query(`INSERT INTO app."Appointment"(id,"salonId","branchId","salonCustomerId","startsAt","updatedAt") VALUES(gen_random_uuid(),$1,$2,$3,now(),now())`,[s1,b1,customer.rows[0].id])).rejects.toThrow();
});
it('prevents overlapping bookings and permits adjacent slots',async()=>{
 const member=await pg.query<{userId:string}>(`SELECT "userId" FROM app."SalonMembership" WHERE "salonId"=$1 AND status='active' LIMIT 1`,[s1]);const assigned=member.rows[0].userId;
 await pg.query(`INSERT INTO app."Appointment"(id,"salonId","branchId","customerUserId","assignedUserId","startsAt","durationMinutes","updatedAt") VALUES(gen_random_uuid(),$1,$2,$3,$4,'2027-02-01T10:00:00Z',60,now())`,[s1,b1,u1,assigned]);
 await expect(pg.query(`INSERT INTO app."Appointment"(id,"salonId","branchId","customerUserId","assignedUserId","startsAt","updatedAt") VALUES(gen_random_uuid(),$1,$2,$3,$4,'2027-02-01T10:30:00Z',now())`,[s1,b1,u1,assigned])).rejects.toThrow('already booked');
 await pg.query(`INSERT INTO app."Appointment"(id,"salonId","branchId","customerUserId","assignedUserId","startsAt","updatedAt") VALUES(gen_random_uuid(),$1,$2,$3,$4,'2027-02-01T11:00:00Z',now())`,[s1,b1,u1,assigned]);
});
it('prevents overpayment and cross-tenant invoice payment',async()=>{
 const booking=await pg.query<{id:string}>(`INSERT INTO app."Appointment"(id,"salonId","branchId","customerUserId","startsAt","updatedAt") VALUES(gen_random_uuid(),$1,$2,$3,now(),now()) RETURNING id`,[s1,b1,u1]);
 const invoice=await pg.query<{id:string}>(`INSERT INTO app."Invoice"(id,"salonId","appointmentId","customerName","serviceName","totalPaise") VALUES(gen_random_uuid(),$1,$2,'Customer','Haircut',10000) RETURNING id`,[s1,booking.rows[0].id]);
 await pg.query(`INSERT INTO app."Payment"(id,"salonId","invoiceId","amountPaise",method) VALUES(gen_random_uuid(),$1,$2,6000,'cash')`,[s1,invoice.rows[0].id]);
 await expect(pg.query(`INSERT INTO app."Payment"(id,"salonId","invoiceId","amountPaise",method) VALUES(gen_random_uuid(),$1,$2,5000,'upi')`,[s1,invoice.rows[0].id])).rejects.toThrow('balance');
 await expect(pg.query(`INSERT INTO app."Payment"(id,"salonId","invoiceId","amountPaise",method) VALUES(gen_random_uuid(),$1,$2,1000,'cash')`,[s2,invoice.rows[0].id])).rejects.toThrow();
});
it('keeps operational tables unavailable to browser roles',async()=>{
 try{await pg.exec('BEGIN; GRANT USAGE ON SCHEMA app TO authenticated; GRANT SELECT ON app."Invoice" TO authenticated; SET LOCAL ROLE authenticated;');expect((await pg.query('SELECT * FROM app."Invoice"')).rows).toEqual([]);}finally{await pg.exec('ROLLBACK;');}
});
it('records payments using the restricted runtime role without update grants',async()=>{
 const booking=await pg.query<{id:string}>(`INSERT INTO app."Appointment"(id,"salonId","branchId","customerUserId","startsAt","updatedAt") VALUES(gen_random_uuid(),$1,$2,$3,now(),now()) RETURNING id`,[s1,b1,u1]);
 const invoice=await pg.query<{id:string}>(`INSERT INTO app."Invoice"(id,"salonId","appointmentId","customerName","serviceName","totalPaise") VALUES(gen_random_uuid(),$1,$2,'Customer','Haircut',10000) RETURNING id`,[s1,booking.rows[0].id]);
 try{await pg.exec('BEGIN; SET LOCAL ROLE saloonsync_runtime;');await pg.query(`INSERT INTO app."Payment"(id,"salonId","invoiceId","amountPaise",method) VALUES(gen_random_uuid(),$1,$2,1000,'upi')`,[s1,invoice.rows[0].id]);await expect(pg.query(`UPDATE app."Invoice" SET "totalPaise"=0 WHERE id=$1`,[invoice.rows[0].id])).rejects.toThrow('permission denied');}finally{await pg.exec('ROLLBACK;');}
});
it('blocks bookings during approved leave and rejects leave over existing bookings',async()=>{
 const reviewer=u2;
 await pg.query(`INSERT INTO app."LeaveRequest"(id,"salonId","branchId","userId","startsAt","endsAt",reason,status,"reviewedBy","reviewedAt","updatedAt") VALUES(gen_random_uuid(),$1,$2,$3,'2027-06-01T00:00:00Z','2027-06-02T00:00:00Z','Leave','approved',$4,now(),now())`,[s1,b1,u1,reviewer]);
 await expect(pg.query(`INSERT INTO app."Appointment"(id,"salonId","branchId","customerUserId","assignedUserId","startsAt","updatedAt") VALUES(gen_random_uuid(),$1,$2,$3,$3,'2027-06-01T10:00:00Z',now())`,[s1,b1,u1])).rejects.toThrow('approved leave');
 await pg.query(`INSERT INTO app."Appointment"(id,"salonId","branchId","customerUserId","assignedUserId","startsAt","updatedAt") VALUES(gen_random_uuid(),$1,$2,$3,$3,'2027-06-03T10:00:00Z',now())`,[s1,b1,u1]);
 await expect(pg.query(`INSERT INTO app."LeaveRequest"(id,"salonId","branchId","userId","startsAt","endsAt",reason,status,"reviewedBy","reviewedAt","updatedAt") VALUES(gen_random_uuid(),$1,$2,$3,'2027-06-03T09:00:00Z','2027-06-03T12:00:00Z','Leave','approved',$4,now(),now())`,[s1,b1,u1,reviewer])).rejects.toThrow('Reschedule');
});
it('requires completed service steps and protects terminal appointment history',async()=>{
 const {rows:[row]}=await pg.query<{id:string}>(`INSERT INTO app."Appointment"(id,"salonId","branchId","customerUserId","startsAt",status,checklist,"updatedAt") VALUES(gen_random_uuid(),$1,$2,$3,now(),'in_service',ARRAY['Prepare'],now()) RETURNING id`,[s1,b1,u1]);
 await expect(pg.query(`UPDATE app."Appointment" SET status='completed' WHERE id=$1`,[row.id])).rejects.toThrow('checklist');
 await expect(pg.query(`UPDATE app."Appointment" SET "completedSteps"=ARRAY[0,0] WHERE id=$1`,[row.id])).rejects.toThrow('Invalid service checklist');
 await pg.query(`UPDATE app."Appointment" SET "completedSteps"=ARRAY[0],status='completed' WHERE id=$1`,[row.id]);
 await expect(pg.query(`UPDATE app."Appointment" SET status='in_service' WHERE id=$1`,[row.id])).rejects.toThrow('immutable');
 await pg.query(`UPDATE app."Appointment" SET "feedbackTokenHash"='test-feedback-token',"feedbackTokenExpiresAt"=now()+interval '7 days' WHERE id=$1`,[row.id]);
});
it('protects closed registers and allows only one open register per location',async()=>{
 const {rows:[row]}=await pg.query<{id:string}>(`INSERT INTO app."CashSession"(id,"salonId","branchId","openedBy","businessDate","openingPaise","updatedAt") VALUES(gen_random_uuid(),$1,$2,$3,'2026-10-29',10000,now()) RETURNING id`,[s1,b1,u1]);
 await expect(pg.query(`INSERT INTO app."CashSession"(id,"salonId","branchId","openedBy","businessDate","openingPaise","updatedAt") VALUES(gen_random_uuid(),$1,$2,$3,'2026-10-30',0,now())`,[s1,b1,u1])).rejects.toThrow();
 await pg.query(`UPDATE app."CashSession" SET "countedPaise"=9000,"expectedPaise"=10000,"closedAt"=now(),"closedBy"=$2 WHERE id=$1`,[row.id,u1]);
 await expect(pg.query(`UPDATE app."CashSession" SET "countedPaise"=10000 WHERE id=$1`,[row.id])).rejects.toThrow('immutable');
});
it('prevents refunding more than collected cash and cross-salon refunds',async()=>{
 const {rows:[booking]}=await pg.query<{id:string}>(`INSERT INTO app."Appointment"(id,"salonId","branchId","customerUserId","startsAt","updatedAt") VALUES(gen_random_uuid(),$1,$2,$3,now(),now()) RETURNING id`,[s1,b1,u1]);
 const {rows:[invoice]}=await pg.query<{id:string}>(`INSERT INTO app."Invoice"(id,"salonId","branchId","appointmentId","customerName","serviceName","totalPaise") VALUES(gen_random_uuid(),$1,$2,$3,'Customer','Service',10000) RETURNING id`,[s1,b1,booking.id]);
 await pg.query(`INSERT INTO app."Payment"(id,"salonId","invoiceId","amountPaise",method) VALUES(gen_random_uuid(),$1,$2,5000,'cash')`,[s1,invoice.id]);
 await pg.query(`INSERT INTO app."Refund"(id,"salonId","branchId","invoiceId","amountPaise",method,reason,"approvedBy","updatedAt") VALUES(gen_random_uuid(),$1,$2,$3,3000,'cash','Correction',$4,now())`,[s1,b1,invoice.id,u1]);
 await expect(pg.query(`INSERT INTO app."Refund"(id,"salonId","branchId","invoiceId","amountPaise",method,reason,"approvedBy","updatedAt") VALUES(gen_random_uuid(),$1,$2,$3,3000,'cash','Correction',$4,now())`,[s1,b1,invoice.id,u1])).rejects.toThrow('collected');
 await expect(pg.query(`INSERT INTO app."Refund"(id,"salonId","branchId","invoiceId","amountPaise",method,reason,"approvedBy","updatedAt") VALUES(gen_random_uuid(),$1,$2,$3,1000,'cash','Wrong tenant',$4,now())`,[s2,b2,invoice.id,u2])).rejects.toThrow();
});
it('requires invoice arithmetic to match preserved base, discount and tax',async()=>{
 await expect(pg.query(`INSERT INTO app."Invoice"(id,"salonId","branchId","customerName","serviceName","basePaise","discountPaise","taxBps","taxPaise","totalPaise") VALUES(gen_random_uuid(),$1,$2,'Customer','Retail',10000,1000,1800,1620,99999)`,[s1,b1])).rejects.toThrow();
 await pg.query(`INSERT INTO app."Invoice"(id,"salonId","branchId","customerName","serviceName","basePaise","discountPaise","taxBps","taxPaise","totalPaise") VALUES(gen_random_uuid(),$1,$2,'Customer','Retail',10000,1000,1800,1620,10620)`,[s1,b1]);
});
it('prevents cross-tenant operational actors and negative loyalty balances',async()=>{
 await expect(pg.query(`INSERT INTO app."Expense"(id,"salonId","branchId","submittedBy",category,"amountPaise",method,note,"incurredAt","updatedAt") VALUES(gen_random_uuid(),$1,$2,$3,'rent',10000,'cash','Rent',now(),now())`,[s2,b2,u1])).rejects.toThrow();
 const {rows:[customer]}=await pg.query<{id:string}>(`INSERT INTO app."SalonCustomer"(id,"salonId","displayName","updatedAt") VALUES(gen_random_uuid(),$1,'Loyal customer',now()) RETURNING id`,[s1]);
 await expect(pg.query(`INSERT INTO app."LoyaltyAccount"(id,"salonId","customerId",points,"referralCode","updatedAt") VALUES(gen_random_uuid(),$1,$2,-1,'REF',now())`,[s1,customer.id])).rejects.toThrow();
});
it('keeps calendar tokens and operational records behind RLS and immutable ledger grants',async()=>{
 try{await pg.exec('BEGIN; GRANT USAGE ON SCHEMA app TO authenticated; GRANT SELECT ON app."Expense",app."CalendarConnection",app."CalendarJob",app."PortfolioPhoto" TO authenticated; SET LOCAL ROLE authenticated;');for(const table of ['Expense','CalendarConnection','CalendarJob','PortfolioPhoto'])expect((await pg.query('SELECT * FROM app."'+table+'"')).rows).toEqual([]);}finally{await pg.exec('ROLLBACK;');}
 try{await pg.exec('BEGIN; SET LOCAL ROLE saloonsync_runtime;');await expect(pg.query('UPDATE app."Refund" SET reason=\'changed\'')).rejects.toThrow('permission denied');}finally{await pg.exec('ROLLBACK;');}
});
it('keeps location stock separate and derives the global total from balances',async()=>{
 const {rows:[product]}=await pg.query<{id:string}>(`INSERT INTO app."Product"(id,"salonId",name,sku,stock,"pricePaise","updatedAt") VALUES(gen_random_uuid(),$1,'Location product','LOC',0,10000,now()) RETURNING id`,[s1]);
 const {rows:[otherBranch]}=await pg.query<{id:string}>(`INSERT INTO app."Branch"(id,"salonId",name,"updatedAt") VALUES(gen_random_uuid(),$1,'Second location',now()) RETURNING id`,[s1]);
 await pg.query(`INSERT INTO app."LocationStock"(id,"salonId","branchId","productId",stock,"updatedAt") VALUES(gen_random_uuid(),$1,$2,$3,10,now()),(gen_random_uuid(),$1,$4,$3,3,now())`,[s1,b1,product.id,otherBranch.id]);
 expect((await pg.query<{stock:number}>(`SELECT stock FROM app."Product" WHERE id=$1`,[product.id])).rows[0].stock).toBe(13);
 await expect(pg.query(`UPDATE app."LocationStock" SET stock=-1 WHERE "productId"=$1 AND "branchId"=$2`,[product.id,otherBranch.id])).rejects.toThrow();
 await expect(pg.query(`UPDATE app."Product" SET stock=99 WHERE id=$1`,[product.id])).rejects.toThrow('location balance');
 await pg.query(`UPDATE app."LocationStock" SET stock=stock-2 WHERE "productId"=$1 AND "branchId"=$2`,[product.id,b1]);
 expect((await pg.query<{stock:number}>(`SELECT stock FROM app."Product" WHERE id=$1`,[product.id])).rows[0].stock).toBe(11);
 await expect(pg.query(`INSERT INTO app."LocationStock"(id,"salonId","branchId","productId",stock,"updatedAt") VALUES(gen_random_uuid(),$1,$2,$3,1,now())`,[s2,b2,product.id])).rejects.toThrow();
});
it('rolls back an entire multi-visit insert when one recurring slot conflicts',async()=>{
 await pg.query(`INSERT INTO app."Appointment"(id,"salonId","branchId","customerUserId","assignedUserId","startsAt","updatedAt") VALUES(gen_random_uuid(),$1,$2,$3,$3,'2027-08-08T10:00:00Z',now())`,[s1,b1,u1]);
 await expect(pg.query(`INSERT INTO app."Appointment"(id,"salonId","branchId","customerUserId","assignedUserId","startsAt","updatedAt") VALUES(gen_random_uuid(),$1,$2,$3,$3,'2027-08-01T10:00:00Z',now()),(gen_random_uuid(),$1,$2,$3,$3,'2027-08-08T10:00:00Z',now())`,[s1,b1,u1])).rejects.toThrow('already booked');
 expect((await pg.query(`SELECT id FROM app."Appointment" WHERE "salonId"=$1 AND "assignedUserId"=$2 AND "startsAt"='2027-08-01T10:00:00Z'`,[s1,u1])).rows).toEqual([]);
});
it('prevents a customer origin location from belonging to another salon',async()=>{
 await expect(pg.query(`INSERT INTO app."SalonCustomer"(id,"salonId","originBranchId","displayName","updatedAt") VALUES(gen_random_uuid(),$1,$2,'Wrong location',now())`,[s1,b2])).rejects.toThrow();
});
it('bulk service stock deduction is atomic and records each product movement',async()=>{
 const {completionEffects}=await import('../../src/lib/operations/bookings');const {Prisma}=await import('../../src/generated/prisma/client');
 const {rows:products}=await pg.query<{id:string}>(`INSERT INTO app."Product"(id,"salonId",name,sku,"pricePaise","updatedAt") VALUES(gen_random_uuid(),$1,'Bulk A','BULK-A',1000,now()),(gen_random_uuid(),$1,'Bulk B','BULK-B',1000,now()) RETURNING id`,[s1]);
 await pg.query(`INSERT INTO app."LocationStock"(id,"salonId","branchId","productId",stock,"updatedAt") VALUES(gen_random_uuid(),$1,$2,$3,10,now()),(gen_random_uuid(),$1,$2,$4,1,now())`,[s1,b1,products[0].id,products[1].id]);
 const {rows:[visit]}=await pg.query<{id:string}>(`INSERT INTO app."Appointment"(id,"salonId","branchId","customerUserId","startsAt",status,"updatedAt") VALUES(gen_random_uuid(),$1,$2,$3,now(),'completed',now()) RETURNING id`,[s1,b1,u1]);
 const tx={$queryRaw:async(parts:TemplateStringsArray,...values:unknown[])=>{const q=Prisma.sql(parts,...values);return(await pg.query(q.text,[...q.values])).rows;},stockMovement:{createMany:async({data}:{data:Record<string,unknown>[]})=>{for(const row of data)await pg.query(`INSERT INTO app."StockMovement"(id,"salonId","branchId","productId","appointmentId","actorUserId",quantity,reason,"updatedAt") VALUES(gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,now())`,[row.salonId,row.branchId,row.productId,row.appointmentId,row.actorUserId,row.quantity,row.reason]);}},salon:{findUniqueOrThrow:async()=>({settings:{}})}};
 const c={salonId:s1,user:{id:u1}},row={id:visit.id,salonId:s1,branchId:b1,assignedUserId:null,pricePaise:0,stockRecipe:products.map(p=>({productId:p.id,quantity:2})),commissionEligible:false,salonCustomerId:null};
 try{await pg.exec('BEGIN');await expect(completionEffects(tx as never,c as never,row)).rejects.toThrow('insufficient stock');}finally{await pg.exec('ROLLBACK');}
 expect((await pg.query<{stock:number}>(`SELECT stock FROM app."LocationStock" WHERE "productId"=$1 AND "branchId"=$2`,[products[0].id,b1])).rows[0].stock).toBe(10);
 await pg.query(`UPDATE app."LocationStock" SET stock=3 WHERE "productId"=$1 AND "branchId"=$2`,[products[1].id,b1]);
 await pg.exec('BEGIN');try{await completionEffects(tx as never,c as never,row);await pg.exec('COMMIT');}catch(error){await pg.exec('ROLLBACK');throw error;}
 expect((await pg.query<{count:number}>(`SELECT count(*)::int AS count FROM app."StockMovement" WHERE "appointmentId"=$1`,[visit.id])).rows[0].count).toBe(2);
});



it('keeps loyalty codes customer-bound and links consumption to an invoice in the same salon',async()=>{
 const customer='a1111111-1111-4111-8111-111111111111',other='b1111111-1111-4111-8111-111111111111',invoice='c1111111-1111-4111-8111-111111111111',redemption='d1111111-1111-4111-8111-111111111111';
 try{
  await pg.exec('BEGIN');
  await pg.query(`INSERT INTO app."SalonCustomer" (id,"salonId","displayName","updatedAt") VALUES ($1,$2,'Own',now()),($3,$4,'Other',now())`,[customer,s1,other,s2]);
  await pg.query(`INSERT INTO app."Invoice" (id,"salonId","branchId","salonCustomerId","customerName","serviceName","basePaise","discountPaise","loyaltyPoints","totalPaise") VALUES ($1,$2,$3,$4,'Own','Haircut',50000,10000,100,40000)`,[invoice,s1,b1,customer]);
  await pg.query(`INSERT INTO app."LoyaltyRedemption" (id,"salonId","customerId","codeHash",points,"expiresAt") VALUES ($1,$2,$3,'hash',100,now()+interval '1 day')`,[redemption,s1,customer]);
  const consumed=await pg.query(`UPDATE app."LoyaltyRedemption" SET "invoiceId"=$1,"redeemedAt"=now() WHERE id=$2 AND "salonId"=$3 AND "customerId"=$4 AND "redeemedAt" IS NULL AND "expiresAt">now() RETURNING id`,[invoice,redemption,s1,customer]);
  expect(consumed.rows).toHaveLength(1);
  const replay=await pg.query(`UPDATE app."LoyaltyRedemption" SET "invoiceId"=$1,"redeemedAt"=now() WHERE id=$2 AND "redeemedAt" IS NULL RETURNING id`,[invoice,redemption]);
  expect(replay.rows).toHaveLength(0);
  await pg.exec('SAVEPOINT tenant');
  await expect(pg.query(`INSERT INTO app."LoyaltyRedemption" (id,"salonId","customerId","codeHash",points,"expiresAt") VALUES (gen_random_uuid(),$1,$2,'foreign',100,now()+interval '1 day')`,[s1,other])).rejects.toThrow('redemption_customer_fk');
  await pg.exec('ROLLBACK TO SAVEPOINT tenant');
  await expect(pg.query(`INSERT INTO app."Invoice" (id,"salonId","customerName","serviceName","basePaise","discountPaise","loyaltyPoints","totalPaise") VALUES (gen_random_uuid(),$1,'Own','Haircut',50000,0,100,50000)`,[s1])).rejects.toThrow('invoice_loyalty_points_check');
 }finally{await pg.exec('ROLLBACK');}
});

it('awards loyalty with one tenant-checked statement and rolls everything back if the ledger fails',async()=>{
 const customer='a2222222-2222-4222-8222-222222222222';
 const context={salonId:s1,user:{id:u1}} as never;
 try{await pg.exec('BEGIN');await pg.query(`INSERT INTO app."SalonCustomer" (id,"salonId","displayName","updatedAt") VALUES ($1,$2,'Reward customer',now())`,[customer,s1]);
  const input={customerId:customer,points:50,reason:'Visit',membershipName:'Gold',referralCode:'TESTCODE'};
  let query=loyaltyAwardQuery(context,input);let result=await pg.query<{points:number}>(query.text,query.values);expect(result.rows[0].points).toBe(50);
  query=loyaltyAwardQuery(context,{...input,points:75});result=await pg.query<{points:number}>(query.text,query.values);expect(result.rows[0].points).toBe(125);
  expect((await pg.query<{count:number}>(`SELECT count(*)::int count FROM app."LoyaltyEntry" WHERE "customerId"=$1`,[customer])).rows[0].count).toBe(2);
  await pg.exec('SAVEPOINT failed_audit');query=loyaltyAwardQuery({salonId:s1,user:{id:'f9999999-9999-4999-8999-999999999999'}} as never,input);await expect(pg.query(query.text,query.values)).rejects.toThrow();await pg.exec('ROLLBACK TO SAVEPOINT failed_audit');
  expect((await pg.query<{points:number}>(`SELECT points FROM app."LoyaltyAccount" WHERE "customerId"=$1`,[customer])).rows[0].points).toBe(125);
  query=loyaltyAwardQuery({salonId:s2,user:{id:u2}} as never,input);expect((await pg.query(query.text,query.values)).rows).toHaveLength(0);
 }finally{await pg.exec('ROLLBACK');}
});
it('keeps combined checkout choices within authorized branches',async()=>{
 const first='a3333333-3333-4333-8333-333333333333',other='b3333333-3333-4333-8333-333333333333';
 try{await pg.exec('BEGIN');await pg.query(`INSERT INTO app."SalonCustomer" (id,"salonId","originBranchId","displayName","updatedAt") VALUES ($1,$2,$3,'Allowed',now()),($4,$5,$6,'Foreign',now())`,[first,s1,b1,other,s2,b2]);
  const query=checkoutCustomersQuery({salonId:s1,membership:{branchScope:'selected'},branches:[{id:b1}]} as never);const rows=await pg.query<{id:string;points:number}>(query.text,query.values);expect(rows.rows.find(r=>r.id===first)?.points).toBe(0);expect(rows.rows.some(r=>r.id===other)).toBe(false);
 }finally{await pg.exec('ROLLBACK');}
});
it('loads receipt lines, payments and refunds in one scoped query without multiplying totals',async()=>{
 const invoice='a4444444-4444-4444-8444-444444444444';
 try{await pg.exec('BEGIN');await pg.query(`INSERT INTO app."Invoice" (id,"salonId","branchId","customerName","serviceName","basePaise","totalPaise") VALUES ($1,$2,$3,'Receipt','Haircut',10000,10000)`,[invoice,s1,b1]);await pg.query(`INSERT INTO app."InvoiceLine" (id,"salonId","invoiceId",description,quantity,"unitPricePaise","updatedAt") VALUES (gen_random_uuid(),$1,$2,'Haircut',1,10000,now())`,[s1,invoice]);await pg.query(`INSERT INTO app."Payment" (id,"salonId","invoiceId","amountPaise",method) VALUES (gen_random_uuid(),$1,$2,10000,'upi')`,[s1,invoice]);
  let query=receiptQuery({salonId:s1,branches:[{id:b1}]} as never,invoice);const rows=await pg.query<{lines:unknown[];payments:unknown[];refunds:unknown[]}>(query.text,query.values);expect(rows.rows[0].lines).toHaveLength(1);expect(rows.rows[0].payments).toHaveLength(1);expect(rows.rows[0].refunds).toHaveLength(0);
  query=receiptQuery({salonId:s1,branches:[{id:b2}]} as never,invoice);expect((await pg.query(query.text,query.values)).rows).toHaveLength(0);
 }finally{await pg.exec('ROLLBACK');}
});
