import { PGlite } from '@electric-sql/pglite';
import { beforeAll, afterAll, expect, it } from 'vitest';
import { workspaceChoicesQuery, customerBookingsQuery, serviceCatalogQuery, type WorkspaceChoice, type CustomerBookingRow, type ServiceCatalogRow } from '../../src/lib/salon/page-queries';
import type { Prisma } from '../../src/generated/prisma/client';
let pg: PGlite;
const u='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',s='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',foreign='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',m='cccccccc-cccc-4ccc-8ccc-cccccccccccc',m2='dddddddd-dddd-4ddd-8ddd-dddddddddddd',b='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',unassigned='ffffffff-ffff-4fff-8fff-ffffffffffff',fb='99999999-9999-4999-8999-999999999999';
async function run<T>(query: Prisma.Sql) { return (await pg.query<T>(query.text,[...query.values])).rows; }
beforeAll(async()=>{
 pg=new PGlite();await pg.exec(`CREATE SCHEMA app;
 CREATE TABLE app."Salon"(id uuid,name text,status text);
 CREATE TABLE app."SalonMembership"(id uuid,"salonId" uuid,"userId" uuid,status text,role text,"branchScope" text,"createdAt" timestamptz DEFAULT now());
 CREATE TABLE app."Branch"(id uuid,"salonId" uuid,name text,address text,status text);
 CREATE TABLE app."MembershipBranchAccess"("membershipId" uuid,"salonId" uuid,"branchId" uuid);
 CREATE TABLE app."Appointment"(id uuid DEFAULT gen_random_uuid(),"salonId" uuid,"branchId" uuid,"customerUserId" uuid,"assignedUserId" uuid,"serviceName" text,"startsAt" timestamptz DEFAULT now(),status text DEFAULT 'confirmed');
 CREATE TABLE app."Service"(id uuid DEFAULT gen_random_uuid(),"salonId" uuid,name text,category text DEFAULT 'Hair',"durationMinutes" int DEFAULT 30,"pricePaise" int DEFAULT 10000,active boolean DEFAULT true,kind text DEFAULT 'service',checklist text[] DEFAULT '{}',"commissionEligible" boolean DEFAULT false,"commissionBps" int,"eligibleUserIds" text[] DEFAULT '{}');
 INSERT INTO app."Salon" VALUES('${s}','Own salon','active'),('${foreign}','Other salon','active');
 INSERT INTO app."SalonMembership"(id,"salonId","userId",status,role,"branchScope") VALUES('${m}','${s}','${u}','active','staff','selected'),('${m2}','${foreign}','${u}','active','owner','all'),(gen_random_uuid(),'${s}','${other}','revoked','staff','all');
 INSERT INTO app."Branch" VALUES('${b}','${s}','Allowed','Main road','active'),('${unassigned}','${s}','Unassigned','Private road','active'),('${fb}','${foreign}','Other branch','Other road','active');
 INSERT INTO app."MembershipBranchAccess" VALUES('${m}','${s}','${b}'),('${m}','${s}','${fb}');
 INSERT INTO app."Appointment"("salonId","branchId","customerUserId","assignedUserId","serviceName") VALUES('${s}','${b}','${u}','${u}','Cut'),('${s}','${b}','${other}','${other}','Color'),('${foreign}','${fb}','${other}','${u}','Other service');
 INSERT INTO app."Service"("salonId",name) VALUES('${s}','Cut'),('${s}','Color'),('${foreign}','Cut');
 INSERT INTO app."Service"("salonId",name,active) VALUES('${s}','Archived',false);`);
});
afterAll(async()=>{await pg.close();});
it('shows only the same user workspaces and permitted branches, including addresses',async()=>{
 const rows=await run<WorkspaceChoice>(workspaceChoicesQuery(u));expect(rows).toHaveLength(2);
 expect(rows.find(r=>r.salonId===s)?.salon.branches).toEqual([{id:b,name:'Allowed',address:'Main road'}]);
 expect(rows.find(r=>r.salonId===foreign)?.salon.branches.map(x=>x.id)).toEqual([fb]);
 expect((await run<WorkspaceChoice>(workspaceChoicesQuery(other)))[0].salon.branches).toEqual([]);
});
it('returns only the authenticated customer bookings with the existing nested shape',async()=>{
 const rows=await run<CustomerBookingRow>(customerBookingsQuery(u));expect(rows).toHaveLength(1);
 expect(rows[0].salon).toEqual({name:'Own salon'});expect(rows[0].branch).toEqual({name:'Allowed'});expect(rows[0].startsAt).toBeInstanceOf(Date);
});
it('preserves staff service-history visibility without reading the full history into JavaScript',async()=>{
 const rows=await run<ServiceCatalogRow>(serviceCatalogQuery({salonId:s,userId:u,staff:true,administrator:false}));expect(rows.map(x=>x.name)).toEqual(['Cut']);
 const all=await run<ServiceCatalogRow>(serviceCatalogQuery({salonId:s,userId:u,staff:false,administrator:true}));expect(all.map(x=>x.name).sort()).toEqual(['Archived','Color','Cut']);
 const active=await run<ServiceCatalogRow>(serviceCatalogQuery({salonId:s,userId:u,staff:false,administrator:false}));expect(active.map(x=>x.name).sort()).toEqual(['Color','Cut']);
});
it('parameterizes identities instead of interpolating SQL text',()=>{
 const input="' OR 1=1 --";for(const q of [workspaceChoicesQuery(input),customerBookingsQuery(input),serviceCatalogQuery({salonId:input,userId:u,staff:true,administrator:false})]){expect(q.text).not.toContain(input);expect(q.values).toContain(input);}
});
