import { expect, it } from 'vitest';
import { runtimeDatabaseUrl } from '@/lib/performance/database-url';
const direct = 'postgresql://postgres:test@db.project.supabase.co:5432/postgres';
const pooler = 'postgresql://postgres.project:test@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=verify-full';
it('uses the same-project integration pooler on Vercel', () => {
  expect(runtimeDatabaseUrl({ VERCEL: '1', DATABASE_URL: direct, POSTGRES_PRISMA_URL: pooler })).toBe(pooler);
});
it('preserves local direct connections and explicit non-Supabase URLs', () => {
  expect(runtimeDatabaseUrl({ DATABASE_URL: direct, POSTGRES_PRISMA_URL: pooler })).toBe(direct);
  expect(runtimeDatabaseUrl({ VERCEL: '1', DATABASE_URL: 'postgresql://user:test@other.invalid/db', POSTGRES_URL: pooler })).toBe('postgresql://user:test@other.invalid/db');
});
it.each([
  pooler.replace('postgres.project:', 'postgres.other:'),
  pooler.replace('/postgres?', '/other?'),
  pooler.replace('postgres.project:', 'admin.project:'),
  pooler.replace('.pooler.supabase.com', '.pooler.supabase.com.evil.invalid'),
  'invalid',
])('never switches project, DB, role, or to an untrusted pooler', candidate => {
  expect(runtimeDatabaseUrl({ VERCEL: '1', DATABASE_URL: direct, POSTGRES_PRISMA_URL: candidate })).toBe(direct);
});
it('retains supported alias fallback and skips malformed alternatives', () => {
  expect(runtimeDatabaseUrl({ POSTGRES_URL: pooler })).toBe(pooler);
  expect(runtimeDatabaseUrl({ VERCEL: '1', DATABASE_URL: direct, POSTGRES_PRISMA_URL: 'invalid', POSTGRES_URL: pooler })).toBe(pooler);
});
it('uses a verified operator-supplied Supabase pooler host while preserving credentials and DB', () => {
  const result = new URL(runtimeDatabaseUrl({ VERCEL: '1', DATABASE_URL: direct, SUPABASE_POOLER_HOST: 'aws-1-ap-south-1.pooler.supabase.com' }));
  expect(result.hostname).toBe('aws-1-ap-south-1.pooler.supabase.com');
  expect(result.port).toBe('6543');
  expect(result.username).toBe('postgres.project');
  expect(result.password).toBe('test');
  expect(result.pathname).toBe('/postgres');
  expect(result.searchParams.get('sslmode')).toBe('verify-full');
  expect(result.searchParams.get('sslrootcert')).toMatch(/certificates[\\/]supabase-ca\.crt$/);
});
it.each(['evil.invalid', 'aws-1-ap-south-1.pooler.supabase.com.evil.invalid', 'aws-1-ap-south-1.pooler.supabase.com:6543'])('rejects an untrusted pooler hostname (%s)', host => {
  expect(() => runtimeDatabaseUrl({ VERCEL: '1', DATABASE_URL: direct, SUPABASE_POOLER_HOST: host })).toThrow('Invalid SUPABASE_POOLER_HOST');
});
