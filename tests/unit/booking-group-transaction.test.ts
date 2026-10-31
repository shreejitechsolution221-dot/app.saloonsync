import {beforeEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({transaction:vi.fn(),create:vi.fn(),service:vi.fn(),audit:vi.fn(),customer:vi.fn(),staff:vi.fn(),salon:vi.fn()}));
vi.mock('@/lib/db',()=>({db:{$transaction:m.transaction}}));
vi.mock('@/lib/operations/shared',async()=>{const actual=await vi.importActual<typeof import('@/lib/operations/shared')>('@/lib/operations/shared');return {...actual,staffAt:m.staff};});
import {bookAppointmentGroup} from '@/lib/operations/bookings';
const c={salonId:'salon',user:{id:'owner'},operator:true,branches:[{id:'branch'}],availableBranches:[{id:'branch'}],membership:{branchScope:'all'}};
const visit={branchId:'branch',salonCustomerId:'customer',serviceId:'hair',assignedUserId:'staff',startsAt:new Date('2026-11-01T04:30:00Z'),count:1,weeks:1};
beforeEach(()=>{
 m.transaction.mockImplementation(async work=>work({salon:{findUniqueOrThrow:m.salon},service:{findFirst:m.service},salonCustomer:{findFirst:m.customer},appointment:{createMany:m.create},auditEvent:{create:m.audit}}));
 m.salon.mockResolvedValue({settings:{}});m.staff.mockResolvedValue({userId:'staff'});m.customer.mockResolvedValue({id:'customer',userId:null});m.service.mockResolvedValue({id:'hair',name:'Haircut',durationMinutes:40,pricePaise:10000,eligibleUserIds:[],checklist:[],commissionEligible:false});m.create.mockResolvedValue({count:1});m.audit.mockResolvedValue({});
});
it('uses one transaction for all people and links their appointments in the group audit',async()=>{
 const ids=await bookAppointmentGroup(c as never,[visit,{...visit,assignedUserId:'other',salonCustomerId:'other-customer'}]);
 expect(ids).toHaveLength(2);expect(m.transaction).toHaveBeenCalledTimes(1);expect(m.create).toHaveBeenCalledTimes(2);
 expect(m.audit).toHaveBeenLastCalledWith({data:expect.objectContaining({action:'appointment.group_booked',metadata:{appointmentIds:ids}})});
});
it('propagates a later conflict so the transaction rolls back and emits no group success audit',async()=>{
 m.create.mockResolvedValueOnce({count:1}).mockRejectedValueOnce(new Error('Already booked'));
 await expect(bookAppointmentGroup(c as never,[visit,visit])).rejects.toThrow('Already booked');
 expect(m.transaction).toHaveBeenCalledTimes(1);
 expect(m.audit.mock.calls.some(([arg])=>arg.data.action==='appointment.group_booked')).toBe(false);
});
it('rejects inaccessible branches before any appointment insert',async()=>{
 await expect(bookAppointmentGroup(c as never,[{...visit,branchId:'forbidden'}])).rejects.toThrow('accessible location');
 expect(m.create).not.toHaveBeenCalled();
});
it('saves searched-customer walk-ins checked in and audits them as walk-ins',async()=>{
 await bookAppointmentGroup(c as never,[{...visit,checkedIn:true}]);
 expect(m.create).toHaveBeenCalledWith({data:[expect.objectContaining({status:'checked_in',salonCustomerId:'customer'})]});
 expect(m.audit.mock.calls.some(([arg])=>arg.data.action==='appointment.walk_in')).toBe(true);
});
it('snapshots the service commission so later catalog edits cannot change the booked rate',async()=>{
 m.service.mockResolvedValue({id:'hair',name:'Haircut',durationMinutes:40,pricePaise:10000,eligibleUserIds:[],checklist:[],commissionEligible:true,commissionBps:1250});
 await bookAppointmentGroup(c as never,[visit]);expect(m.create).toHaveBeenCalledWith({data:[expect.objectContaining({commissionEligible:true,commissionBps:1250})]});
});
