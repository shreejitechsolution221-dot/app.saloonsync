import {config} from 'dotenv';
import {readFile,writeFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {Client} from 'pg';
config({path:'.env.local',quiet:true});
config({ path: '.env.migrations.local', quiet: true });
const staged=process.env.RUNTIME_TARGET==='staged';
if(staged){process.env.DATABASE_URL=process.env.NEW_DATABASE_URL;process.env.DIRECT_URL=process.env.NEW_DIRECT_URL;}
if(!process.env.DIRECT_URL || !process.env.DATABASE_URL)throw new Error('Both database connections are required.');
const source=new URL(process.env.DATABASE_URL);
const role='saloonsync_web';
const already=decodeURIComponent(source.username).split('.')[0]===role;
const admin=new Client({connectionString:process.env.DIRECT_URL,connectionTimeoutMillis:10000});
let runtime:Client|undefined;
try{
 const target=new URL(source);
 if(!already){
  await admin.connect();
  await admin.query('ALTER ROLE saloonsync_runtime NOLOGIN');
  const found=await admin.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role]);
  if(!found.rowCount)await admin.query('CREATE ROLE saloonsync_web NOLOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS');
  await admin.query('GRANT saloonsync_runtime TO saloonsync_web');
  const existing=await admin.query('SELECT rolsuper,rolbypassrls,rolcreaterole,rolcreatedb FROM pg_roles WHERE rolname=$1',[role]);
  if(existing.rowCount!==1 || Object.values(existing.rows[0]).some(Boolean))throw new Error('Unsafe role privileges.');
  const password=randomBytes(48).toString('base64url');
  await admin.query(`ALTER ROLE saloonsync_web LOGIN PASSWORD '${password}'`);
  const username=decodeURIComponent(source.username);const separator=username.indexOf('.');
  target.username=role+(separator<0?'':username.slice(separator));target.password=password;
 }
 runtime=new Client({connectionString:target.toString(),connectionTimeoutMillis:10000});await runtime.connect();
 const result=await runtime.query('SELECT rolsuper,rolbypassrls,rolcreaterole,rolcreatedb FROM pg_roles WHERE rolname=current_user');
 if(Object.values(result.rows[0]).some(Boolean))throw new Error('Unsafe runtime privileges.');
 await runtime.query('SELECT id FROM app."User" LIMIT 0');
 await runtime.query('SELECT app.registered_email_exists($1::text)',['runtime-connectivity-check@nonexistent.invalid']);
 await runtime.query('BEGIN');
 try{await runtime.query('INSERT INTO app."RateLimit" (key,count,"resetsAt") VALUES ($1,1,now())',['runtime-security-check-'+randomBytes(12).toString('hex')]);}
 finally{await runtime.query('ROLLBACK');}
 if(!already){
  const contents=await readFile('.env.local','utf8');
  const key=staged?'NEW_DATABASE_URL':'DATABASE_URL';
  const updated=contents.replace(new RegExp('^'+key+'=.*$','m'),()=>key+'='+JSON.stringify(target.toString()));
  if(updated===contents)throw new Error('DATABASE_URL entry not found.');
  await writeFile('.env.local',updated);
 }
 console.log(staged?'Restricted Mumbai runtime staged. Active connection unchanged.':'Restricted runtime connection verified. DATABASE_URL configured; DIRECT_URL retained for migrations.');
}catch(error){
 console.error('Runtime setup failed; existing app configuration retained. Code:',(error as {code?:string}).code??'configuration-check');
 process.exitCode=1;
}finally{await runtime?.end().catch(()=>{});await admin.end().catch(()=>{});}
