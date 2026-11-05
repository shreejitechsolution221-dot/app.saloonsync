import 'server-only';
import { Prisma, PrismaClient } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { poolConfig } from '@/lib/performance/pool-config';
import { Pool } from 'pg';
import { attachDatabasePool } from '@vercel/functions';
import {databaseOperation} from '@/lib/performance/database-timing';
import {createHash} from 'node:crypto';
const globalDb = globalThis as unknown as { prisma?: PrismaClient; prismaPool?: Pool; prismaFields?: string; prismaConnection?:string };
// Dev bundles can have different constructor identities for the same schema.
// Reuse those clients, but replace one generated before a field was added/removed.
const generatedFields = JSON.stringify(Object.entries(Prisma).filter(([name]) => name.endsWith('ScalarFieldEnum')).sort(([a], [b]) => a.localeCompare(b)));
// A region/credential change must also invalidate the dev singleton. The digest
// stays in memory and is never logged or sent to a browser.
const connectionIdentity=createHash('sha256').update(process.env.DATABASE_URL??'').digest('hex');
const cached = globalDb.prismaFields === generatedFields&&globalDb.prismaConnection===connectionIdentity ? globalDb.prisma : undefined;
// Keep one already-open connection between local page visits. This does not
// preconnect or ping; max lifetime and connection failure handling still apply.
const pool = cached ? globalDb.prismaPool : new Pool({ connectionString: process.env.DATABASE_URL, ...poolConfig(), min: process.env.NODE_ENV === 'development' ? 1 : 0 });
// pg emits errors for idle sockets too. Never log connection strings or SQL.
if (!cached) pool!.on('error', () => console.error(JSON.stringify({ event: 'database.idle_connection_error' })));
// Release idle connections before a Vercel Fluid Compute instance suspends.
if (!cached && process.env.VERCEL === '1') attachDatabasePool(pool!);
let slowQueries = 0;
function createClient(dbPool:Pool) {
  const client = new PrismaClient({ adapter: new PrismaPg(dbPool, { schema: 'app', disposeExternalPool: true }), transactionOptions: { maxWait: 5000, timeout: 15000 }, log: [{ emit: 'event', level: 'query' }] });
  client.$on('query', event => {
    const verb=event.query.trim().split(/\s+/,1)[0]?.toUpperCase()??'QUERY';
    const table=event.query.match(/\b(?:FROM|UPDATE|INTO)\s+(?:"?app"?\.)?"?([A-Za-z][A-Za-z0-9_]*)/i)?.[1]??'raw';
    databaseOperation(verb+'.'+table,event.duration);
    if (event.duration >= 200) {
      slowQueries++;
    }
  });
  return client;
}
export const db = cached ?? createClient(pool!);
export function databasePoolMetrics() {
  return pool ? `saloonsync_db_pool_total ${pool.totalCount}\nsaloonsync_db_pool_idle ${pool.idleCount}\nsaloonsync_db_pool_waiting ${pool.waitingCount}\nsaloonsync_db_pool_max ${pool.options.max}\nsaloonsync_db_slow_queries_total ${slowQueries}\n` : '';
}
if (process.env.NODE_ENV !== 'production') {
  const previous = globalDb.prisma;
  globalDb.prisma = db;
  globalDb.prismaPool = pool;
  globalDb.prismaFields = generatedFields;
  globalDb.prismaConnection = connectionIdentity;
  if (previous && previous !== db) void previous.$disconnect().catch(() => {});
}
