import { expect,it } from 'vitest';
import { canModule } from '@/lib/salon/modules';
import { serviceInput,bookingInput,transitions } from '@/lib/salon/validation';
it.each(['inventory','accountant'])('denies customer and appointment access for %s',role=>{expect(canModule(role,'customers')).toBe(false);expect(canModule(role,'appointments')).toBe(false);});
it('limits staff to personal operations and denies unknown roles',()=>{expect(canModule('staff','billing')).toBe(false);expect(canModule('staff','team')).toBe(true);expect(canModule('__proto__','overview')).toBe(false);expect(canModule('receptionist','appointments')).toBe(true);});
it('rejects negative money and unsafe booking durations',()=>{for(const durationMinutes of [0,481])expect(serviceInput.safeParse({name:'Haircut',category:'Hair',durationMinutes,pricePaise:100}).success).toBe(false);expect(serviceInput.safeParse({name:'Haircut',category:'Hair',durationMinutes:60,pricePaise:-1}).success).toBe(false);});
it('requires explicit tenant resource identifiers and a local booking time',()=>{expect(bookingInput.safeParse({branchId:'other',startsAt:'yesterday'}).success).toBe(false);});
it('keeps completed and cancelled visits terminal',()=>{expect(transitions.completed).toEqual([]);expect(transitions.cancelled).toEqual([]);expect(transitions.confirmed).not.toContain('completed');});
