import { beforeEach, expect, it, vi } from 'vitest';
const mx=vi.hoisted(()=>vi.fn());const a=vi.hoisted(()=>vi.fn());const aaaa=vi.hoisted(()=>vi.fn());
vi.mock('node:dns/promises',()=>({Resolver:class{resolveMx=mx;resolve4=a;resolve6=aaaa;}}));
import { assertSignupEmail, disposableEmail, emailPolicyError } from '@/lib/email/signup-policy';
beforeEach(()=>{vi.resetAllMocks();});
it.each(['a@mailinator.com','a@sub.mailinator.com','a@yopmail.com','a@guerrillamail.com'])('blocks disposable email %s',async email=>{
  expect(disposableEmail(email)).toBe(true);await expect(assertSignupEmail(email)).rejects.toThrow(/disposable/);expect(mx).not.toHaveBeenCalled();
});
it('allows ordinary provider domains and blocks reserved fake domains',()=>{
  expect(emailPolicyError('a@gmail.com')).toBeNull();expect(emailPolicyError('a@example.test')).toContain('real email');expect(emailPolicyError('a@example.com')).toContain('real email');
});
it('rejects nonexistent domains',async()=>{
  mx.mockRejectedValue(Object.assign(new Error('not found'),{code:'ENOTFOUND'}));await expect(assertSignupEmail('a@no-such-domain-01.org')).rejects.toThrow('cannot receive mail');
});
it('rejects null MX and does not fall back to a web-only address',async()=>{
  mx.mockResolvedValue([{priority:0,exchange:'.'}]);await expect(assertSignupEmail('a@null-mx-01.org')).rejects.toThrow('cannot receive mail');expect(a).not.toHaveBeenCalled();
});
it('allows valid mail domains and caches only the domain verdict',async()=>{
  mx.mockResolvedValue([{priority:10,exchange:'mail.domain-01.org'}]);await assertSignupEmail('a@domain-01.org');await assertSignupEmail('b@domain-01.org');expect(mx).toHaveBeenCalledTimes(1);
});
it('returns a retry error for transient DNS failures',async()=>{
  mx.mockRejectedValue(Object.assign(new Error('timeout'),{code:'ETIMEOUT'}));await expect(assertSignupEmail('a@transient-01.org')).rejects.toThrow('try again');
});
