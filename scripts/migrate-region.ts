import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {parse} from 'dotenv';
import {Client} from 'pg';
import {resolve} from 'node:path';
const stage=process.argv[2];
const active=parse(await readFile('.env.local','utf8'));
const source={...parse(await readFile('.env.local.seoul.bak','utf8')),...parse(await readFile('.env.migrations.local.seoul.bak','utf8'))};
const target=active.NEW_DIRECT_URL;
if(!target||!source.DIRECT_URL||!active.NEW_DATABASE_URL)throw new Error('Staged region configuration or Seoul backups are missing.');
if(new URL(target).hostname===new URL(source.DIRECT_URL).hostname)throw new Error('Source and destination must be different projects.');
const directory='.cache/region-transfer';await mkdir(directory,{recursive:true});
const quote=(s:string)=>'"'+s.replaceAll('"','""')+'"';
function pgEnv(connection:string,readOnly=false){
 const u=new URL(connection);return {...process.env,PGHOST:u.hostname,PGPORT:u.port||'5432',PGUSER:decodeURIComponent(u.username),PGPASSWORD:decodeURIComponent(u.password),PGDATABASE:u.pathname.slice(1),PGSSLMODE:'verify-full',...(u.searchParams.has('sslrootcert')?{PGSSLROOTCERT:u.searchParams.get('sslrootcert')!}:{}),PGOPTIONS:readOnly?'-c default_transaction_read_only=on':''};
}
function native(tool:string,args:string[],connection:string,readOnly=false){
 const portable=resolve('.cache/tools/postgresql-client/pgsql/bin',tool+'.exe');
 const result=spawnSync(existsSync(portable)?portable:tool,args,{env:pgEnv(connection,readOnly),encoding:'utf8',windowsHide:true});
 if(result.error)throw new Error(`${tool} is unavailable. Install PostgreSQL client tools and add their bin folder to PATH.`);
 // Never echo stderr: provider errors may contain identities or credentials.
 if(result.status!==0)throw new Error(`${tool} failed (exit ${result.status}). Transfer stopped; active app settings were not changed. Inspect the provider dashboard before retrying.`);
}
async function connect(url:string,readonly=false){const client=new Client({connectionString:url,connectionTimeoutMillis:10000,statement_timeout:30000});await client.connect();if(readonly)await client.query('SET default_transaction_read_only=on');return client;}
async function counts(client:Client){
 const tables=await client.query<{table_schema:string;table_name:string}>(`SELECT table_schema,table_name FROM information_schema.tables WHERE table_schema IN ('app','auth') AND table_type='BASE TABLE' ORDER BY 1,2`);
 if(!tables.rows.length)return [];
 const result=await client.query<{table:string;count:number}>(tables.rows.map(t=>`SELECT '${t.table_schema}.${t.table_name}' AS "table",count(*)::int AS count FROM ${quote(t.table_schema)}.${quote(t.table_name)}`).join(' UNION ALL '));return result.rows;
}
async function compare(){
 const old=await connect(source.DIRECT_URL,true),next=await connect(target,true);
 try{const [a,b]=await Promise.all([counts(old),counts(next)]);const rows=a.map(row=>({table:row.table,seoul:row.count,mumbai:b.find(x=>x.table===row.table)?.count??null,exempt:row.table==='app._prisma_migrations'||row.table==='auth.schema_migrations'}));await writeFile('.cache/performance/region-counts.json',JSON.stringify(rows,null,2));console.table(rows);return rows.every(r=>r.exempt||r.seoul===r.mumbai);}finally{await old.end();await next.end();}
}
try{
 if(stage==='dump'){
  // A single pg_dump snapshot includes accounts and all application data. Managed
  // migration metadata comes from the destination's migrations, never the source.
  native('pg_dump',['--format=plain','--data-only','--no-owner','--no-privileges','--schema=app','--schema=auth','--exclude-table=app._prisma_migrations','--exclude-table=auth.schema_migrations','--exclude-table=app."EmailBlockedDomain"',`--file=${directory}/data.sql`],source.DIRECT_URL,true);
  console.log('Read-only Seoul data snapshot saved under the ignored .cache/region-transfer directory.');
 }else if(stage==='restore'){
  if(!existsSync(`${directory}/data.sql`))throw new Error('Run the dump stage first.');
  const client=await connect(target);
  try{const rows=await counts(client);if(rows.some(r=>!['app._prisma_migrations','auth.schema_migrations','app.EmailBlockedDomain'].includes(r.table)&&r.count>0))throw new Error('Destination is not empty. Refusing to merge, replace or delete data.');}finally{await client.end();}
  const result=spawnSync(process.execPath,[resolve('node_modules/prisma/build/index.js'),'migrate','deploy'],{env:{...process.env,DIRECT_URL:target,DATABASE_URL:target},encoding:'utf8',windowsHide:true});
  if(result.status!==0)throw new Error('Destination migrations failed. Active configuration unchanged.');
  // The migrations seed the signup policy. Require an exact match rather than
  // duplicate 9,963 seed rows or silently discard source policy customizations.
  const oldPolicy=await connect(source.DIRECT_URL,true),newPolicy=await connect(target,true);
  try{const sql=`SELECT md5(string_agg(domain || ':' || "sourceRevision",',' ORDER BY domain)) AS hash FROM app."EmailBlockedDomain"`;const [a,b]=await Promise.all([oldPolicy.query(sql),newPolicy.query(sql)]);if(a.rows[0].hash!==b.rows[0].hash)throw new Error('Signup policy differs from the migration seed. Transfer and verify custom domain-policy rows before restoring; no application data has been copied.');}finally{await oldPolicy.end();await newPolicy.end();}
  // Supabase's documented logical restore method. Trigger suppression is local
  // to this destination transaction, never applied to Seoul or normal app use.
  native('psql',['--single-transaction','--set=ON_ERROR_STOP=1','--command=SET LOCAL session_replication_role = replica',`--file=${directory}/data.sql`,'--command=SET LOCAL session_replication_role = origin'],target);
  const next=await connect(target);try{await next.query('ANALYZE');}finally{await next.end();}
  console.log('Mumbai restore completed. Run verify before cutover.');
 }else if(stage==='verify'){
  if(!await compare())throw new Error('Row counts differ. Cutover is blocked. Metadata migration counts are reported separately.');
  console.log('All non-migration app/Auth table counts match.');
 }else if(stage==='cutover'){
  if(!await compare())throw new Error('Data verification failed. Active configuration unchanged.');
  const original=await connect(source.DIRECT_URL,true);
  try{
   // GoTrue accepts portable base32 TOTP material directly; an enrolled factor
   // alone is not evidence that a project encryption key is needed. Never emit
   // the material itself. Ciphertext/unknown factor formats still block cutover.
   const mfa=await original.query(`SELECT count(*)::int AS count FROM auth.mfa_factors WHERE factor_type='totp' AND NOT coalesce(secret ~ '^[A-Z2-7]{16,128}={0,6}$',false)`);
   const vault=await original.query('SELECT count(*)::int AS count FROM vault.secrets');
   if((mfa.rows[0].count>0||vault.rows[0].count>0)&&active.MIGRATION_ENCRYPTION_KEY_COPIED!=='true')throw new Error('Encrypted Auth/Vault data requires provider encryption-key transfer before cutover. MFA has not been disabled.');
  }finally{await original.end();}
  const runtime=new URL(active.NEW_DATABASE_URL);
  if(!decodeURIComponent(runtime.username).startsWith('saloonsync_web'))throw new Error('Provision the staged restricted runtime first: set RUNTIME_TARGET=staged, then run scripts/configure-runtime-db.ts.');
  const client=await connect(active.NEW_DATABASE_URL,true);try{const r=await client.query('SELECT rolsuper,rolbypassrls,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname=current_user');if(r.rows.length!==1||Object.values(r.rows[0]).some(Boolean))throw new Error('Runtime privileges are unsafe.');}finally{await client.end();}
  let contents=await readFile('.env.local','utf8');
  const values={DATABASE_URL:active.NEW_DATABASE_URL,DIRECT_URL:target,NEXT_PUBLIC_SUPABASE_URL:active.NEW_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:active.NEW_SUPABASE_PUBLISHABLE_KEY};
  for(const [key,value]of Object.entries(values)){if(!value)throw new Error('Incomplete staged configuration.');const pattern=new RegExp('^'+key+'=.*$','m');const line=key+'='+JSON.stringify(value);contents=pattern.test(contents)?contents.replace(pattern,()=>line):contents+'\n'+line+'\n';}
  await writeFile('.env.local',contents);console.log('Verified Mumbai configuration is now active. Rebuild/restart the app; Supabase sessions require signing in to the new project.');
 }else throw new Error('Usage: node --import tsx scripts/migrate-region.ts dump|restore|verify|cutover');
}catch(error){console.error(error instanceof Error&&error.message&&!error.message.includes('postgresql:')?error.message:'Region operation failed; private connection details were suppressed.');process.exitCode=1;}
