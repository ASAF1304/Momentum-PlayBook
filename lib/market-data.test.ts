// lib/market-data.test.ts
//
// Deterministic unit tests for computeATHAvwap and compute52wStats.
// No network calls — pure math on hand-crafted candle fixtures.

import { describe, it, expect } from 'vitest';
import { computeATHAvwap, compute52wStats, type DailyCandle } from './market-data';

// ── Helpers ───────────────────────────────────────────────────────────────────

function bar(date: string, high: number, low: number, close: number, volume = 1_000_000): DailyCandle {
  return { date, open: low, high, low, close, volume };
}

// ── computeATHAvwap ───────────────────────────────────────────────────────────

describe('computeATHAvwap', () => {
  it('returns all nulls for empty input', () => {
    const result = computeATHAvwap([], 100);
    expect(result.ath_date).toBeNull();
    expect(result.ath_avwap).toBeNull();
    expect(result.above_ath_avwap).toBeNull();
    expect(result.ath_avwap_low_confidence).toBe(false);
  });

  it('single bar: AVWAP equals typical price', () => {
    const b = bar('2024-01-02', 110, 90, 100, 500_000);
    const result = computeATHAvwap([b], 105);
    expect(result.ath_date).toBe('2024-01-02');
    // tp = (110 + 90 + 100) / 3 = 100
    expect(result.ath_avwap).toBe(100);
    expect(result.above_ath_avwap).toBe(true);   // 105 >= 100
    expect(result.ath_avwap_low_confidence).toBe(true); // 1 bar < 20
  });

  it('3-bar series: ATH is bar 2, AVWAP from bar 2 onward', () => {
    const bars: DailyCandle[] = [
      bar('2024-01-01', 100, 90, 95,  1_000_000),  // high = 100
      bar('2024-01-02', 200, 180, 190, 2_000_000), // ATH high = 200
      bar('2024-01-03', 150, 130, 140, 1_000_000),
    ];
    const result = computeATHAvwap(bars, 145);
    expect(result.ath_date).toBe('2024-01-02');
    // bar2 tp = (200+180+190)/3 = 190;  pv2 = 190*2_000_000 = 380_000_000
    // bar3 tp = (150+130+140)/3 = 140;  pv3 = 140*1_000_000 = 140_000_000
    // cumPV = 520_000_000; cumV = 3_000_000; AVWAP = 173.3333...
    expect(result.ath_avwap).toBeCloseTo(173.3333, 2);
    expect(result.above_ath_avwap).toBe(false);  // 145 < 173.33
  });

  it('skips zero-volume bars in AVWAP accumulation', () => {
    const bars: DailyCandle[] = [
      bar('2024-01-01', 200, 180, 190, 0),         // zero-volume — skipped for AVWAP but ATH still here
      bar('2024-01-02', 180, 160, 170, 1_000_000),
    ];
    // bar[0] has highest high (200), so ath is bar[0].
    // But bar[0] has volume=0, so it's skipped in AVWAP accumulation.
    // Only bar[1] contributes: tp = (180+160+170)/3 = 170
    const result = computeATHAvwap(bars, 165);
    expect(result.ath_date).toBe('2024-01-01');
    expect(result.ath_avwap).toBe(170);
    expect(result.above_ath_avwap).toBe(false);   // 165 < 170
    expect(result.ath_avwap_low_confidence).toBe(true); // only 1 bar with volume
  });

  it('low_confidence flag: true when bars-with-volume < 20', () => {
    const bars = Array.from({ length: 19 }, (_, i) =>
      bar(`2024-01-${String(i + 1).padStart(2, '0')}`, 100 + i, 90 + i, 95 + i),
    );
    // ATH is last bar (largest high = 118)
    const result = computeATHAvwap(bars, 114);
    expect(result.ath_avwap_low_confidence).toBe(true);  // 1 bar since ATH
  });

  it('low_confidence flag: false when bars-with-volume >= 20', () => {
    const bars = Array.from({ length: 25 }, (_, i) =>
      bar(`2024-01-${String(i + 1).padStart(2, '0')}`, 100, 90, 95), // all same high
    );
    // ATH is bar[0]; all 25 bars accumulate
    const result = computeATHAvwap(bars, 94);
    expect(result.ath_avwap_low_confidence).toBe(false);
  });
});

// ── compute52wStats ───────────────────────────────────────────────────────────

describe('compute52wStats', () => {
  it('returns null fields when fewer than 252 bars', () => {
    const bars = Array.from({ length: 251 }, (_, i) => bar(`2024-01-${i + 1}`, 100, 80, 90));
    const result = compute52wStats(bars, 90);
    expect(result.distance_from_52wh_pct).toBeNull();
    expect(result.distance_from_52wl_pct).toBeNull();
  });

  it('returns computed distances for exactly 252 bars', () => {
    // Bars newest-first. Make first bar high=200, last bar low=50; rest neutral.
    const bars: DailyCandle[] = [
      bar('2025-01-01', 200, 180, 190),  // newest — highest high
      ...Array.from({ length: 250 }, (_, i) => bar(`2024-06-${i + 1}`, 100, 80, 90)),
      bar('2023-01-01', 100, 50, 70),    // oldest — lowest low
    ];
    // price = 190; high = 200; low = 50
    const result = compute52wStats(bars, 190);
    // distance from high: (190-200)/200 * 100 = -5.0%
    expect(result.distance_from_52wh_pct).toBeCloseTo(-5.0, 2);
    // distance from low: (190-50)/50 * 100 = +280.0%
    expect(result.distance_from_52wl_pct).toBeCloseTo(280.0, 2);
  });

  it('negative distance_from_52wh when price is below the high', () => {
    const bars: DailyCandle[] = [
      bar('2025-01-01', 150, 100, 120),   // high = 150
      ...Array.from({ length: 251 }, () => bar('2024-01-01', 100, 80, 90)),
    ];
    const result = compute52wStats(bars, 120);
    expect(result.distance_from_52wh_pct).toBeLessThan(0);
  });

  it('positive distance_from_52wl when price is above the low', () => {
    const bars: DailyCandle[] = [
      ...Array.from({ length: 251 }, () => bar('2024-06-01', 100, 80, 90)),
      bar('2023-01-01', 100, 40, 50),    // low = 40
    ];
    const result = compute52wStats(bars, 90);
    expect(result.distance_from_52wl_pct).toBeGreaterThan(0);
  });
});
