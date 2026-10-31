import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({book:vi.fn(),services:vi.fn(),origin:vi.fn(),context:{operator:true,salonId:'salon',user:{id:'user'}}}));
vi.mock('@/lib/db',()=>({db:{service:{findMany:m.services}}}));
vi.mock('@/lib/operations/bookings',()=>({bookAppointmentGroup:m.book}));
vi.mock('@/lib/salon/context',()=>({requireModule:async()=>m.context}));
vi.mock('@/lib/security',()=>({requireSameOrigin:m.origin,rateLimit:vi.fn()}));
vi.mock('next/cache',()=>({revalidatePath:vi.fn()}));
import {createGroupAppointment,createGroupWalkIn} from '@/server/salon-actions';
import {nextBookingTime} from '@/lib/salon/booking-time';
const customer='11111111-1111-4111-8111-111111111111',hair='22222222-2222-4222-8222-222222222222',beard='33333333-3333-4333-8333-333333333333',employee='44444444-4444-4444-8444-444444444444',branch='55555555-5555-4555-8555-555555555555';
function form(people=1){const data=new FormData();data.set('personCount',String(people));for(let i=0;i<people;i++){const prefix=`person.${i}.`;for(const [key,value] of Object.entries({salonCustomerId:customer,assignedUserId:employee,branchId:branch,startsAt:'2026-11-01T10:00'}))data.set(prefix+key,value);data.append(prefix+'serviceId',hair);data.append(prefix+'serviceId',beard);}return data;}
beforeEach(()=>{vi.useRealTimers();vi.setSystemTime(new Date('2026-10-30T10:00:00Z'));vi.useFakeTimers();m.context.operator=true;m.services.mockResolvedValue([{id:beard,durationMinutes:20},{id:hair,durationMinutes:40}]);m.book.mockResolvedValue(['a','b']);});
afterEach(()=>vi.useRealTimers());
it('books hair then beard in selection order and lets another person start at the same time',async()=>{
 expect((await createGroupAppointment({},form(2))).message).toBeTruthy();
 const visits=m.book.mock.calls[0][1];expect(visits).toHaveLength(4);
 expect(visits.map((v:{serviceId:string})=>v.serviceId)).toEqual([hair,beard,hair,beard]);
 expect(visits.map((v:{startsAt:Date})=>v.startsAt.toISOString())).toEqual(['2026-11-01T04:30:00.000Z','2026-11-01T05:10:00.000Z','2026-11-01T04:30:00.000Z','2026-11-01T05:10:00.000Z']);
});
it('rejects duplicate services before booking any appointments',async()=>{const data=form();data.append('person.0.serviceId',hair);expect((await createGroupAppointment({},data)).error).toBeTruthy();expect(m.book).not.toHaveBeenCalled();});
it('rejects missing services and unauthorized users',async()=>{m.services.mockResolvedValue([]);expect((await createGroupAppointment({},form())).error).toBeTruthy();m.context.operator=false;expect((await createGroupAppointment({},form())).error).toBeTruthy();expect(m.book).not.toHaveBeenCalled();});
it('rejects past times before writing',async()=>{const data=form();data.set('person.0.startsAt','2026-10-01T10:00');expect((await createGroupAppointment({},data)).error).toBeTruthy();expect(m.book).not.toHaveBeenCalled();});
it('keeps repeat visits weekly without requiring a weeks-between-visits field',async()=>{const data=form();data.set('recurrenceCount','3');expect((await createGroupAppointment({},data)).message).toBeTruthy();expect(m.book.mock.calls[0][1]).toEqual(expect.arrayContaining([expect.objectContaining({count:3,weeks:1})]));});
it('checks in existing customers for walk-ins, ignores client scheduling and disables recurring visits',async()=>{
 const data=form();data.set('recurrenceCount','12');data.set('person.0.startsAt','2028-01-01T10:00');
 expect((await createGroupWalkIn({},data)).message).toBeTruthy();const visits=m.book.mock.calls[0][1];
 expect(visits[0]).toMatchObject({salonCustomerId:customer,checkedIn:true,count:1});
 expect(visits[0].startsAt.toISOString()).toBe('2026-10-30T10:01:00.000Z');
 expect(visits[1].startsAt.toISOString()).toBe('2026-10-30T10:41:00.000Z');
});
it('defaults to the next quarter hour and advances after closing in India time',()=>{
 expect(nextBookingTime(Date.parse('2026-10-30T10:01:00+05:30'),9,21)).toBe('2026-10-30T10:15');
 expect(nextBookingTime(Date.parse('2026-10-30T22:00:00+05:30'),9,21)).toBe('2026-10-31T09:00');
 expect(nextBookingTime(Date.parse('2026-10-30T07:00:00+05:30'),9,21)).toBe('2026-10-30T09:00');
});
