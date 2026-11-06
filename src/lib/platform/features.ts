import 'server-only';
import { db } from '@/lib/db';
import type { Prisma } from '@/generated/prisma/client';
import { evaluateRollout, rolloutApplies, type RolloutRule } from './rollout';
import { checkPlatformSchema } from './schema-ready';
export async function platformFeatureEnabled(salonId: string, code: string, client: Prisma.TransactionClient = db) {
  // Preserve existing booking behavior while the additive migration awaits deployment.
  if (!await checkPlatformSchema(client)) return true;
  const [salon, record] = await Promise.all([
    client.salon.findUnique({ where: { id: salonId }, select: { settings: true, subscription: { select: { planCode: true } } } }),
    client.platformRecord.findUnique({ where: { key: `flag:${code}` }, select: { salonId: true, status: true, payload: true } }),
  ]);
  if (!salon) return false;
  const settings = salon.settings as { platformRolloutGroup?: string };
  const candidate = record as RolloutRule | null;
  const rule = candidate && rolloutApplies(candidate, { salonId, planCode: salon.subscription?.planCode, group: settings.platformRolloutGroup }) ? candidate : undefined;
  return evaluateRollout(rule, salonId, code);
}
