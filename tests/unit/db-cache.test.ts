import {createHash} from 'node:crypto';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({Client:vi.fn(function(){return {$disconnect:vi.fn().mockResolvedValue(undefined),$on:vi.fn(),generation:'current'};}),Adapter:vi.fn()}));
vi.mock('@/generated/prisma/client',()=>({PrismaClient:m.Client,Prisma:{InvitationScalarFieldEnum:{id:'id',staffProfileId:'staffProfileId'}}}));
vi.mock('@prisma/adapter-pg',()=>({PrismaPg:m.Adapter}));
const cache=globalThis as unknown as {prisma?:unknown;prismaConstructor?:unknown;prismaPool?:unknown;prismaFields?:string;prismaConnection?:string};
const currentFields=JSON.stringify([['InvitationScalarFieldEnum',{id:'id',staffProfileId:'staffProfileId'}]]);
beforeEach(()=>{vi.resetModules();vi.clearAllMocks();vi.stubEnv('NODE_ENV','development');delete cache.prisma;delete cache.prismaConstructor;delete cache.prismaPool;cache.prismaFields=currentFields;cache.prismaConnection=createHash('sha256').update(process.env.DATABASE_URL??'').digest('hex');});
afterEach(()=>{delete cache.prisma;delete cache.prismaConstructor;delete cache.prismaPool;delete cache.prismaFields;delete cache.prismaConnection;vi.unstubAllEnvs();});
it('keeps the same pool when another dev bundle has a different constructor identity',async()=>{
 const current={$disconnect:vi.fn().mockResolvedValue(undefined)},pool={};cache.prisma=current;cache.prismaPool=pool;cache.prismaConstructor=function OtherBundleClient(){};
 const {db}=await import('@/lib/db');expect(db).toBe(current);expect(cache.prismaPool).toBe(pool);expect(m.Client).not.toHaveBeenCalled();expect(m.Adapter).not.toHaveBeenCalled();expect(current.$disconnect).not.toHaveBeenCalled();
});
it('reuses a matching generated client across hot reloads',async()=>{
 const current={$disconnect:vi.fn()};cache.prisma=current;cache.prismaConstructor=m.Client;
 const {db}=await import('@/lib/db');expect(db).toBe(current);expect(m.Client).not.toHaveBeenCalled();expect(current.$disconnect).not.toHaveBeenCalled();
});
it('creates one client and reuses it across module reloads',async()=>{
 const first=await import('@/lib/db');vi.resetModules();const second=await import('@/lib/db');
 expect(second.db).toBe(first.db);expect(m.Client).toHaveBeenCalledOnce();
});
it.each([undefined,'old-generated-fields'])('replaces a cached client with missing or obsolete generated fields (%s)',async(fields)=>{
 const old={$disconnect:vi.fn().mockResolvedValue(undefined)};const oldPool={};cache.prisma=old;cache.prismaPool=oldPool;cache.prismaFields=fields;
 const {db}=await import('@/lib/db');expect(db).not.toBe(old);expect(m.Client).toHaveBeenCalledOnce();expect(old.$disconnect).toHaveBeenCalledOnce();expect(cache.prismaPool).not.toBe(oldPool);expect(cache.prismaFields).toBe(currentFields);
 vi.resetModules();expect((await import('@/lib/db')).db).toBe(db);expect(m.Client).toHaveBeenCalledOnce();
});
it('retains one opened development connection without growing the configured pool',async()=>{
 await import('@/lib/db');
 const pool=cache.prismaPool as {options:{min:number;max:number};totalCount:number};
 expect(pool.options.min).toBe(1);expect(pool.options.max).toBe(5);
 expect(pool.totalCount).toBe(0); // No preconnection or background query.
});
it('does not retain extra idle connections in production',async()=>{
 vi.stubEnv('NODE_ENV','production');
 const {databasePoolMetrics}=await import('@/lib/db');
 expect(cache.prismaPool).toBeUndefined();
 expect(databasePoolMetrics()).toContain('saloonsync_db_pool_total 0');
});
it('logs opt-in query timings without parameters or literal values',async()=>{
 vi.stubEnv('DB_TIMING_DEBUG','1');const log=vi.spyOn(console,'info').mockImplementation(()=>{});
 try{await import('@/lib/db');const client=m.Client.mock.results[0].value;const listener=client.$on.mock.calls[0][1];
 listener({duration:180,query:"SELECT id FROM app.\"User\" WHERE id = $1 AND 'private-literal' IS NOT NULL",params:'["private-user-id"]'});
 const output=log.mock.calls[0][0];expect(output).toContain('database.query_timing');expect(output).toContain('180');expect(output).not.toContain('private-literal');expect(output).not.toContain('private-user-id');
 }finally{log.mockRestore();}
});

it('replaces the singleton when the configured database changes region',async()=>{vi.stubEnv('DATABASE_URL','postgresql://test:test@localhost:5432/first');const first=await import('@/lib/db');vi.stubEnv('DATABASE_URL','postgresql://test:test@localhost:5432/second');vi.resetModules();const second=await import('@/lib/db');expect(second.db).not.toBe(first.db);expect(m.Client).toHaveBeenCalledTimes(2);expect(first.db.$disconnect).toHaveBeenCalledOnce();});
