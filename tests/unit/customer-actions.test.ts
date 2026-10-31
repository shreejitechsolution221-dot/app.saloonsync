import {beforeEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({context:{salonId:'salon',user:{id:'owner'},membership:{role:'owner',branchScope:'selected'},branches:[{id:'branch'}],availableBranches:[{id:'branch'}]},origin:vi.fn(),find:vi.fn(),update:vi.fn(),remove:vi.fn(),count:vi.fn(),audit:vi.fn(),lock:vi.fn()}));
vi.mock('@/lib/salon/context',()=>({salonContext:async()=>m.context}));
vi.mock('@/lib/security',()=>({requireSameOrigin:m.origin,rateLimit:vi.fn()}));
vi.mock('next/cache',()=>({revalidatePath:vi.fn()}));
vi.mock('@/lib/db',()=>({db:{$transaction:async(work:(tx:unknown)=>unknown)=>work({salonCustomer:{findFirst:m.find,update:m.update,delete:m.remove},appointment:{count:m.count},loyaltyAccount:{count:m.count},loyaltyEntry:{count:m.count},messageJob:{count:m.count},portfolioPhoto:{count:m.count},auditEvent:{create:m.audit},$queryRaw:m.lock})}}));
import {editCustomer,deleteCustomer} from '@/server/customer-actions';
const id='11111111-1111-4111-8111-111111111111';
function form(){const f=new FormData();for(const[key,value]of Object.entries({id,displayName:'New Name',phone:'9876543210',notes:'Gentle wash',confirm:'on'}))f.set(key,value);return f;}
beforeEach(()=>{m.context.membership.role='owner';m.origin.mockResolvedValue(undefined);m.find.mockResolvedValue({id});m.count.mockResolvedValue(0);m.update.mockResolvedValue({});m.remove.mockResolvedValue({});m.audit.mockResolvedValue({});});
it('edits only basic details and preserves consent and profile metadata',async()=>{expect((await editCustomer({},form())).message).toBeTruthy();expect(m.update).toHaveBeenCalledWith({where:{id},data:{displayName:'New Name',phone:'9876543210',notes:'Gentle wash'}});expect(m.find.mock.calls[0][0].where).toMatchObject({salonId:'salon',OR:[{originBranchId:{in:['branch']}},{bookings:{some:{branchId:{in:['branch']}}}}]});});
it('rejects editing customers outside the authorized workspace',async()=>{m.find.mockResolvedValue(null);expect((await editCustomer({},form())).error).toContain('unavailable');expect(m.update).not.toHaveBeenCalled();});
it('allows an administrator to delete a confirmed customer with no linked history',async()=>{expect((await deleteCustomer({},form())).message).toBeTruthy();expect(m.remove).toHaveBeenCalledWith({where:{id}});expect(m.audit).toHaveBeenCalledWith({data:expect.objectContaining({action:'customer.deleted',targetId:id})});});
it('blocks deleting customers with related records',async()=>{m.count.mockResolvedValueOnce(1);expect((await deleteCustomer({},form())).error).toContain('history');expect(m.remove).not.toHaveBeenCalled();});
it('does not grant receptionists delete privileges',async()=>{m.context.membership.role='receptionist';expect((await deleteCustomer({},form())).error).toContain('permission');expect(m.remove).not.toHaveBeenCalled();});
it('requires explicit delete confirmation and rejects cross-origin mutations',async()=>{const f=form();f.delete('confirm');expect((await deleteCustomer({},f)).error).toContain('Confirm');m.origin.mockRejectedValue(new Error('Origin'));expect((await editCustomer({},form())).error).toBeTruthy();expect(m.remove).not.toHaveBeenCalled();expect(m.update).not.toHaveBeenCalled();});
