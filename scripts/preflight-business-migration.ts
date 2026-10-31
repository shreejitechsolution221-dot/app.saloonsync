import {config} from 'dotenv';
import pg from 'pg';
config({path:'.env.local',quiet:true});
const client=new pg.Client({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:10000});
try{await client.connect();const result=await client.query(`SELECT (SELECT count(*)::int FROM app."Salon") AS salons,(SELECT count(*)::int FROM app."Appointment") AS appointments,(SELECT count(*)::int FROM app."Appointment" WHERE status='completed') AS completion_backfills,(SELECT count(*)::int FROM app."Invoice") AS invoice_backfills,(SELECT pg_total_relation_size('app."Appointment"'))::text AS appointment_bytes,(SELECT pg_total_relation_size('app."Invoice"'))::text AS invoice_bytes,to_regclass('app."Expense"') IS NOT NULL AS expansion_already_present`);console.log(JSON.stringify(result.rows[0]));}finally{await client.end();}
