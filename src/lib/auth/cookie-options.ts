// Production builds may run on local HTTP during development. Keep Secure on
// everywhere except the explicitly configured loopback development origin.
import { isLoopbackHttp } from './origin';
export function secureAuthCookies(origin = process.env.APP_ORIGIN) {
  if (!origin) return process.env.NODE_ENV === 'production';
  try { return !isLoopbackHttp(new URL(origin)); }
  catch { return true; }
}
