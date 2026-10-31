import { httpMetrics, metricsAuthorized } from '@/lib/performance/http';
import { databasePoolMetrics } from '@/lib/db';
import { vitalMetrics } from '@/lib/performance/vitals';
import { tenantCacheMetrics } from '@/lib/performance/tenant-cache';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  if (!metricsAuthorized(request)) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  return new Response(httpMetrics() + databasePoolMetrics() + vitalMetrics() + tenantCacheMetrics(), { headers: { 'Content-Type': 'text/plain; version=0.0.4', 'Cache-Control': 'no-store' } });
}
