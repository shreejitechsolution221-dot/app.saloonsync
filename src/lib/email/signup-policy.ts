import 'server-only';
import data from './data/disposable-domains.json';
import { Resolver } from 'node:dns/promises';
const blocked = new Set(data.domains);
const cache = new Map<string, { valid: boolean; expires: number }>();
const reserved = /(?:^|\.)(?:invalid|test|localhost|example)$/;
export function disposableEmail(email: string) {
  const domain = email.slice(email.lastIndexOf('@') + 1).toLowerCase();
  const parts = domain.split('.');
  return parts.some((_, index) => blocked.has(parts.slice(index).join('.')));
}
export function emailPolicyError(email: string) {
  const domain = email.slice(email.lastIndexOf('@') + 1).toLowerCase();
  if (disposableEmail(email)) return 'Temporary or disposable email addresses are not accepted. Use your permanent email address.';
  if (reserved.test(domain) || ['example.com','example.net','example.org'].includes(domain)) return 'Enter a real email address you can verify.';
  return null;
}
export async function assertSignupEmail(email: string) {
  const error = emailPolicyError(email);
  if (error) throw new Error(error);
  const domain = email.slice(email.lastIndexOf('@') + 1).toLowerCase();
  const cached = cache.get(domain);
  if (cached && cached.expires > Date.now()) {
    if (!cached.valid) throw new Error('This email domain cannot receive mail. Check the address.');
    return;
  }
  const resolver = new Resolver({ timeout: 1500, tries: 1 });
  let valid = false;
  try {
    const mx = await resolver.resolveMx(domain);
    // A null MX explicitly declares that the domain does not accept mail.
    valid = mx.length > 0 && mx.some(record => Boolean(record.exchange) && record.exchange !== '.');
    if (!mx.length) valid = (await resolver.resolve4(domain)).length > 0 || (await resolver.resolve6(domain)).length > 0;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENODATA') {
      try { valid = (await resolver.resolve4(domain)).length > 0; }
      catch { try { valid = (await resolver.resolve6(domain)).length > 0; } catch { valid = false; } }
    } else if (!['ENOTFOUND','ENONAME','EBADNAME'].includes(code ?? '')) {
      throw new Error('Unable to check this email domain right now. Please try again.');
    }
  }
  if (cache.size >= 1000) cache.delete(cache.keys().next().value!);
  cache.set(domain, { valid, expires: Date.now() + 5 * 60 * 1000 });
  if (!valid) throw new Error('This email domain cannot receive mail. Check the address.');
}
