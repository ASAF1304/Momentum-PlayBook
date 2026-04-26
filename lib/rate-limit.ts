// lib/rate-limit.ts
//
// Upstash Redis sliding-window rate limiter.
// Gracefully no-ops when UPSTASH_REDIS_REST_URL / TOKEN are absent (dev mode).

import { Ratelimit } from '@upstash/ratelimit';
import { Redis }     from '@upstash/redis';

let _redis: Redis | null = null;

function getRedis(): Redis | null {
  if (_redis) return _redis;
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  _redis = new Redis({ url, token });
  return _redis;
}

function makeLimiter(requests: number, windowSeconds: number): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(requests, `${windowSeconds}s`),
    analytics: false,
  });
}

// 30 requests per 60 s — used on the ticker data API (by IP)
let _tickerLimiter: Ratelimit | null | undefined = undefined;
export function getTickerLimiter(): Ratelimit | null {
  if (_tickerLimiter !== undefined) return _tickerLimiter;
  return (_tickerLimiter = makeLimiter(30, 60));
}

// 60 requests per 60 s — used on write / live-price routes (by user ID or IP)
let _writeLimiter: Ratelimit | null | undefined = undefined;
export function getWriteLimiter(): Ratelimit | null {
  if (_writeLimiter !== undefined) return _writeLimiter;
  return (_writeLimiter = makeLimiter(60, 60));
}

/**
 * Check the given limiter for the identifier.
 * Returns `{ allowed: true }` when rate limiting is disabled (no env vars).
 * Returns `{ allowed: false, retryAfter }` when the limit is exceeded.
 */
export async function checkLimit(
  limiter: Ratelimit | null,
  identifier: string,
): Promise<{ allowed: boolean; retryAfter?: number }> {
  if (!limiter) return { allowed: true };

  const { success, reset } = await limiter.limit(identifier);
  if (success) return { allowed: true };

  const retryAfter = Math.ceil((reset - Date.now()) / 1000);
  return { allowed: false, retryAfter };
}
