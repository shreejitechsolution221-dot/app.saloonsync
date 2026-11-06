import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { authConfigured } from '@/lib/auth/config';
import { logAuthFailure } from '@/lib/auth/failure-log';

beforeEach(() => {
  for (const key of ['DATABASE_URL', 'POSTGRES_PRISMA_URL', 'POSTGRES_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY']) vi.stubEnv(key, '');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'test-publishable-key');
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

it.each(['DATABASE_URL', 'POSTGRES_PRISMA_URL', 'POSTGRES_URL'])('enables auth with the runtime-supported %s variable', key => {
  vi.stubEnv(key, 'postgresql://example.invalid/postgres');
  expect(authConfigured()).toBe(true);
});
it('does not enable sign-in when no database connection is configured', () => {
  expect(authConfigured()).toBe(false);
});
it('does not enable sign-in without identity provider configuration', () => {
  vi.stubEnv('DATABASE_URL', 'postgresql://example.invalid/postgres');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', '');
  expect(authConfigured()).toBe(false);
});
it('logs dependency codes without credentials, SQL, personal data, or stack traces', () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  logAuthFailure('database', Object.assign(new Error('postgresql://user:private-password@host/private-database'), {
    code: 'P1001', cause: { code: 'ENETUNREACH' },
    meta: { driverAdapterError: { cause: { originalCode: '42P01', originalMessage: 'SELECT private_customer_email' } } },
  }));
  const output = log.mock.calls[0][0] as string;
  expect(JSON.parse(output)).toEqual({ event: 'auth.dependency_failed', stage: 'database', code: 'P1001', causeCode: 'ENETUNREACH', sqlState: '42P01', reason: 'network_unreachable' });
  for (const secret of ['private-password', 'private-database', 'private_customer_email', 'stack']) expect(output).not.toContain(secret);
});
