import {beforeEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({context:{salonId:'salon',user:{id:'owner'},membership:{role:'owner',branchScope:'all'}},update:vi.fn(),audit:vi.fn(),origin:vi.fn()}));
vi.mock('@/lib/salon/context',()=>({salonContext:async()=>m.context}));
vi.mock('@/lib/security',()=>({requireSameOrigin:m.origin,rateLimit:vi.fn()}));
vi.mock('next/cache',()=>({revalidatePath:vi.fn(),revalidateTag:vi.fn()}));
vi.mock('@/lib/db',()=>({db:{$transaction:async(work:(tx:unknown)=>unknown)=>work({service:{updateMany:m.update},auditEvent:{create:m.audit}})}}));
import {deleteService} from '@/server/catalog-actions';
const id='11111111-1111-4111-8111-111111111111';
function form(){const f=new FormData();f.set('id',id);f.set('confirm','on');return f;}
beforeEach(()=>{m.context.membership.role='owner';m.context.membership.branchScope='all';m.update.mockResolvedValue({count:1});m.audit.mockResolvedValue({});m.origin.mockResolvedValue(undefined);});
it('removes a service from new bookings without deleting historical data or recipes',async()=>{expect((await deleteService({},form())).message).toBeTruthy();expect(m.update).toHaveBeenCalledWith({where:{id,salonId:'salon',active:true},data:{active:false}});expect(m.audit).toHaveBeenCalledWith({data:expect.objectContaining({action:'service.removed',targetId:id,metadata:{archived:true}})});});
it('rejects services outside the current salon or already removed',async()=>{m.update.mockResolvedValue({count:0});expect((await deleteService({},form())).error).toContain('unavailable');expect(m.audit).not.toHaveBeenCalled();});
it.each(['staff','receptionist','manager'])('denies catalog deletion to %s',async role=>{m.context.membership.role=role;expect((await deleteService({},form())).error).toBeTruthy();expect(m.update).not.toHaveBeenCalled();});
it('requires all-location administration and explicit confirmation',async()=>{m.context.membership.branchScope='selected';expect((await deleteService({},form())).error).toBeTruthy();m.context.membership.branchScope='all';const f=form();f.delete('confirm');expect((await deleteService({},f)).error).toContain('Confirm');expect(m.update).not.toHaveBeenCalled();});
