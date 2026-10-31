import { expect, it } from 'vitest';
import { passwordChecks, suggestPassword } from '@/lib/auth/passwords';
import { checkStrength } from '@/lib/auth/password-strength';
it('checks length and matching independently in real time', () => {
  expect(passwordChecks('short','short',12)).toEqual({longEnough:false,withinLimit:true,matches:true});
  expect(passwordChecks('a-long-password','different',12).matches).toBe(false);
  expect(passwordChecks('','',12).matches).toBe(false);
});
it('generates unique crypto suggestions with all character classes', () => {
  const passwords=Array.from({length:20},()=>suggestPassword(12));
  expect(new Set(passwords).size).toBe(20);
  for(const password of passwords){expect(password.length).toBeGreaterThanOrEqual(20);expect(password).toMatch(/[A-Z]/);expect(password).toMatch(/[a-z]/);expect(password).toMatch(/[0-9]/);expect(password).toMatch(/[!@#$%&*_-]/);}
});
it('meets larger configured minimums without exceeding the provider limit',()=>{
  expect(suggestPassword(64).length).toBeGreaterThanOrEqual(64);expect(suggestPassword(128).length).toBe(128);
});
it('does not rate repeated long passwords as strong',()=>expect(checkStrength('aaaaaaaaaaaaaaaaaaaa').score).toBeLessThan(3));
