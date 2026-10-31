import {config} from 'dotenv';
import {writeFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import type {Prisma} from '../src/generated/prisma/client';
config({path:'.env.local',quiet:true});
if(!process.env.NEW_DATABASE_URL)throw new Error('Staged Mumbai runtime is required.');
process.env.DATABASE_URL=process.env.NEW_DATABASE_URL;
const {db}=await import('../src/lib/db');
const {loyaltyAwardQuery}=await import('../src/lib/operations/loyalty-award');
const {checkoutLoyalty,consumeCheckoutLoyalty,loyaltyHash}=await import('../src/lib/operations/checkout');
const {cashLock}=await import('../src/lib/operations/finance-locks');
const {audit}=await import('../src/lib/operations/audit');
const {saveError}=await import('../src/lib/operations/save-error');
const rollback=new Error('diagnostic.rollback');
const results:{name:string;passed:boolean;code?:string;sqlState?:string;kind?:string}[]=[];
try{
 const account=await db.loyaltyAccount.findFirst({select:{customerId:true}});
 const customer=await db.salonCustomer.findFirst({where:{...(account?{id:account.customerId}:{}),salon:{memberships:{some:{role:'owner',status:'active'}}}},select:{id:true,salonId:true,displayName:true}});
 if(!customer)throw new Error('No customer fixture available.');
 const owner=await db.salonMembership.findFirstOrThrow({where:{salonId:customer.salonId,role:'owner',status:'active'},select:{userId:true}});
 const branches=await db.branch.findMany({where:{salonId:customer.salonId,status:'active'},select:{id:true,name:true}});
 if(!branches.length)throw new Error('No active location available.');
 const c={salonId:customer.salonId,user:{id:owner.userId},membership:{role:'owner',branchScope:'all'},branches,availableBranches:branches} as never;
 async function check(name:string,work:(tx:Prisma.TransactionClient)=>Promise<void>){
  try{await db.$transaction(async tx=>{await work(tx);throw rollback;});}catch(error){if(error===rollback){results.push({name,passed:true});return;}const e=error as {code?:string;meta?:{driverAdapterError?:{cause?:{originalCode?:string;kind?:string}}}};results.push({name,passed:false,code:e.code,sqlState:e.meta?.driverAdapterError?.cause?.originalCode,kind:e.meta?.driverAdapterError?.cause?.kind});}
 }
 await check('direct invoice, lines, cash payment and audit',async tx=>{
  await cashLock(tx,customer!.salonId,branches[0].id);
  const invoice=await tx.invoice.create({data:{salonId:customer.salonId,branchId:branches[0].id,salonCustomerId:customer.id,customerName:customer.displayName,serviceName:'Rollback diagnostic',basePaise:10000,totalPaise:10000}});
  await tx.invoiceLine.createMany({data:[{salonId:customer.salonId,invoiceId:invoice.id,description:'Rollback diagnostic',quantity:1,unitPricePaise:10000}]});
  const payment=await tx.payment.create({data:{salonId:customer.salonId,invoiceId:invoice.id,amountPaise:10000,method:'cash'}});await audit(tx,c,'payment.recorded',payment.id);
 });
 await check('atomic loyalty award',async tx=>{const rows=await tx.$queryRaw<{id:string;points:number}[]>(loyaltyAwardQuery(c,{customerId:customer.id,points:1,reason:'Rollback diagnostic',membershipName:'',referralCode:randomBytes(6).toString('hex')}));if(!rows.length)throw new Error('No award returned');});
 const existing=await db.invoice.findFirst({where:{branchId:{not:null}},select:{id:true,salonId:true,branchId:true,totalPaise:true}});
 if(existing)await check('record payment on the copied invoice',async tx=>{
  const paid=await tx.payment.aggregate({where:{salonId:existing.salonId,invoiceId:existing.id},_sum:{amountPaise:true}});
  const remaining=existing.totalPaise-(paid._sum.amountPaise??0);if(remaining<=0)return;
  if(existing.branchId)await cashLock(tx,existing.salonId,existing.branchId);
  await tx.payment.create({data:{salonId:existing.salonId,invoiceId:existing.id,amountPaise:Math.min(remaining,100),method:'cash'}});
 });
 await check('overpayment rejected with a clear message',async tx=>{
  const invoice=await tx.invoice.create({data:{salonId:customer.salonId,branchId:branches[0].id,customerName:customer.displayName,serviceName:'Rollback diagnostic',basePaise:100,totalPaise:100}});
  try{await tx.payment.create({data:{salonId:customer.salonId,invoiceId:invoice.id,amountPaise:101,method:'upi'}});}catch(error){if(saveError(error,'diagnostic.overpayment').startsWith('The amount exceeds'))return;throw error;}
  throw new Error('Overpayment was accepted');
 });
 await check('loyalty code and redemption',async tx=>{
  await tx.$queryRaw(loyaltyAwardQuery(c,{customerId:customer.id,points:1,reason:'Rollback diagnostic',membershipName:'',referralCode:randomBytes(6).toString('hex')}));
  const code=randomBytes(8).toString('hex');await tx.loyaltyRedemption.create({data:{salonId:customer.salonId,customerId:customer.id,codeHash:loyaltyHash(code),points:1,expiresAt:new Date(Date.now()+60000)}});
  const redemption=await checkoutLoyalty(tx,c,customer.id,code);
  const invoice=await tx.invoice.create({data:{salonId:customer.salonId,branchId:branches[0].id,salonCustomerId:customer.id,customerName:customer.displayName,serviceName:'Rollback diagnostic',basePaise:10000,discountPaise:100,loyaltyPoints:1,totalPaise:9900}});
  await consumeCheckoutLoyalty(tx,c,redemption,invoice.id);
 });
 await writeFile('.cache/performance/billing-write-checks.json',JSON.stringify(results,null,2));console.log(JSON.stringify({results,allChangesRolledBack:true}));if(results.some(r=>!r.passed))process.exitCode=1;
}finally{await db.$disconnect();}
