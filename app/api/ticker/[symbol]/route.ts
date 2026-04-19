// app/api/ticker/[symbol]/route.ts
//
// GET /api/ticker/NVDA — returns fully-analyzed ticker data.
// All moving averages labeled as EMA (Asaf's methodology).

import { NextResponse } from 'next/server';
import { getMarketData, MarketDataError, type MarketData } from '@/lib/market-data';
import { analyzeStops, type StopAnalysis } from '@/lib/stop-calculator';

export interface TickerResponse {
  ticker: string;
  fetchedAt: string;
  latestDate: string;
  price: {
    last: number;
    previousClose: number;
    dayChangePct: number;
  };
  movingAverages: {
    ema20: number;
    ema50: number;
    ema150: number;
    ema200: number;
  };
  volume: {
    latest: number;
    avg50: number;
    ratio: number;       // latest / avg50  (>1 = spike; <1 = drying up)
  };
  range52w: {
    high: number;
    low: number;
    distanceFromHigh: number;
    distanceFromLow: number;
  };
  trendTemplate: {
    passed: boolean;
    checks: {
      priceAboveEMA20:        { passed: boolean; detail: string };
      priceAboveEMA50:        { passed: boolean; detail: string };
      priceAboveEMA150:       { passed: boolean; detail: string };
      priceAboveEMA200:       { passed: boolean; detail: string };
      ema50AboveEma150:       { passed: boolean; detail: string };
      ema150AboveEma200:      { passed: boolean; detail: string };
      ema200Uptrending:       { passed: boolean; detail: string };
      closeTo52wHigh:         { passed: boolean; detail: string };
      farFrom52wLow:          { passed: boolean; detail: string };
    };
  };
  volumeCheck: {
    spikeOnBreakout: boolean;   // latest > 1.5× avg
    ratio: number;
    detail: string;
  };
  stops: StopAnalysis;
}

export interface TickerErrorResponse {
  error: string;
  code: 'rate_limit' | 'invalid_ticker' | 'api_error' | 'no_key' | 'parse_error' | 'unknown';
  retryable: boolean;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const { symbol } = await params;

  try {
    const data = await getMarketData(symbol);
    const stops = analyzeStops({ entry: data.price, data, pivotDayLow: data.candles[0]?.low });
    return NextResponse.json(buildResponse(data, stops));
  } catch (err) {
    if (err instanceof MarketDataError) {
      return NextResponse.json<TickerErrorResponse>(
        { error: err.message, code: err.code, retryable: err.retryable },
        { status: err.code === 'rate_limit' ? 429 : err.code === 'invalid_ticker' ? 404 : 502 },
      );
    }
    console.error('[api/ticker] unexpected error:', err);
    return NextResponse.json<TickerErrorResponse>(
      { error: 'Unexpected server error.', code: 'unknown', retryable: true },
      { status: 500 },
    );
  }
}

function buildResponse(data: MarketData, stops: StopAnalysis): TickerResponse {
  const {
    price, ema20, ema50, ema150, ema200, ema200_80daysAgo,
    volumeAvg50, latestVolume,
    high52w, low52w, distanceFrom52wHigh, distanceFrom52wLow,
  } = data;

  const priceAboveEMA20  = price > ema20;
  const priceAboveEMA50  = price > ema50;
  const priceAboveEMA150 = price > ema150;
  const priceAboveEMA200 = price > ema200;
  const ema50AboveEma150 = ema50 > ema150;
  const ema150AboveEma200 = ema150 > ema200;
  const ema200Uptrending = ema200 > ema200_80daysAgo;
  const closeTo52wHigh = distanceFrom52wHigh >= -25;
  const farFrom52wLow  = distanceFrom52wLow  >=  30;

  const checks = {
    priceAboveEMA20: {
      passed: priceAboveEMA20,
      detail: `$${price.toFixed(2)} vs 20-EMA $${ema20.toFixed(2)}`,
    },
    priceAboveEMA50: {
      passed: priceAboveEMA50,
      detail: `$${price.toFixed(2)} vs 50-EMA $${ema50.toFixed(2)}`,
    },
    priceAboveEMA150: {
      passed: priceAboveEMA150,
      detail: `$${price.toFixed(2)} vs 150-EMA $${ema150.toFixed(2)}`,
    },
    priceAboveEMA200: {
      passed: priceAboveEMA200,
      detail: `$${price.toFixed(2)} vs 200-EMA $${ema200.toFixed(2)}`,
    },
    ema50AboveEma150: {
      passed: ema50AboveEma150,
      detail: `50-EMA vs 150-EMA`,
    },
    ema150AboveEma200: {
      passed: ema150AboveEma200,
      detail: `150-EMA vs 200-EMA`,
    },
    ema200Uptrending: {
      passed: ema200Uptrending,
      detail: `200-EMA ${ema200Uptrending ? 'up' : 'down'} over last 4 months`,
    },
    closeTo52wHigh: {
      passed: closeTo52wHigh,
      detail: `${Math.abs(distanceFrom52wHigh).toFixed(1)}% below 52w high`,
    },
    farFrom52wLow: {
      passed: farFrom52wLow,
      detail: `${distanceFrom52wLow.toFixed(1)}% above 52w low`,
    },
  };

  const passed = Object.values(checks).every((c) => c.passed);

  const volumeRatio = volumeAvg50 > 0 ? latestVolume / volumeAvg50 : 0;
  const spikeOnBreakout = volumeRatio >= 1.5;
  const volumeDetail = spikeOnBreakout
    ? `${volumeRatio.toFixed(1)}× avg — institutional buying`
    : `${volumeRatio.toFixed(1)}× avg — no volume spike today`;

  return {
    ticker: data.ticker,
    fetchedAt: data.fetchedAt,
    latestDate: data.latestDate,
    price: {
      last: data.price,
      previousClose: data.previousClose,
      dayChangePct: data.dayChangePct,
    },
    movingAverages: { ema20, ema50, ema150, ema200 },
    volume: {
      latest: latestVolume,
      avg50: volumeAvg50,
      ratio: volumeRatio,
    },
    range52w: {
      high: high52w,
      low: low52w,
      distanceFromHigh: distanceFrom52wHigh,
      distanceFromLow: distanceFrom52wLow,
    },
    trendTemplate: { passed, checks },
    volumeCheck: {
      spikeOnBreakout,
      ratio: volumeRatio,
      detail: volumeDetail,
    },
    stops,
  };
}
