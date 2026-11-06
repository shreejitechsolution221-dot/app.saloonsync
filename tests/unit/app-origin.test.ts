import { expect, it } from 'vitest';
import { applicationOrigin } from '@/lib/auth/origin';
import { secureAuthCookies } from '@/lib/auth/cookie-options';
it.each(['http://localhost:3106','http://127.0.0.1:3106','http://[::1]:3106'])('supports the exact loopback development origin %s', origin => {
  expect(applicationOrigin(origin)).toBe(origin); expect(secureAuthCookies(origin)).toBe(false);
});
it.each(['http://localhost.evil.invalid','http://127.0.0.1.evil.invalid','http://192.168.1.1','http://0.0.0.0','https://user:password@app.example','https://app.example/path','https://app.example/?next=evil','https://app.example/#hash'])('rejects unsafe or non-origin configuration %s', origin => {
  expect(() => applicationOrigin(origin)).toThrow();
});
it('requires configuration and preserves HTTPS cookie security', () => {
  expect(() => applicationOrigin(undefined)).toThrow('required');
  expect(applicationOrigin('https://app.example/')).toBe('https://app.example');
  expect(secureAuthCookies('https://app.example')).toBe(true);
});
