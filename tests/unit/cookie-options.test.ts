import {expect,it} from 'vitest';
import {secureAuthCookies} from '@/lib/auth/cookie-options';
it('allows local HTTP cookies in a production build without weakening remote hosts',()=>{
 expect(secureAuthCookies('http://localhost:3000')).toBe(false);
 expect(secureAuthCookies('https://app.saloonsync.com')).toBe(true);
 expect(secureAuthCookies('http://app.saloonsync.com')).toBe(true);
 expect(secureAuthCookies('http://localhost.evil.com')).toBe(true);
 expect(secureAuthCookies('bad')).toBe(true);
});
