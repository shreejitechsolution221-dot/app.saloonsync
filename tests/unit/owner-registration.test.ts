import { expect, it } from 'vitest';
import { registrationSchema } from '@/lib/validation/auth';
const base = { name:'Salon Owner', email:'owner@example.test', password:'long-test-password', confirmation:'long-test-password', consent:'on' };
it('requires salon name and mobile for salon registration', () => {
  const result=registrationSchema(12,'salon').safeParse(base);
  expect(result.success).toBe(false);
  if(!result.success) expect(result.error.issues.map(i=>i.path[0])).toEqual(expect.arrayContaining(['salonName','mobileNumber']));
});
it('normalizes formatted international mobile numbers and trims salon names', () => {
  const result=registrationSchema(12,'salon').parse({...base,salonName:'  My Salon  ',mobileNumber:'+91 (98765) 43210'});
  expect(result.mobileNumber).toBe('+919876543210');expect(result.salonName).toBe('My Salon');
});
it('rejects an invalid phone number', () => expect(registrationSchema(12,'salon').safeParse({...base,salonName:'My Salon',mobileNumber:'123'}).success).toBe(false));
it('keeps customer registration independent of owner-only details', () => {
  expect(registrationSchema(12,'customer').safeParse(base).success).toBe(true);
  const result=registrationSchema(12,'customer').parse({...base,mobileNumber:'+919876543210',salonName:'Injected salon'});
  expect(result.mobileNumber).toBeUndefined();expect(result.salonName).toBeUndefined();
});
