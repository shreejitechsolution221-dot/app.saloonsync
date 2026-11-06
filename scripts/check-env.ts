import { existsSync, readFileSync } from 'node:fs';
import { parse } from 'dotenv';
import nextEnv from '@next/env';
import { Client } from 'pg';
import { TLSSocket } from 'node:tls';
import { auditEnvironment, type EnvironmentFinding } from '../src/lib/config/environment-audit';

const mode=process.env.NODE_ENV ?? 'development';
const { loadEnvConfig } = nextEnv;
const findings: EnvironmentFinding[]=[];
const {combinedEnv:env,loadedEnvFiles}=loadEnvConfig(process.cwd(),mode==='development',{info:()=>{},error:()=>{findings.push({level:'error',code:'ENV_LOAD',keys:[],message:'Next.js could not load an environment file. Check its syntax without sharing secret values.'});}});
for(const file of loadedEnvFiles) {
 const keys=[...file.contents.matchAll(/^\s*([A-Z][A-Z0-9_]*)\s*=/gm)].map(match=>match[1]);
 const duplicates=[...new Set(keys.filter((key,index)=>keys.indexOf(key)!==index))];
 if(duplicates.length)findings.push({level:'error',code:'DUPLICATE_KEYS',keys:duplicates,message:`Duplicate assignments in ${file.path}.`});
}
const migrations=existsSync('.env.migrations.local')?parse(readFileSync('.env.migrations.local','utf8')):{};
findings.push(...auditEnvironment(env,migrations,existsSync));
const major=Number(process.versions.node.split('.')[0]);
if(major<22 || major>=25 || major===22 && Number(process.versions.node.split('.')[1])<12)findings.push({level:'error',code:'NODE_VERSION',keys:[],message:`Node ${process.versions.node} is unsupported. Use the project's pinned Node 24 runtime.`});
if(process.argv.includes('--live')) {
 const client=new Client({connectionString:env.DATABASE_URL || env.POSTGRES_PRISMA_URL || env.POSTGRES_URL,connectionTimeoutMillis:8000,statement_timeout:8000});
 try {
  await client.connect();
  const role=await client.query<{rolsuper:boolean;rolbypassrls:boolean;rolcreaterole:boolean;rolcreatedb:boolean}>('SELECT rolsuper,rolbypassrls,rolcreaterole,rolcreatedb FROM pg_roles WHERE rolname=current_user');
  if(Object.values(role.rows[0]??{}).some(Boolean))findings.push({level:'error',code:'UNSAFE_RUNTIME_ROLE',keys:['DATABASE_URL'],message:'The runtime database role has administrative or RLS-bypass privileges. Restricted runtime provisioning is required.'});
  const probe=await client.query<{ready:boolean}>(`SELECT to_regclass('app."PlatformRecord"') IS NOT NULL AS ready`);
  // pg_stat_ssl describes the pooler-to-database hop, not this client's TLS socket.
  const tls=client.connection.stream instanceof TLSSocket && client.connection.stream.authorized;
  const databaseUrl=new URL(env.DATABASE_URL || env.POSTGRES_PRISMA_URL || env.POSTGRES_URL || '');
  if(!tls && !['localhost','127.0.0.1','[::1]'].includes(databaseUrl.hostname))findings.push({level:'error',code:'LIVE_DATABASE_TLS',keys:['DATABASE_URL'],message:'The live remote runtime connection is not using verified TLS.'});
  if(!probe.rows[0]?.ready)findings.push({level:'warning',code:'PLATFORM_MIGRATION_PENDING',keys:[],message:'The platform-console schema is not present. Its remote migration still requires approval.'});
  await client.query('SELECT app.registered_email_exists($1::text)',['audit-account@nonexistent-saloonsync.invalid']);
  console.log(JSON.stringify({check:'database-and-email-lookup',status:'connected',tlsVerified:tls}));
 } catch(error) { findings.push({level:'error',code:'DATABASE_CONNECTIVITY',keys:['DATABASE_URL'],message:`Database probe failed (${String((error as {code?:string}).code??'connection')}).`}); }
 finally { await client.end().catch(()=>{}); }
 for(const service of ['auth','redis']) {
  if(service==='redis' && (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN))continue;
  try {
   const response=service==='auth'?await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`,{headers:{apikey:env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY??''},signal:AbortSignal.timeout(10000)}):await fetch(`${env.UPSTASH_REDIS_REST_URL}/ping`,{headers:{authorization:`Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`},signal:AbortSignal.timeout(10000)});
   console.log(JSON.stringify({check:service,status:response.ok?'ready':'failed',httpStatus:response.status}));
   if(!response.ok)findings.push({level:'error',code:'SERVICE_CONNECTIVITY',keys:[service==='auth'?'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY':'UPSTASH_REDIS_REST_TOKEN'],message:`The ${service} probe returned HTTP ${response.status}.`});
  } catch { findings.push({level:'error',code:'SERVICE_CONNECTIVITY',keys:[],message:`The ${service} probe could not connect.`}); }
 }
}
for(const finding of findings)console.log(JSON.stringify(finding));
const errors=findings.filter(finding=>finding.level==='error').length;
console.log(JSON.stringify({check:'environment',errors,warnings:findings.filter(finding=>finding.level==='warning').length,secretsPrinted:false}));
if(errors)process.exitCode=1;
