import {config} from 'dotenv';
import {mkdir,writeFile} from 'node:fs/promises';
config({path:'.env.local.seoul.bak',quiet:true});
const {db}=await import('../src/lib/db');
const {checkoutCustomers}=await import('../src/lib/operations/checkout-options');
const {receiptDocument,receiptQuery}=await import('../src/lib/operations/receipt-query');
const {checkoutCustomersQuery}=await import('../src/lib/operations/checkout-options');
const {withDatabaseTiming}=await import('../src/lib/performance/database-timing');
const median=(x:number[])=>[...x].sort((a,b)=>a-b)[Math.floor(x.length/2)];
try{
 await db.$executeRaw`SET default_transaction_read_only=on`;
 const member=await db.salonMembership.findFirst({where:{role:'owner',status:'active'},select:{salonId:true,userId:true}});if(!member)throw new Error('No owner fixture available');
 const branches=await db.branch.findMany({where:{salonId:member.salonId,status:'active'},select:{id:true,name:true}});
 const context={salonId:member.salonId,user:{id:member.userId},membership:{branchScope:'all'},branches,availableBranches:branches,selectedBranchId:undefined} as never;
 const oldOptions=async()=>{const customers=await db.salonCustomer.findMany({where:{salonId:member.salonId},select:{id:true,displayName:true,phone:true},orderBy:{displayName:'asc'},take:500});const accounts=await db.loyaltyAccount.findMany({where:{salonId:member.salonId,customerId:{in:customers.map(c=>c.id)}},select:{customerId:true,points:true}});return customers.map(c=>({...c,points:accounts.find(a=>a.customerId===c.id)?.points??0}));};
 const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
 const sort=(rows:{id:string}[])=>[...rows].sort((a,b)=>a.id.localeCompare(b.id));
 if(!same(sort(await oldOptions()),sort(await checkoutCustomers(context))))throw new Error('Checkout scope mismatch');
 const rows:{path:string;beforeQueries:number;afterQueries:number;beforeMedianMs:number;afterMedianMs:number;scopeEquivalent:boolean}[]=[];
 async function time(path:string,before:()=>Promise<unknown>,after:()=>Promise<unknown>,beforeQueries:number,afterQueries:number){const a:number[]=[],b:number[]=[];for(let i=0;i<5;i++){let start=performance.now();await before();a.push(performance.now()-start);start=performance.now();await after();b.push(performance.now()-start);}rows.push({path,beforeQueries,afterQueries,beforeMedianMs:Math.round(median(a)),afterMedianMs:Math.round(median(b)),scopeEquivalent:true});}
 await time('checkout customer/loyalty options',oldOptions,()=>checkoutCustomers(context),2,1);
 const invoice=await db.invoice.findFirst({where:{salonId:member.salonId,branchId:{in:branches.map(b=>b.id)}},select:{id:true}});
 if(invoice){const before=async()=>{const i=await db.invoice.findFirst({where:{id:invoice.id,salonId:member.salonId,branchId:{in:branches.map(b=>b.id)}},include:{payments:true}});const [lines,refunds]=await Promise.all([db.invoiceLine.findMany({where:{salonId:member.salonId,invoiceId:invoice.id},orderBy:{createdAt:'asc'}}),db.refund.findMany({where:{salonId:member.salonId,invoiceId:invoice.id},orderBy:{createdAt:'asc'}})]);return {i,lines,refunds};};const old=await before(),next=await receiptDocument(context,invoice.id);if(!next||old.i?.totalPaise!==next.totalPaise||old.lines.length!==next.lines.length||old.refunds.length!==next.refunds.length||old.i.payments.length!==next.payments.length)throw new Error('Receipt mismatch');await time('receipt document',before,()=>receiptDocument(context,invoice.id),3,1);}
 const plans=[];
 const queries=[['checkout',checkoutCustomersQuery(context)] as const,...(invoice?[['receipt',receiptQuery(context,invoice.id)] as const]:[])];
 for(const [name,query]of queries){const result=await db.$queryRawUnsafe<Record<string,unknown>[]>(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query.text}`,...query.values);const data=(result[0]['QUERY PLAN'] as {Plan:{'Node Type':string};'Planning Time':number;'Execution Time':number}[])[0];plans.push({query:name,node:data.Plan['Node Type'],planningMs:data['Planning Time'],executionMs:data['Execution Time']});}
 await withDatabaseTiming('profile.telemetry-probe',async()=>{await db.$queryRaw`SELECT 1`;await db.$queryRaw`SELECT 1`;});
 await mkdir('.cache/performance',{recursive:true});await writeFile('.cache/performance/query-profile.json',JSON.stringify({rows,plans,note:'Read-only SQL-path comparison on Seoul, five warm samples. Not authenticated HTTP page timings.'},null,2));console.log(JSON.stringify({rows,plans}));
}catch(error){console.error(JSON.stringify({event:'query_profile.failed',code:(error as {code?:string}).code??'validation'}));process.exitCode=1;}
finally{await db.$disconnect();}
