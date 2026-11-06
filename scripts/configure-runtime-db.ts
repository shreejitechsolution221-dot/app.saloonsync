import {config} from 'dotenv';
import {readFile,writeFile,unlink} from 'node:fs/promises';
import {parse} from 'dotenv';
import {randomBytes} from 'node:crypto';
import {Client} from 'pg';
import {TLSSocket} from 'node:tls';
import {runtimeProvisioningTarget} from '../src/lib/performance/runtime-provisioning';
config({path:'.env.local',quiet:true});
config({ path: '.env.migrations.local', quiet: true });
const staged=process.env.RUNTIME_TARGET==='staged';
if(staged){process.env.DATABASE_URL=process.env.NEW_DATABASE_URL;process.env.DIRECT_URL=process.env.NEW_DIRECT_URL;}
if(!process.env.DIRECT_URL || !process.env.DATABASE_URL)throw new Error('Both database connections are required.');
const source=new URL(process.env.DATABASE_URL);
const role='saloonsync_web';
const already=decodeURIComponent(source.username).split('.')[0]===role;
const admin=new Client({connectionString:process.env.DIRECT_URL,connectionTimeoutMillis:10000});
const pendingFile=staged?'.env.runtime-staged.pending.local':'.env.runtime.pending.local';
let runtime:Client|undefined;
let step='connect-administrator';
try{
 const target=already?new URL(source):runtimeProvisioningTarget(source.toString(),process.env.DIRECT_URL,role);
 if(!already){
  await admin.connect();
  step='provision-runtime-role';
  await admin.query('ALTER ROLE saloonsync_runtime NOLOGIN');
  const found=await admin.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role]);
  if(!found.rowCount)await admin.query('CREATE ROLE saloonsync_web NOLOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS');
  await admin.query('GRANT saloonsync_runtime TO saloonsync_web');
  const existing=await admin.query('SELECT rolsuper,rolbypassrls,rolcreaterole,rolcreatedb FROM pg_roles WHERE rolname=$1',[role]);
  step='validate-provisioned-role';
  if(existing.rowCount!==1 || Object.values(existing.rows[0]).some(Boolean))throw new Error('Unsafe role privileges.');
  let pending:string|undefined;
  try{pending=parse(await readFile(pendingFile,'utf8')).DATABASE_URL;}catch(error){if((error as {code?:string}).code!=='ENOENT')throw error;}
  if(pending){
   const saved=new URL(pending);
   if(saved.hostname!==target.hostname||saved.pathname!==target.pathname||saved.username!==target.username||saved.port!==target.port)throw new Error('Pending runtime target mismatch.');
   target.password=decodeURIComponent(saved.password);
  }else{
   const password=randomBytes(48).toString('base64url');
   await admin.query(`ALTER ROLE saloonsync_web LOGIN PASSWORD '${password}'`);
   target.password=password;
   await writeFile(pendingFile,'DATABASE_URL='+JSON.stringify(target.toString())+'\n',{mode:0o600});
  }
 }
 step='connect-runtime';
 for(const [attempt,delay] of [0,15000,30000].entries()){
  if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
  runtime=new Client({connectionString:target.toString(),connectionTimeoutMillis:10000});
  try{await runtime.connect();break;}catch(error){await runtime.end().catch(()=>{});if((error as {code?:string}).code!=='28P01'||attempt===2)throw error;console.log(JSON.stringify({event:'runtime.authentication_retry',attempt:attempt+1}));}
 }
 if(!runtime)throw new Error('Runtime connection unavailable.');
 step='validate-runtime-transport';
 if(!['localhost','127.0.0.1','[::1]'].includes(target.hostname) && (!(runtime.connection.stream instanceof TLSSocket) || !runtime.connection.stream.authorized))throw new Error('Runtime TLS verification failed.');
 step='validate-runtime-role';
 const result=await runtime.query('SELECT rolsuper,rolbypassrls,rolcreaterole,rolcreatedb FROM pg_roles WHERE rolname=current_user');
 if(Object.values(result.rows[0]).some(Boolean))throw new Error('Unsafe runtime privileges.');
 step='verify-runtime-permissions';
 await runtime.query('SELECT id FROM app."User" LIMIT 0');
 await runtime.query('SELECT app.registered_email_exists($1::text)',['runtime-connectivity-check@nonexistent.invalid']);
 await runtime.query('BEGIN');
 try{await runtime.query('INSERT INTO app."RateLimit" (key,count,"resetsAt") VALUES ($1,1,now())',['runtime-security-check-'+randomBytes(12).toString('hex')]);}
 finally{await runtime.query('ROLLBACK');}
 if(!already){
  step='save-local-connection';
  const contents=await readFile('.env.local','utf8');
  const key=staged?'NEW_DATABASE_URL':'DATABASE_URL';
  const updated=contents.replace(new RegExp('^'+key+'=.*$','m'),()=>key+'='+JSON.stringify(target.toString()));
  if(updated===contents)throw new Error('DATABASE_URL entry not found.');
  await writeFile('.env.local',updated);
  await unlink(pendingFile).catch(error=>{if((error as {code?:string}).code!=='ENOENT')throw error;});
 }
 console.log(staged?'Restricted Mumbai runtime staged. Active connection unchanged.':'Restricted runtime connection verified. DATABASE_URL configured; DIRECT_URL retained for migrations.');
}catch(error){
 const code=(error as {code?:string}).code;
 const message=error instanceof Error&&['Unsafe role privileges.','Unsafe runtime privileges.','DATABASE_URL entry not found.'].includes(error.message)?error.message:undefined;
 console.error(JSON.stringify({event:'runtime.setup_failed',step,code:code&&/^[A-Za-z0-9_]{1,32}$/.test(code)?code:'configuration-check',reason:message,configurationRetained:true}));
 process.exitCode=1;
}finally{await runtime?.end().catch(()=>{});await admin.end().catch(()=>{});}
