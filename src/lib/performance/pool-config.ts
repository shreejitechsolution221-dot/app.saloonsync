// pg owns the Prisma 7 adapter pool; URL connection_limit is not a pool setting.
export function poolConfig(env: Record<string, string | undefined> = process.env) {
  const integer = (name: string, fallback: number, min: number, max: number) => {
    const raw = env[name];
    if (raw === undefined || raw === '') return fallback;
    if (!/^\d+$/.test(raw)) throw new Error(`Invalid ${name}`);
    const value = Number(raw);
    if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error(`Invalid ${name}`);
    return value;
  };
  return {
    max: integer('DB_POOL_MAX', 5, 1, 100),
    connectionTimeoutMillis: integer('DB_CONNECT_TIMEOUT_MS', 5000, 100, 30000),
    idleTimeoutMillis: integer('DB_IDLE_TIMEOUT_MS', 60000, 1000, 300000),
    maxLifetimeSeconds: integer('DB_MAX_LIFETIME_SECONDS', 600, 60, 86400),
    statement_timeout: integer('DB_STATEMENT_TIMEOUT_MS', 15000, 1000, 120000),
    keepAlive: true,
  };
}
