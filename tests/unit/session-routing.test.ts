import { expect,it } from 'vitest';
import { needsSessionRefresh } from '@/lib/auth/session-routing';
const session=['sb-project-auth-token.0'];
it.each(['/','/salon/login','/customer/register','/platform/login','/auth/callback','/auth/reset-password'])('avoids auth roundtrips on public route %s',path=>expect(needsSessionRefresh(path,'GET',session)).toBe(false));
it('avoids proxy Auth checks before server actions',()=>expect(needsSessionRefresh('/salon/login','POST',session)).toBe(false));
it('refreshes signed-in protected requests',()=>expect(needsSessionRefresh('/salon','GET',session)).toBe(true));
it('does not call Auth for anonymous requests or verifier-only cookies',()=>{
  expect(needsSessionRefresh('/salon','GET',[])).toBe(false);expect(needsSessionRefresh('/salon','GET',['sb-project-auth-token-code-verifier'])).toBe(false);
});
