// Production builds may run on local HTTP during development. Keep Secure on
// everywhere except the explicitly configured loopback development origin.
export function secureAuthCookies(origin = process.env.APP_ORIGIN) {
  if (!origin) return process.env.NODE_ENV === 'production';
  try { const url = new URL(origin); return !(url.protocol === 'http:' && url.hostname === 'localhost'); }
  catch { return true; }
}
