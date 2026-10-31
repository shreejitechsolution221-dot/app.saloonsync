import 'server-only';
import { Ratelimit } from '@upstash/ratelimit';
import { redis } from './redis';
import { headers } from 'next/headers';

export const loginLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '1 m'),
      analytics: false,
      prefix: 'ratelimit:login',
    })
  : null;

export const registerLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, '1 m'),
      analytics: false,
      prefix: 'ratelimit:register',
    })
  : null;

export async function getClientIp(): Promise<string> {
  try {
    const h = await headers();
    const forwarded = h.get('x-forwarded-for');
    if (forwarded) {
      const first = forwarded.split(',')[0].trim();
      if (first) return first;
    }
    const realIp = h.get('x-real-ip')?.trim();
    if (realIp) return realIp;
  } catch {
    // Missing headers context (e.g. in test runner or mock)
  }
  return '127.0.0.1';
}

/**
 * Checks rate limit for login: 10 attempts per minute per IP + email.
 * Fails open (returns true) if Redis is unavailable, errors, or times out.
 */
export async function limitLogin(ip: string, email: string): Promise<boolean> {
  if (!loginLimiter) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[ratelimit] Redis unavailable; skipping login rate limit check (fail open)');
    }
    return true;
  }
  try {
    const identifier = `${ip}:${email.toLowerCase().trim()}`;
    const res = await loginLimiter.limit(identifier);
    return res.success;
  } catch (error) {
    console.warn('[ratelimit] Redis login limit check failed; failing open:', error instanceof Error ? error.message : error);
    return true;
  }
}

/**
 * Checks rate limit for register: 5 attempts per minute per IP.
 * Fails open (returns true) if Redis is unavailable, errors, or times out.
 */
export async function limitRegister(ip: string): Promise<boolean> {
  if (!registerLimiter) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[ratelimit] Redis unavailable; skipping register rate limit check (fail open)');
    }
    return true;
  }
  try {
    const res = await registerLimiter.limit(ip);
    return res.success;
  } catch (error) {
    console.warn('[ratelimit] Redis register limit check failed; failing open:', error instanceof Error ? error.message : error);
    return true;
  }
}

