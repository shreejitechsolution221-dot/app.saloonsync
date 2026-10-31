import {config} from 'dotenv';
import {performance} from 'node:perf_hooks';
config({path:process.env.DB_ENV_FILE??'.env.local',quiet:true});
if(process.env.DB_BENCH_TARGET==='mumbai')process.env.DATABASE_URL=process.env.NEW_DATABASE_URL;
const {db}=await import('../src/lib/db');
const rounded=(n:number)=>Math.round(n*100)/100;
try{
 const run=async()=>{const start=performance.now();await db.$queryRaw`SELECT 1`;return performance.now()-start;};
 const connectionSetupMs=await run();const values:number[]=[];
 for(let i=0;i<10;i++)values.push(await run());
 const ordered=[...values].sort((a,b)=>a-b);
 console.log(JSON.stringify({label:process.env.DB_BENCH_LABEL??'configured',samples:10,connectionSetupMs:rounded(connectionSetupMs),minMs:rounded(ordered[0]),medianMs:rounded((ordered[4]+ordered[5])/2),maxMs:rounded(ordered[9]),runsMs:values.map(rounded)}));
}catch(error){console.error(JSON.stringify({event:'database.benchmark_failed',code:(error as {code?:string}).code??'connection',details:'Check the selected environment and database connectivity; credentials are never logged.'}));process.exitCode=1;}
finally{await db.$disconnect();}
