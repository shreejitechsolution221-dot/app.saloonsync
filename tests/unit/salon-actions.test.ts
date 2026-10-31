import {beforeEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({context:{user:{id:'user'},salonId:'salon',operator:true,administrator:true,membership:{role:'owner',branchScope:'all'},branches:[{id:'branch'}]},origin:vi.fn(),tx:{salonCustomer:{findFirst:vi.fn(),create:vi.fn()},service:{findFirst:vi.fn()},salonMembership:{findFirst:vi.fn()},appointment:{create:vi.fn(),findFirst:vi.fn(),updateMany:vi.fn()},invoice:{findFirst:vi.fn()},payment:{create:vi.fn()},product:{updateMany:vi.fn(),findFirst:vi.fn()},locationStock:{updateMany:vi.fn()},$queryRaw:vi.fn(),auditEvent:{create:vi.fn()}}}));
vi.mock('@/lib/salon/context',()=>({salonContext:async()=>m.context,requireModule:async()=>m.context,requireOperations:async()=>m.context}));
vi.mock('@/lib/security',()=>({requireSameOrigin:m.origin,rateLimit:vi.fn()}));
vi.mock('next/cache',()=>({revalidatePath:vi.fn()}));
vi.mock('@/lib/db',()=>({db:{$transaction:async(f:(tx:unknown)=>unknown)=>f(m.tx)}}));
import {addCustomer,createAppointment,recordPayment,changeAppointment,adjustStock} from '@/server/salon-actions';
const uuid='11111111-1111-4111-8111-111111111111';
function form(values:Record<string,string>){const f=new FormData();for(const [k,v] of Object.entries(values))f.set(k,v);return f;}
it('returns the saved customer for selection after an audited creation',async()=>{
 m.tx.salonCustomer.create.mockResolvedValue({id:uuid,displayName:'New Customer',phone:'12345'});
 const result=await addCustomer({},form({displayName:'New Customer',phone:'12345',notes:'',branchId:uuid}));
 expect(result).toEqual({message:'Saved successfully.',customer:{id:uuid,displayName:'New Customer'}});
 expect(m.tx.salonCustomer.create).toHaveBeenCalledWith({data:expect.objectContaining({salonId:'salon',originBranchId:uuid})});
 expect(m.tx.auditEvent.create).toHaveBeenCalledWith({data:expect.objectContaining({action:'customer.created',targetId:uuid})});
});
it('does not return a selectable customer when its audit fails',async()=>{
 m.tx.salonCustomer.create.mockResolvedValue({id:uuid,displayName:'New Customer'});
 m.tx.auditEvent.create.mockRejectedValueOnce(new Error('Audit failed'));
 const result=await addCustomer({},form({displayName:'New Customer',phone:'',notes:'',branchId:uuid}));
 expect(result.error).toBeTruthy();expect(result).not.toHaveProperty('customer');
});
beforeEach(()=>{vi.clearAllMocks();m.origin.mockResolvedValue(undefined);m.context.operator=true;m.context.branches=[{id:uuid}];m.tx.auditEvent.create.mockResolvedValue({});});
it('rejects cross-origin writes before touching data',async()=>{m.origin.mockRejectedValue(new Error('Origin'));expect((await recordPayment({},form({invoiceId:uuid,amountRupees:'100',method:'cash'}))).error).toBeTruthy();expect(m.tx.invoice.findFirst).not.toHaveBeenCalled();});
it('rejects an invoice outside the active salon',async()=>{m.tx.invoice.findFirst.mockResolvedValue(null);expect((await recordPayment({},form({invoiceId:uuid,amountRupees:'100',method:'cash'}))).error).toBeTruthy();expect(m.tx.payment.create).not.toHaveBeenCalled();});
it('stores payment rupees as integer paise and audits the write',async()=>{m.tx.invoice.findFirst.mockResolvedValue({id:uuid});m.tx.payment.create.mockResolvedValue({id:'payment'});expect((await recordPayment({},form({invoiceId:uuid,amountRupees:'100.25',method:'upi'}))).message).toBeTruthy();expect(m.tx.payment.create).toHaveBeenCalledWith({data:expect.objectContaining({salonId:'salon',invoiceId:uuid,amountPaise:10025,method:'upi'})});expect(m.tx.auditEvent.create).toHaveBeenCalled();});
it('rejects invalid branch bookings before tenant lookups',async()=>{expect((await createAppointment({},form({branchId:'22222222-2222-4222-8222-222222222222',salonCustomerId:uuid,serviceId:uuid,assignedUserId:uuid,startsAt:'2027-02-01T10:00'}))).error).toBeTruthy();expect(m.tx.service.findFirst).not.toHaveBeenCalled();});
it('prevents staff from changing unrelated bookings',async()=>{m.context.operator=false;m.tx.appointment.findFirst.mockResolvedValue(null);expect((await changeAppointment({},form({id:uuid,status:'completed'}))).error).toBeTruthy();expect(m.tx.appointment.findFirst).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({assignedUserId:'user',salonId:'salon'})}));expect(m.tx.appointment.updateMany).not.toHaveBeenCalled();});
it('does not silently accept stock underflow',async()=>{m.tx.locationStock.updateMany.mockResolvedValue({count:0});expect((await adjustStock({},form({id:uuid,branchId:uuid,delta:'-5',reason:'Service usage'}))).error).toBeTruthy();expect(m.tx.auditEvent.create).not.toHaveBeenCalled();});
it('explains when a next-day appointment can start and prevents writes',async()=>{
 m.tx.appointment.findFirst.mockResolvedValue({id:uuid,status:'checked_in',startsAt:new Date(Date.now()+24*3600000)});
 const result=await changeAppointment({},form({id:uuid,status:'in_service'}));
 expect(result.error).toContain('15 minutes before');expect(result.error).toContain('IST');expect(m.tx.appointment.updateMany).not.toHaveBeenCalled();
});
it('allows starting exactly 15 minutes before the appointment and records the actual start',async()=>{
 m.tx.appointment.findFirst.mockResolvedValue({id:uuid,status:'checked_in',startsAt:new Date(Date.now()+15*60000)});
 m.tx.appointment.updateMany.mockResolvedValue({count:1});
 const result=await changeAppointment({},form({id:uuid,status:'in_service'}));
 expect(result.error).toBeUndefined();expect('serviceStartedAt' in result&&result.serviceStartedAt).toBeTruthy();
 expect(m.tx.auditEvent.create).toHaveBeenCalledWith({data:expect.objectContaining({action:'appointment.in_service',occurredAt:expect.any(Date)})});
});
it('explains that check-in is required before starting a service',async()=>{
 m.tx.appointment.findFirst.mockResolvedValue({id:uuid,status:'confirmed'});
 expect((await changeAppointment({},form({id:uuid,status:'in_service'}))).error).toContain('Check in');
 expect(m.tx.appointment.updateMany).not.toHaveBeenCalled();
});

