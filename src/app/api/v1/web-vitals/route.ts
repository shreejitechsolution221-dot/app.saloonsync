import { admitVital, observeVital, vitalSchema } from '@/lib/performance/vitals';
const headers = { 'Cache-Control': 'no-store' };
export async function POST(request: Request) {
  if (process.env.ENABLE_WEB_VITALS !== 'true') return new Response(null, { status: 404, headers });
  let origin: string;
  try { origin = new URL(process.env.APP_ORIGIN!).origin; } catch { return new Response(null, { status: 503, headers }); }
  if (request.headers.get('origin') !== origin) return new Response(null, { status: 403, headers });
  if (!admitVital()) return new Response(null, { status: 429, headers });
  const reader = request.body?.getReader();
  if (!reader) return new Response(null, { status: 400, headers });
  try {
    let body = ''; let bytes = 0; const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      bytes += value.byteLength;
      if (bytes > 512) { await reader.cancel(); return new Response(null, { status: 413, headers }); }
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();
    const parsed = vitalSchema.safeParse(JSON.parse(body));
    if (!parsed.success) return new Response(null, { status: 400, headers });
    observeVital(parsed.data);
    return new Response(null, { status: 204, headers });
  } catch { return new Response(null, { status: 400, headers }); }
  finally { reader.releaseLock(); }
}
