// lib/stop-calculator.ts
//
// Smart stop-loss using Asaf's combined method:
// Compute every technical stop candidate; all labels use EMA terminology.

import type { DailyCandle, MarketData } from './market-data';

export const MAX_STOP_DISTANCE_PCT = 10;
export const STOP_BUFFER_PCT = 0.5;
export const SWING_LOW_WINDOW = 20;
export const BASE_LOW_WINDOW = 60;

export type StopType =
  | 'below_ema50'            // Minervini: violation of 50-EMA
  | 'below_ema20'            // Minervini: momentum trailing stop
  | 'below_swing_low'        // recent 20-day swing low
  | 'below_pivot_day_low'    // Minervini: low of the breakout candle
  | 'below_7_8_pct'          // O'Neil: hard 8% maximum loss rule
  | 'below_base_low'         // 60-day base consolidation low
  | 'below_last_higher_low'; // Asaf: last higher-low above 20-EMA (Stage 2)

export interface StopCandidate {
  type: StopType;
  label: string;
  price: number;
  sourceLevel: number;
  sourceDate?: string;
  distancePct: number;
  valid: boolean;
  notes?: string;
}

export interface StopAnalysis {
  entry: number;
  candidates: StopCandidate[];
  recommended: StopCandidate | null;
  tradeBlocked: boolean;
  blockedReason?: string;
}

export interface StopCalculatorInput {
  entry: number;
  data: MarketData;
  breakoutPrice?: number;
  pivotDayLow?: number;  // low of the breakout candle (pass data.candles[0].low from API)
}

export function analyzeStops({
  entry,
  data,
  breakoutPrice,
  pivotDayLow,
}: StopCalculatorInput): StopAnalysis {
  if (!Number.isFinite(entry) || entry <= 0) {
    return emptyAnalysis(entry, 'Invalid entry price.');
  }

  const candidates: StopCandidate[] = [];

  // 1. Below 50-EMA — Minervini primary stop
  candidates.push(makeCandidate({
    type:        'below_ema50',
    label:       'Below 50-EMA',
    sourceLevel: data.ema50,
    entry,
    notes:       `50-EMA at $${data.ema50.toFixed(2)}`,
  }));

  // 2. Below 20-EMA — trailing stop for mid-Stage-2 adds
  if (entry > data.ema20) {
    candidates.push(makeCandidate({
      type:        'below_ema20',
      label:       'Below 20-EMA (trailing)',
      sourceLevel: data.ema20,
      entry,
      notes:       `20-EMA at $${data.ema20.toFixed(2)}`,
    }));
  }

  // 3. Below recent swing low (20 sessions)
  const swingLow = findSwingLow(data.candles, SWING_LOW_WINDOW);
  if (swingLow) {
    candidates.push(makeCandidate({
      type:        'below_swing_low',
      label:       'Below recent swing low',
      sourceLevel: swingLow.low,
      sourceDate:  swingLow.date,
      entry,
      notes:       `Swing low on ${swingLow.date}`,
    }));
  }

  // 4. Below pivot day low — Minervini: low of the breakout candle
  const pdl = pivotDayLow ?? data.candles[0]?.low;
  if (pdl && pdl > 0 && pdl < entry) {
    candidates.push(makeCandidate({
      type:        'below_pivot_day_low',
      label:       'Below pivot day low',
      sourceLevel: pdl,
      entry,
      notes:       `Breakout candle low $${pdl.toFixed(2)}`,
    }));
  }

  // 5. O'Neil 8% hard rule — no buffer, exactly 8% below entry
  const oneNeilStop = round2(entry * (1 - 0.08));
  const oneNeilDist = round4(((oneNeilStop - entry) / entry) * 100);
  candidates.push({
    type:         'below_7_8_pct',
    label:        "O'Neil 8% rule",
    price:        oneNeilStop,
    sourceLevel:  round2(entry),
    distancePct:  oneNeilDist,
    valid:        true,
    notes:        "O'Neil's 8% absolute maximum loss rule — always available",
  });

  // 6. Below base low (60 sessions)
  const baseLow = findSwingLow(data.candles, BASE_LOW_WINDOW);
  if (baseLow && baseLow.date !== swingLow?.date) {
    candidates.push(makeCandidate({
      type:        'below_base_low',
      label:       'Below base low',
      sourceLevel: baseLow.low,
      sourceDate:  baseLow.date,
      entry,
      notes:       `Base low on ${baseLow.date}`,
    }));
  }

  // 7. Below last higher-low above 20-EMA — Asaf's Stage 2 structure stop
  const higherLow = findLastHigherLow(data.candles, data.ema20);
  if (higherLow && higherLow.low < entry) {
    candidates.push(makeCandidate({
      type:        'below_last_higher_low',
      label:       'Below last higher low',
      sourceLevel: higherLow.low,
      sourceDate:  higherLow.date,
      entry,
      notes:       `Higher low on ${higherLow.date} (above 20-EMA)`,
    }));
  }

  // User-supplied breakout pivot level
  if (breakoutPrice && breakoutPrice > 0 && breakoutPrice < entry) {
    candidates.push(makeCandidate({
      type:        'below_swing_low',  // reuses swing_low slot for pivot
      label:       'Below pivot / breakout',
      sourceLevel: breakoutPrice,
      entry,
      notes:       `Pivot at $${breakoutPrice.toFixed(2)}`,
    }));
  }

  const validCandidates = candidates.filter((c) => c.valid);
  validCandidates.sort((a, b) => Math.abs(a.distancePct) - Math.abs(b.distancePct));
  const recommended = validCandidates[0] ?? null;

  const tradeBlocked = recommended === null;
  const blockedReason = tradeBlocked
    ? `No valid technical stop within ${MAX_STOP_DISTANCE_PCT}% of entry. Base is too wide — wait for tighter consolidation.`
    : undefined;

  return {
    entry,
    candidates,
    recommended,
    tradeBlocked,
    blockedReason,
  };
}

function makeCandidate({
  type, label, sourceLevel, sourceDate, entry, notes,
}: {
  type: StopType;
  label: string;
  sourceLevel: number;
  sourceDate?: string;
  entry: number;
  notes?: string;
}): StopCandidate {
  const price = sourceLevel * (1 - STOP_BUFFER_PCT / 100);
  const distancePct = ((price - entry) / entry) * 100;
  const valid = Math.abs(distancePct) <= MAX_STOP_DISTANCE_PCT && price < entry && price > 0;

  return {
    type,
    label,
    price: round2(price),
    sourceLevel: round2(sourceLevel),
    sourceDate,
    distancePct: round4(distancePct),
    valid,
    notes,
  };
}

interface SwingPoint {
  low: number;
  date: string;
  index: number;
}

function findSwingLow(candles: DailyCandle[], window: number): SwingPoint | null {
  const slice = candles.slice(0, Math.min(window, candles.length));
  if (slice.length === 0) return null;

  let minIdx = 0;
  for (let i = 1; i < slice.length; i++) {
    if (slice[i].low < slice[minIdx].low) minIdx = i;
  }
  return { low: slice[minIdx].low, date: slice[minIdx].date, index: minIdx };
}

// Scan last `window` candles for a local low that sits above the 20-EMA (Stage 2 structure).
function findLastHigherLow(candles: DailyCandle[], ema20: number): { low: number; date: string } | null {
  const window = Math.min(40, candles.length);
  for (let i = 1; i < window - 1; i++) {
    const low = candles[i].low;
    if (low > ema20 && low < candles[i - 1].low && low < candles[i + 1].low) {
      return { low, date: candles[i].date };
    }
  }
  return null;
}

function emptyAnalysis(entry: number, reason: string): StopAnalysis {
  return {
    entry,
    candidates: [],
    recommended: null,
    tradeBlocked: true,
    blockedReason: reason,
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const round4 = (n: number) => Math.round(n * 10000) / 10000;
