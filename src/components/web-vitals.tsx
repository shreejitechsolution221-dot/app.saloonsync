'use client';
import { useReportWebVitals } from 'next/web-vitals';
const sent = new Set<string>();
function report(metric: { id: string; name: string; value: number }) {
  if (!['LCP', 'INP', 'CLS'].includes(metric.name) || sent.has(metric.id)) return;
  if (sent.size >= 128) sent.clear();
  sent.add(metric.id);
  // No cookies, identities, metric IDs, URLs, DOM entries or referrer.
  void fetch('/api/v1/web-vitals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: metric.name, value: metric.value }), credentials: 'omit', referrerPolicy: 'no-referrer', keepalive: true }).catch(() => {});
}
export function WebVitals() {
  useReportWebVitals(report);
  return null;
}
