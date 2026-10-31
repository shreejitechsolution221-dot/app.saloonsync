import { config } from 'dotenv';
import { performance } from 'node:perf_hooks';
import { workspaceQuery, type WorkspaceRow } from '../src/lib/salon/workspace-query';
import { poolConfig } from '../src/lib/performance/pool-config';
config({ path: '.env.local', quiet: true });
const { PrismaClient } = await import('../src/generated/prisma/client');
const { PrismaPg } = await import('@prisma/adapter-pg');
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, ...poolConfig() }, { schema: 'app' }) });
const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
try {
  const member = await db.salonMembership.findFirst({ where: { status: 'active', salon: { status: 'active' }, user: { disabledAt: null } }, select: { salonId: true, userId: true } });
  if (!member) throw new Error('No active benchmark membership');
  const profile = () => db.user.findUniqueOrThrow({ where: { id: member.userId } });
  const workspace = () => db.$queryRaw<WorkspaceRow[]>(workspaceQuery(member.userId, member.salonId));
  const sequential = async () => { const user = await profile(); const rows = await workspace(); if (user.disabledAt || !rows.length) throw new Error('Access changed'); return rows; };
  const parallel = async () => { const [user, rows] = await Promise.all([profile(), workspace()]); if (user.disabledAt || !rows.length) throw new Error('Access changed'); return rows; };
  const before = await sequential(), after = await parallel();
  if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('Scope mismatch');
  const oldMs: number[] = [], newMs: number[] = [];
  for (let i = 0; i < 5; i++) {
    // Alternate order to reduce systematic warm-up/order bias.
    const run = async (fn: () => Promise<unknown>, samples: number[]) => { const start = performance.now(); await fn(); samples.push(performance.now() - start); };
    if (i % 2) { await run(parallel, newMs); await run(sequential, oldMs); }
    else { await run(sequential, oldMs); await run(parallel, newMs); }
  }
  console.log(JSON.stringify({ scopeEquivalent: true, samples: 5, sequentialMedianMs: Math.round(median(oldMs)), parallelMedianMs: Math.round(median(newMs)), note: 'Warm profile + workspace database reads only. Excludes Supabase verification, page queries, rendering and browser navigation; not a load test.' }, null, 2));
} catch { console.error('Navigation database benchmark failed; no private details logged.'); process.exitCode = 1; }
finally { await db.$disconnect(); }
