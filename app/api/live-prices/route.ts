// app/api/live-prices/route.ts
//
// POST { tickers: string[] } → { prices: Record<string, LivePrice>, fetchedAt: string }
// Uses yahoo-finance2 .quote() — current-day data only, much faster than .chart().
// Concurrent per-ticker fetches with Promise.allSettled so one failure doesn't block others.

import { type NextRequest, NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';
import { checkLimit, getWriteLimiter } from '@/lib/rate-limit';

const yf = new YahooFinance();

// ── 8-second server-side cache ─────────────────────────────────────────────────
// Deduplicates concurrent users polling the same ticker sets.
// Per-instance (not shared across Vercel lambdas) but still cuts Yahoo calls
// significantly at low-to-medium traffic.
interface CacheEntry { data: LivePricesResponse; expiresAt: number }
const _cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 8_000;

function cacheKey(tickers: string[]): string { return [...tickers].sort().join(','); }

export interface LivePrice {
  ticker: string;
  price: number;
  changePct: number;
  dayHigh: number;
  dayLow: number;
}

export interface LivePricesResponse {
  prices: Record<string, LivePrice>;
  fetchedAt: string;
}

export async function POST(request: NextRequest) {
  // Rate limit: 60 req / 60s per IP
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'anon';
  const limit = await checkLimit(getWriteLimiter(), `live-prices:${ip}`);
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, {
      status: 429,
      headers: { 'Retry-After': String(limit.retryAfter ?? 60) },
    });
  }

  let body: { tickers?: unknown };
  try {
    body = await request.json() as { tickers?: unknown };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const raw = body?.tickers;
  if (!Array.isArray(raw) || raw.length === 0) {
    return NextResponse.json({ error: 'tickers array required' }, { status: 400 });
  }

  // Sanitise + dedupe, max 25 tickers per call
  const tickers: string[] = [...new Set(
    (raw as unknown[])
      .filter((t): t is string => typeof t === 'string' && t.length > 0)
      .map(t => t.toUpperCase().trim())
      .filter(t => /^[A-Z][A-Z0-9.-]{0,9}$/.test(t)),
  )].slice(0, 25);

  // Check cache before hitting Yahoo
  const key    = cacheKey(tickers);
  const cached = _cache.get(key);
  if (cached && Date.now() < cached.expiresAt) {
    return NextResponse.json(cached.data);
  }

  const prices: Record<string, LivePrice> = {};

  await Promise.allSettled(
    tickers.map(async (ticker) => {
      try {
        const q = await yf.quote(ticker);
        prices[ticker] = {
          ticker,
          price:     q.regularMarketPrice      ?? 0,
          changePct: q.regularMarketChangePercent ?? 0,
          dayHigh:   q.regularMarketDayHigh    ?? 0,
          dayLow:    q.regularMarketDayLow     ?? 0,
        };
      } catch {
        // Skip silently; caller checks for missing keys
      }
    }),
  );

  const responseData: LivePricesResponse = { prices, fetchedAt: new Date().toISOString() };

  // Populate cache; evict stale entries when it grows large
  _cache.set(key, { data: responseData, expiresAt: Date.now() + CACHE_TTL_MS });
  if (_cache.size > 200) {
    const now = Date.now();
    for (const [k, v] of _cache) { if (v.expiresAt < now) _cache.delete(k); }
  }

  return NextResponse.json(responseData);
}
