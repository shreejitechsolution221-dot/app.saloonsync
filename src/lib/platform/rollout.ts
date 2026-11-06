export type RolloutRule = { salonId: string | null; status: string; payload: { planCode?: string; group?: string; percentage?: number } };
export function rolloutApplies(rule: RolloutRule, target: { salonId: string; planCode?: string; group?: string }) {
  return (!rule.salonId || rule.salonId === target.salonId) && (!rule.payload.planCode || rule.payload.planCode === target.planCode) && (!rule.payload.group || rule.payload.group === target.group);
}
export function rolloutBucket(salonId: string, code: string) {
  let hash = 2166136261;
  for (const char of `${code}:${salonId}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0) % 100;
}
export function evaluateRollout(rule: RolloutRule | undefined, salonId: string, code: string, fallback = true) {
  if (!rule) return fallback;
  return rule.status === 'enabled' && rolloutBucket(salonId, code) < (rule.payload.percentage ?? 0);
}
