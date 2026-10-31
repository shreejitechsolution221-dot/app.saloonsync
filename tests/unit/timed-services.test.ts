import {beforeEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({row:vi.fn(),start:vi.fn(),update:vi.fn(),audit:vi.fn(),effects:vi.fn(),query:vi.fn(),transaction:vi.fn()}));
vi.mock('@/lib/db',()=>({db:{$transaction:m.transaction,$queryRaw:m.query}}));
vi.mock('@/lib/operations/bookings',()=>({completionEffects:m.effects}));
import {completeTimedService,completeDueServices} from '@/lib/operations/timed-services';
const c={salonId:'salon',user:{id:'staff'},operator:false,branches:[{id:'branch'}]};
beforeEach(()=>{
 m.transaction.mockImplementation(work=>work({appointment:{findFirst:m.row,updateMany:m.update},auditEvent:{findFirst:m.start,create:m.audit}}));
 m.row.mockResolvedValue({id:'visit',salonId:'salon',status:'in_service',durationMinutes:30,checklist:[],completedSteps:[]});
 m.start.mockResolvedValue({occurredAt:new Date(Date.now()-31*60000),actorUserId:'staff'});
 m.update.mockResolvedValue({count:1});m.effects.mockResolvedValue(undefined);m.audit.mockResolvedValue({});m.query.mockResolvedValue([{id:'visit'}]);
});
it('finishes elapsed services with transactional completion effects and an automatic audit',async()=>{
 expect(await completeTimedService('visit',c as never)).toBe(true);
 expect(m.effects).toHaveBeenCalledTimes(1);expect(m.audit).toHaveBeenCalledWith({data:expect.objectContaining({action:'appointment.completed',metadata:{automatic:true}})});
 expect(m.row).toHaveBeenCalledWith({where:expect.objectContaining({salonId:'salon',branchId:{in:['branch']},assignedUserId:'staff'})});
});
it('uses actual service start and refuses completion before the duration ends',async()=>{
 m.start.mockResolvedValue({occurredAt:new Date(Date.now()-2*60000),actorUserId:'staff'});
 expect(await completeTimedService('visit',c as never)).toBe(false);expect(m.update).not.toHaveBeenCalled();
});
it('does not guess a start time when there is no recorded start',async()=>{m.start.mockResolvedValue(null);expect(await completeTimedService('visit',c as never)).toBe(false);expect(m.update).not.toHaveBeenCalled();});
it('does not bypass incomplete checklist steps',async()=>{m.row.mockResolvedValue({id:'visit',salonId:'salon',durationMinutes:30,checklist:['Wash'],completedSteps:[]});await expect(completeTimedService('visit',c as never)).rejects.toThrow('checklist');expect(m.update).not.toHaveBeenCalled();});
it('does not repeat stock or commission effects after a concurrent completion',async()=>{m.update.mockResolvedValue({count:0});expect(await completeTimedService('visit',c as never)).toBe(false);expect(m.effects).not.toHaveBeenCalled();});
it('propagates stock failures to roll back the whole completion',async()=>{m.effects.mockRejectedValue(new Error('Insufficient stock'));await expect(completeTimedService('visit',c as never)).rejects.toThrow('stock');expect(m.audit).not.toHaveBeenCalled();});
it('keeps an automatic worker failure isolated from other appointments',async()=>{m.effects.mockRejectedValue(new Error('Stock'));expect(await completeDueServices(c as never)).toEqual({completed:0,blocked:1});});
it('denies the unauthenticated worker endpoint without its secret',async()=>{const {POST}=await import('@/app/api/internal/services/route');const response=await POST(new Request('https://example.test/api/internal/services',{method:'POST'}));expect(response.status).toBe(401);expect(m.query).not.toHaveBeenCalled();});
