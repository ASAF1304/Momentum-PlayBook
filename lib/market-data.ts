// lib/market-data.ts
//
// Yahoo Finance market-data service.
// Computes real exponential moving averages (EMA) — not SMA with an EMA label.
// Aligned with Asaf's methodology doc and Minervini's Trend Template.

import YahooFinance from 'yahoo-finance2';

const yahooFinance = new YahooFinance();

// ---- Types --------------------------------------------------------------

export interface DailyCandle {
  date: string;    // 'YYYY-MM-DD'
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketData {
  ticker: string;
  fetchedAt: string;
  latestDate: string;
  price: number;
  previousClose: number;
  dayChangePct: number;
  candles: DailyCandle[];

  // Exponential moving averages (the "EMA" names Asaf wants)
  ema20: number;
  ema50: number;
  ema150: number;
  ema200: number;

  // Simple moving average (used for Minervini's 50-EMA > 200-SMA condition)
  sma200: number;

  // 200 EMA ~80 trading days (~4 months) ago — for uptrend detection
  ema200_80daysAgo: number;

  // Volume analytics (for VCP confirmation)
  volumeAvg50: number;       // 50-day avg volume
  latestVolume: number;      // Today's volume

  // 52-week stats (backward-compat: never null, uses min(252, length) bars)
  high52w: number;
  low52w: number;
  distanceFrom52wHigh: number;  // % below (negative)
  distanceFrom52wLow: number;   // % above (positive)

  // Nullable 52-week stats — null when history < 252 bars
  distance_from_52wh_pct: number | null;
  distance_from_52wl_pct: number | null;

  // ATH-anchored AVWAP (Minervini / institutional cost basis)
  ath_date:                 string | null;
  ath_avwap:                number | null;
  above_ath_avwap:          boolean | null;
  ath_avwap_low_confidence: boolean;   // true when bars-since-ATH < 20
}

export class MarketDataError extends Error {
  constructor(
    message: string,
    public readonly code: 'rate_limit' | 'invalid_ticker' | 'api_error' | 'no_key' | 'parse_error',
    public readonly retryable: boolean = false,
  ) {
    super(message);
    this.name = 'MarketDataError';
  }
}

// ---- Cache --------------------------------------------------------------

const _cache = new Map<string, { data: MarketData; ts: number }>();
const CACHE_TTL_MS = 60_000; // 60 seconds

// ---- Main fetch ---------------------------------------------------------

export async function getMarketData(symbol: string): Promise<MarketData> {
  const ticker = symbol.trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9.-]{0,9}$/.test(ticker)) {
    throw new MarketDataError(`Invalid ticker symbol: "${symbol}"`, 'invalid_ticker');
  }

  const cached = _cache.get(ticker);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    console.log(`[TICKER-API] cache hit for ${ticker}`);
    return cached.data;
  }

  // 5 years: enough for EMA warm-up, 52-week window, AND full ATH AVWAP history
  const period2 = new Date();
  const period1 = new Date();
  period1.setFullYear(period2.getFullYear() - 5);

  let chartData;
  try {
    const _t0 = Date.now();
    chartData = await yahooFinance.chart(ticker, {
      period1,
      period2,
      interval: '1d',
    });
    console.log(`[TICKER-API] yahoo-finance2.chart(${ticker}) ${Date.now() - _t0}ms — ${chartData?.quotes?.length ?? 0} candles`);
  } catch (err) {
    const msg = (err as Error).message ?? '';
    if (msg.includes('Not Found') || msg.includes('404') || msg.toLowerCase().includes('no data')) {
      throw new MarketDataError(
        `Ticker "${ticker}" not found on Yahoo Finance.`,
        'invalid_ticker',
      );
    }
    throw new MarketDataError(
      `Yahoo Finance request failed: ${msg}`,
      'api_error',
      true,
    );
  }

  if (!chartData?.quotes?.length) {
    throw new MarketDataError(
      `Yahoo Finance returned no candle data for "${ticker}".`,
      'parse_error',
    );
  }

  // Newest-first (canonical order throughout)
  const candles: DailyCandle[] = chartData.quotes
    .filter((q) => q.open != null && q.close != null && q.high != null && q.low != null)
    .map((q): DailyCandle => ({
      date: toISODate(q.date),
      open: q.open as number,
      high: q.high as number,
      low: q.low as number,
      close: q.close as number,
      volume: (q.volume ?? 0) as number,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));

  if (candles.length < 200) {
    throw new MarketDataError(
      `Not enough history for ${ticker} (got ${candles.length} days, need 200+). IPO'd recently?`,
      'invalid_ticker',
    );
  }

  const closes = candles.map((c) => c.close);

  // 200-day SMA (simple average of latest 200 closes; closes is newest-first)
  const sma200 = avg(closes.slice(0, 200));

  // Compute EMAs (oldest-first order, then grab the last = most-recent value)
  const ema20Series  = emaSeries(closes, 20);
  const ema50Series  = emaSeries(closes, 50);
  const ema150Series = emaSeries(closes, 150);
  const ema200Series = emaSeries(closes, 200);

  const ema20  = ema20Series[ema20Series.length - 1];
  const ema50  = ema50Series[ema50Series.length - 1];
  const ema150 = ema150Series[ema150Series.length - 1];
  const ema200 = ema200Series[ema200Series.length - 1];

  // EMA 200 from 80 trading days ago
  const offset = Math.min(80, ema200Series.length - 1);
  const ema200_80daysAgo = ema200Series[ema200Series.length - 1 - offset];

  const volumes = candles.map((c) => c.volume);
  const latestVolume = volumes[0];
  const volumeAvg50 = avg(volumes.slice(0, 50));

  const price = candles[0].close;
  const previousClose = candles[1]?.close ?? price;
  const dayChangePct = ((price - previousClose) / previousClose) * 100;

  // Backward-compat 52w (never null — uses whatever bars are available)
  const legacyWindow = candles.slice(0, Math.min(252, candles.length));
  const high52w = Math.max(...legacyWindow.map((c) => c.high));
  const low52w  = Math.min(...legacyWindow.map((c) => c.low));
  const distanceFrom52wHigh = ((price - high52w) / high52w) * 100;
  const distanceFrom52wLow  = ((price - low52w)  / low52w)  * 100;

  // New nullable 52w stats (null when < 252 bars per spec)
  const stats52w = compute52wStats(candles, price);

  // ATH AVWAP — uses oldest-first bars (full 5-year history)
  const candlesOldestFirst = [...candles].reverse();
  const athAvwap = computeATHAvwap(candlesOldestFirst, price);

  const result: MarketData = {
    ticker,
    fetchedAt: new Date().toISOString(),
    latestDate: candles[0].date,
    price,
    previousClose,
    dayChangePct,
    candles,
    ema20,
    ema50,
    ema150,
    ema200,
    sma200,
    ema200_80daysAgo,
    volumeAvg50,
    latestVolume,
    high52w,
    low52w,
    distanceFrom52wHigh,
    distanceFrom52wLow,
    ...stats52w,
    ...athAvwap,
  };

  _cache.set(ticker, { data: result, ts: Date.now() });
  return result;
}

// ---- ATH-anchored AVWAP -------------------------------------------------

/**
 * Compute AVWAP anchored to the all-time high bar.
 * Exported for unit testing (no network calls needed in tests).
 *
 * @param barsOldestFirst  DailyCandle[] sorted oldest → newest
 * @param currentPrice     Most-recent closing price
 */
export function computeATHAvwap(
  barsOldestFirst: DailyCandle[],
  currentPrice: number,
): Pick<MarketData, 'ath_date' | 'ath_avwap' | 'above_ath_avwap' | 'ath_avwap_low_confidence'> {
  if (barsOldestFirst.length === 0) {
    return { ath_date: null, ath_avwap: null, above_ath_avwap: null, ath_avwap_low_confidence: false };
  }

  // Find the bar with the highest high across full history
  let athIdx = 0;
  let athHigh = barsOldestFirst[0].high;
  for (let i = 1; i < barsOldestFirst.length; i++) {
    if (barsOldestFirst[i].high > athHigh) {
      athHigh = barsOldestFirst[i].high;
      athIdx   = i;
    }
  }

  const ath_date = barsOldestFirst[athIdx].date;

  // Accumulate AVWAP from ATH bar inclusive → most recent bar
  let cumPV = 0;
  let cumV  = 0;
  let barsWithVolume = 0;

  for (let i = athIdx; i < barsOldestFirst.length; i++) {
    const bar = barsOldestFirst[i];
    if (bar.volume <= 0) continue;           // skip zero-volume bars (no div-by-zero, no pollution)
    const tp = (bar.high + bar.low + bar.close) / 3;
    cumPV += tp * bar.volume;
    cumV  += bar.volume;
    barsWithVolume++;
  }

  if (cumV === 0) {
    return { ath_date, ath_avwap: null, above_ath_avwap: null, ath_avwap_low_confidence: true };
  }

  const ath_avwap                = round4(cumPV / cumV);
  const above_ath_avwap          = currentPrice >= ath_avwap;
  const ath_avwap_low_confidence = barsWithVolume < 20;

  return { ath_date, ath_avwap, above_ath_avwap, ath_avwap_low_confidence };
}

// ---- Nullable 52-week stats ---------------------------------------------

/**
 * Compute 52-week high/low and distances — returns null fields when < 252 bars.
 * Exported for unit testing.
 *
 * @param barsNewestFirst  DailyCandle[] sorted newest → oldest
 * @param price            Most-recent closing price
 */
export function compute52wStats(
  barsNewestFirst: DailyCandle[],
  price: number,
): Pick<MarketData, 'distance_from_52wh_pct' | 'distance_from_52wl_pct'> {
  if (barsNewestFirst.length < 252) {
    return { distance_from_52wh_pct: null, distance_from_52wl_pct: null };
  }
  const window = barsNewestFirst.slice(0, 252);
  const h = Math.max(...window.map((c) => c.high));
  const l = Math.min(...window.map((c) => c.low));
  return {
    distance_from_52wh_pct: round4(((price - h) / h) * 100),
    distance_from_52wl_pct: round4(((price - l) / l) * 100),
  };
}

// ---- EMA math -----------------------------------------------------------

/**
 * Compute the full EMA series for an array of closing prices.
 * Input is newest-first (our canonical order).  We flip to oldest-first,
 * seed the EMA with the SMA of the first N values, then roll forward.
 * Returns the series in oldest-first order so the last element is "today's" EMA.
 */
function emaSeries(newestFirst: number[], period: number): number[] {
  if (newestFirst.length < period) return [avg(newestFirst)];

  const oldestFirst = [...newestFirst].reverse();
  const k = 2 / (period + 1);
  const out: number[] = [];

  // Seed EMA with SMA of the first `period` values
  let ema = avg(oldestFirst.slice(0, period));
  out.push(ema);

  for (let i = period; i < oldestFirst.length; i++) {
    ema = (oldestFirst[i] - ema) * k + ema;
    out.push(ema);
  }
  return out;
}

// ---- Utilities ----------------------------------------------------------

function toISODate(d: Date | string): string {
  if (typeof d === 'string') return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
