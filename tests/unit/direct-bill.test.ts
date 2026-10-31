import {beforeEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({context:{user:{id:'actor'},salonId:'salon',membership:{role:'owner',branchScope:'all'},branches:[{id:'11111111-1111-4111-8111-111111111111'}],availableBranches:[],selectedBranchId:null},origin:vi.fn(),access:vi.fn(),tx:{service:{findMany:vi.fn()},salonCustomer:{findFirst:vi.fn()},invoice:{create:vi.fn()},invoiceLine:{createMany:vi.fn()},payment:{create:vi.fn()},auditEvent:{create:vi.fn()},loyaltyRedemption:{findFirst:vi.fn(),updateMany:vi.fn()},loyaltyAccount:{findUnique:vi.fn(),updateMany:vi.fn()},loyaltyEntry:{create:vi.fn()},$queryRaw:vi.fn()},transaction:vi.fn()}));
vi.mock('@/lib/salon/context',()=>({salonContext:async()=>m.context,requireOperations:m.access}));
vi.mock('@/lib/security',()=>({requireSameOrigin:m.origin,rateLimit:vi.fn()}));
vi.mock('next/cache',()=>({revalidatePath:vi.fn()}));
vi.mock('next/navigation',()=>({unstable_rethrow:vi.fn()}));
vi.mock('@/lib/db',()=>({db:{salon:{findUniqueOrThrow:async()=>({settings:{taxBps:1800,discountLimitBps:1000}})},$transaction:m.transaction}}));
import {createDirectBill} from '@/server/direct-bill';
const service='22222222-2222-4222-8222-222222222222',second='33333333-3333-4333-8333-333333333333',customer='44444444-4444-4444-8444-444444444444';
function form(overrides:Record<string,string|undefined>={}){const f=new FormData();for(const[k,v]of Object.entries({branchId:m.context.branches[0].id,customerName:'Walk-in customer',serviceId:service,quantity:'2',unitRupees:'0.01',discountRupees:'100',method:'cash',...overrides}))if(v!==undefined)f.set(k,v);return f;}
beforeEach(()=>{vi.resetAllMocks();m.context.membership.role='owner';m.transaction.mockImplementation(async work=>work(m.tx));m.tx.service.findMany.mockResolvedValue([{id:service,name:'Haircut',pricePaise:50000},{id:second,name:'Styling',pricePaise:25000}]);m.tx.invoice.create.mockResolvedValue({id:'invoice'});m.tx.payment.create.mockResolvedValue({id:'payment'});m.tx.salonCustomer.findFirst.mockResolvedValue({id:customer,displayName:'Registered customer'});m.tx.loyaltyRedemption.findFirst.mockResolvedValue({id:'redemption',customerId:customer,points:200});m.tx.loyaltyAccount.findUnique.mockResolvedValue({points:300});m.tx.loyaltyRedemption.updateMany.mockResolvedValue({count:1});m.tx.loyaltyAccount.updateMany.mockResolvedValue({count:1});m.tx.loyaltyEntry.create.mockResolvedValue({id:'entry'});});
it('uses database prices rather than submitted unit prices and saves lines and full payment',async()=>{
 const f=form();f.append('serviceId',second);f.append('quantity','1');
 expect(await createDirectBill({},f)).toEqual({message:'Walk-in bill created.',link:'/salon/billing/receipt/invoice'});
 expect(m.access).toHaveBeenCalledWith(false,'billing');expect(m.tx.$queryRaw.mock.calls[0][0].join('')).toContain('::text');
 expect(m.tx.invoice.create).toHaveBeenCalledWith({data:expect.objectContaining({customerName:'Walk-in customer',basePaise:125000,discountPaise:10000,taxPaise:20700,totalPaise:135700})});
 expect(m.tx.invoice.create.mock.calls[0][0].data).not.toHaveProperty('appointmentId');
 expect(m.tx.invoiceLine.createMany.mock.calls[0][0].data).toHaveLength(2);
 expect(m.tx.payment.create).toHaveBeenCalledWith({data:{salonId:'salon',invoiceId:'invoice',amountPaise:135700,method:'cash'}});
});
it('leaves an unpaid bill available for later collection',async()=>{await createDirectBill({},form({method:'unpaid'}));expect(m.tx.invoice.create).toHaveBeenCalledOnce();expect(m.tx.payment.create).not.toHaveBeenCalled();});
it('validates location scope before writing',async()=>{expect(await createDirectBill({},form({branchId:second}))).toHaveProperty('error');expect(m.tx.invoice.create).not.toHaveBeenCalled();});
it('enforces role limits on discretionary discounts',async()=>{m.context.membership.role='cashier';expect(await createDirectBill({},form({discountRupees:'101'}))).toHaveProperty('error','Discount exceeds your approved limit.');expect(m.tx.invoice.create).not.toHaveBeenCalled();});
it.each([{quantity:'0'},{serviceId:'invalid'},{discountRupees:'1001'},{method:'fake'}])('rejects invalid financial input %j',async values=>{expect(await createDirectBill({},form(values))).toHaveProperty('error');expect(m.tx.invoice.create).not.toHaveBeenCalled();});
it('rejects unavailable catalog services',async()=>{m.tx.service.findMany.mockResolvedValue([]);expect(await createDirectBill({},form())).toHaveProperty('error','A selected service is unavailable.');expect(m.tx.invoice.create).not.toHaveBeenCalled();});
it('applies customer-bound loyalty at one point per rupee and consumes the code in the same transaction',async()=>{
 m.context.membership.role='cashier';await createDirectBill({},form({customerId:customer,loyaltyCode:'ABC',discountRupees:'0'}));
 expect(m.tx.invoice.create).toHaveBeenCalledWith({data:expect.objectContaining({salonCustomerId:customer,customerName:'Registered customer',loyaltyPoints:200,discountPaise:20000,taxPaise:14400,totalPaise:94400})});
 expect(m.tx.loyaltyRedemption.findFirst).toHaveBeenCalledWith({where:expect.objectContaining({salonId:'salon',customerId:customer,redeemedAt:null,expiresAt:{gt:expect.any(Date)}})});
 expect(m.tx.loyaltyAccount.updateMany).toHaveBeenCalledWith({where:{salonId:'salon',customerId:customer,points:{gte:200}},data:{points:{decrement:200}}});
});
it('rejects used, expired or mismatched codes without writing an invoice or points',async()=>{m.tx.loyaltyRedemption.findFirst.mockResolvedValue(null);expect(await createDirectBill({},form({customerId:customer,loyaltyCode:'BAD'}))).toHaveProperty('error');expect(m.tx.invoice.create).not.toHaveBeenCalled();expect(m.tx.loyaltyAccount.updateMany).not.toHaveBeenCalled();});
it('rejects redemption when points were spent elsewhere after code issuance',async()=>{m.tx.loyaltyAccount.findUnique.mockResolvedValue({points:10});expect(await createDirectBill({},form({customerId:customer,loyaltyCode:'ABC'}))).toHaveProperty('error');expect(m.tx.invoice.create).not.toHaveBeenCalled();});
it('does not proceed after a failed same-origin check',async()=>{m.origin.mockRejectedValue(new Error('Forbidden'));expect(await createDirectBill({},form())).toHaveProperty('error');expect(m.tx.invoice.create).not.toHaveBeenCalled();});
