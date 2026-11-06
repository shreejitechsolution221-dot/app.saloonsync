import { resolve } from 'node:path';

// Supabase direct endpoints require IPv6 unless the project has its IPv4 add-on.
// Prefer an integration's IPv4 pooler on Vercel only when it names the same
// project, database, and DB role. Never silently switch to another database.
export function runtimeDatabaseUrl(env: Record<string, string | undefined> = process.env) {
  const configured = env.DATABASE_URL || env.POSTGRES_PRISMA_URL || env.POSTGRES_URL || '';
  if (env.VERCEL !== '1' || !env.DATABASE_URL) return configured;
  try {
    const direct = new URL(configured);
    const project = direct.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/)?.[1];
    if (!project) return configured;
    const host = env.SUPABASE_POOLER_HOST?.trim();
    if (host) {
      if (!/^aws-\d+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(host)) throw new Error('Invalid SUPABASE_POOLER_HOST');
      const pooled = new URL(direct);
      pooled.hostname = host;
      pooled.port = '6543';
      pooled.username = `${decodeURIComponent(direct.username)}.${project}`;
      pooled.searchParams.set('sslmode', 'verify-full');
      pooled.searchParams.set('sslrootcert', resolve('certificates/supabase-ca.crt'));
      return pooled.toString();
    }
    for (const candidate of [env.POSTGRES_PRISMA_URL, env.POSTGRES_URL]) {
      if (!candidate) continue;
      let pooled: URL;
      try { pooled = new URL(candidate); } catch { continue; }
      if (pooled.protocol === direct.protocol && pooled.hostname.endsWith('.pooler.supabase.com') &&
        decodeURIComponent(pooled.username) === `${decodeURIComponent(direct.username)}.${project}` &&
        pooled.pathname === direct.pathname) return candidate;
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'Invalid SUPABASE_POOLER_HOST') throw error;
    // The database client reports malformed connection strings safely.
  }
  return configured;
}
