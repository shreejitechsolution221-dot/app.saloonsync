import {writeFile,mkdir} from 'node:fs/promises';
const base=process.env.BENCH_ORIGIN??'http://127.0.0.1:3100';
const paths=['/salon/login','/salon/register','/salon/billing','/salon/billing/expenses','/salon/billing/cash','/salon/billing/refunds','/salon/billing/pos','/salon/billing/receipt/11111111-1111-4111-8111-111111111111','/salon/team','/salon/customers','/salon/customers/loyalty'];
const rows=[];
for(const path of paths){
 const samples=[];const statuses=[];
 for(let i=0;i<6;i++){const start=performance.now();const response=await fetch(base+path,{redirect:'manual',signal:AbortSignal.timeout(15000)});await response.arrayBuffer();samples.push(Math.round((performance.now()-start)*100)/100);statuses.push(response.status);}
 const sorted=samples.slice(1).sort((a,b)=>a-b);
 rows.push({route:path.includes('/receipt/')?'/salon/billing/receipt/[invoiceId]':path,coldMs:samples[0],warmMedianMs:sorted[2],warmRunsMs:samples.slice(1),statuses,scope:/\/(login|register)$/.test(path)?'anonymous page render':'anonymous auth boundary only; authenticated page not measured'});
}
const label=process.env.BENCH_LABEL??'baseline';if(!/^[a-z0-9-]+$/.test(label))throw new Error('Invalid benchmark label');
await mkdir('.cache/performance',{recursive:true});await writeFile(`.cache/performance/http-${label}.json`,JSON.stringify(rows,null,2));console.log(JSON.stringify({label,rows},null,2));
