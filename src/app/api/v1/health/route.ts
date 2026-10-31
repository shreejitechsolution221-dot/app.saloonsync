import { measured } from '@/lib/performance/http';
import { redis } from '@/server/redis';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return measured('health', request, async () => {
    let redisInfo: { ok: boolean; ms?: number; status?: string } | undefined;

    if (redis) {
      const start = performance.now();
      try {
        let timer: NodeJS.Timeout;
        const timeout = new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('Redis ping timeout')), 300);
        });
        await Promise.race([
          redis.ping().then((res) => {
            clearTimeout(timer);
            return res;
          }),
          timeout,
        ]);
        redisInfo = { ok: true, ms: Math.round((performance.now() - start) * 100) / 100 };
      } catch {
        redisInfo = { ok: false, status: 'degraded' };
      }
    }

    return Response.json({
      status: 'ok',
      ...(redisInfo ? { redis: redisInfo } : {}),
    });
  });
}
