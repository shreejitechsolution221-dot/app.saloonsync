import {expect,it} from 'vitest';
import {parseAppointmentFilters,appointmentTimeRanges} from '@/lib/salon/appointment-filters';
it('validates staff and time values without accepting arbitrary identifiers',()=>{expect(parseAppointmentFilters({staff:'other-tenant',from:'25:00',to:'9am',service:'  Haircut  '})).toEqual({staff:'',from:'',to:'',service:'Haircut'});expect(parseAppointmentFilters({staff:'unassigned',from:'09:00'}).staff).toBe('unassigned');});
it('filters appointment start time in India time across every day in a week',()=>{
 const ranges=appointmentTimeRanges(new Date('2026-10-29T18:30:00Z'),7,'09:00','11:00');
 expect(ranges).toHaveLength(7);expect(ranges[0].startsAt.gte.toISOString()).toBe('2026-10-30T03:30:00.000Z');expect(ranges[0].startsAt.lt.toISOString()).toBe('2026-10-30T05:31:00.000Z');expect(ranges[6].startsAt.gte.toISOString()).toBe('2026-11-05T03:30:00.000Z');
});
it('returns no time constraint when both fields are empty and an empty range for reversed times',()=>{const start=new Date('2026-10-29T18:30:00Z');expect(appointmentTimeRanges(start,1,'','')).toEqual([]);const [range]=appointmentTimeRanges(start,1,'14:00','10:00');expect(range.startsAt.gte).toEqual(range.startsAt.lt);});
