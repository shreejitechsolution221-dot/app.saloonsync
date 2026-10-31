import {PGlite} from '@electric-sql/pglite';
import {beforeAll,afterAll,beforeEach,afterEach,it,expect} from 'vitest';
import {workspaceQuery,workspaceContextQuery,type WorkspaceRow,type WorkspaceContextRow} from '../../src/lib/salon/workspace-query';
let pg:PGlite;
const u='11111111-1111-4111-8111-111111111111', other='22222222-2222-4222-8222-222222222222',s1='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',s2='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',m1='cccccccc-cccc-4ccc-8ccc-cccccccccccc',m2='dddddddd-dddd-4ddd-8ddd-dddddddddddd',b1='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',b2='ffffffff-ffff-4fff-8fff-ffffffffffff';
async function load(selected?:string,user=u){const q=workspaceQuery(user,selected);return (await pg.query<WorkspaceRow>(q.text,[...q.values])).rows;}
beforeAll(async()=>{
 pg=new PGlite();await pg.exec(`CREATE SCHEMA app;
 CREATE TABLE app."User"(id uuid,"disabledAt" timestamptz,"displayName" text DEFAULT 'Member',"mobileNumber" text,"salonRegistrationName" text);
 CREATE TABLE app."Salon"(id uuid,name text,status text);
 CREATE TABLE app."SalonMembership"(id uuid,"salonId" uuid,"userId" uuid,role text,"branchScope" text,status text);
 CREATE TABLE app."Branch"(id uuid,"salonId" uuid,name text,status text);
 CREATE TABLE app."MembershipBranchAccess"("membershipId" uuid,"salonId" uuid,"branchId" uuid);
 INSERT INTO app."User"(id,"disabledAt") VALUES('${u}',NULL),('${other}',NULL);
 INSERT INTO app."Salon" VALUES('${s1}','Salon A','active'),('${s2}','Salon B','active');
 INSERT INTO app."SalonMembership" VALUES('${m1}','${s1}','${u}','manager','selected','active'),('${m2}','${s2}','${u}','admin','all','active');
 INSERT INTO app."Branch" VALUES('${b1}','${s1}','Allowed','active'),('${b2}','${s1}','Unassigned','active'),(gen_random_uuid(),'${s2}','Other salon','active');
 INSERT INTO app."MembershipBranchAccess" VALUES('${m1}','${s1}','${b1}');`);
});
beforeEach(async()=>{await pg.exec('BEGIN');});afterEach(async()=>{await pg.exec('ROLLBACK');});afterAll(async()=>{await pg.close();});
it('returns only selected branches in the authorized workspace',async()=>{const rows=await load(s1);expect(rows).toHaveLength(1);expect(rows[0].role).toBe('manager');expect(rows[0].branches.map(b=>b.id)).toEqual([b1]);});
it('requires selection when multiple memberships are active',async()=>{expect(await load()).toEqual([]);});
it('does not trust forged or SQL-injected workspace cookies',async()=>{expect(await load("' OR 1=1 --")).toEqual([]);expect(await load('00000000-0000-4000-8000-000000000000')).toEqual([]);});
it('never uses another user membership',async()=>{expect(await load(s1,other)).toEqual([]);});
it('automatically chooses a sole remaining active membership',async()=>{await pg.query('UPDATE app."SalonMembership" SET status=$1 WHERE id=$2',['revoked',m2]);expect((await load(s2))[0].salonId).toBe(s1);});
it('rejects disabled accounts even when membership is active',async()=>{await pg.query('UPDATE app."User" SET "disabledAt"=now() WHERE id=$1',[u]);expect(await load(s1)).toEqual([]);});
it('does not select suspended salon memberships',async()=>{await pg.query('UPDATE app."Salon" SET status=$1 WHERE id=$2',['suspended',s1]);expect((await load(s1))[0].salonId).toBe(s2);});
it('never returns suspended branches or foreign branch grants',async()=>{await pg.query('UPDATE app."Branch" SET status=$1 WHERE id=$2',['suspended',b1]);await pg.query('INSERT INTO app."MembershipBranchAccess" SELECT $1,$2,id FROM app."Branch" WHERE "salonId"=$3',[m1,s1,s2]);expect((await load(s1))[0].branches).toEqual([]);});
it('fails closed for unexpected branch scopes',async()=>{await pg.query('UPDATE app."SalonMembership" SET "branchScope"=$1 WHERE id=$2',['unknown',m1]);expect((await load(s1))[0].branches).toEqual([]);});
async function context(selected?:string,user=u){const q=workspaceContextQuery(user,selected);return(await pg.query<WorkspaceContextRow>(q.text,[...q.values])).rows;}
it('combines the current profile with exactly the original authorized workspace',async()=>{
 const [row]=await context(s1);expect(row.id).toBe(u);expect(row.displayName).toBe('Member');expect(row.workspace).toEqual((await load(s1))[0]);
});
it('returns disabled state without any authorized workspace data',async()=>{
 await pg.query('UPDATE app."User" SET "disabledAt"=now() WHERE id=$1',[u]);const [row]=await context(s1);expect(row.disabledAt).toBeTruthy();expect(row.workspace).toBeNull();
});
it('keeps foreign identities and forged selection parameters isolated',async()=>{
 expect((await context(s1,other))[0].workspace).toBeNull();expect((await context("' OR 1=1 --"))[0].workspace).toBeNull();
 expect(await context(s1,'99999999-9999-4999-8999-999999999999')).toEqual([]);
});
