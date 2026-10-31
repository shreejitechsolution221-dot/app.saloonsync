import { config } from 'dotenv';
import pg from 'pg';
config({path:'.env.local',quiet:true});
const client=new pg.Client({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:10000});
try{
 await client.connect();
 const tables=await client.query(`SELECT c.relname,c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='app' AND c.relname=ANY($1) ORDER BY c.relname`,[['Service','Product','Invoice','Payment']]);
 if(tables.rows.length!==4||tables.rows.some(r=>!r.relrowsecurity))throw new Error('Missing tables or RLS');
 const privileges=await client.query(`SELECT has_table_privilege(current_user,'app."Payment"','INSERT') AS payment_insert, has_table_privilege(current_user,'app."Invoice"','UPDATE') AS invoice_update, has_table_privilege(current_user,'app."Payment"','UPDATE') AS payment_update`);
 if(!privileges.rows[0].payment_insert||privileges.rows[0].invoice_update||privileges.rows[0].payment_update)throw new Error('Runtime financial grants are incorrect');
 const triggers=await client.query(`SELECT tgname FROM pg_trigger WHERE tgname IN ('booking_no_overlap','payment_balance')`);
 if(triggers.rows.length!==2)throw new Error('Missing financial or booking trigger');
 console.log(JSON.stringify({tables:tables.rows,runtimePrivileges:privileges.rows[0],triggers:triggers.rows.map(r=>r.tgname),status:'verified'}));
}finally{await client.end();}
