// lib/stats/dashboard-stats.ts
//
// Extended stats helpers used exclusively by the Dashboard (and shared with Playbook
// for unrealized PnL). All functions are pure — no side-effects, no imports from React.

import type { Trade } from '@/lib/supabase-client';
import type { LivePrice } from '@/app/api/live-prices/route';
import { computeAvgEntry } from '@/lib/trade-utils';

// ── Period ────────────────────────────────────────────────────────────────────

export type Period = 'all' | 'ytd' | 'mtd' | '30d';

export function getPeriodStart(period: Period): string | null {
  if (period === 'all') return null;
  const now = new Date();
  let d: Date;
  if      (period === 'ytd') d = new Date(now.getFullYear(), 0, 1);
  else if (period === 'mtd') d = new Date(now.getFullYear(), now.getMonth(), 1);
  else                       d = new Date(Date.now() - 30 * 86_400_000);
  return d.toISOString();
}

/** Returns only closed (status !== 'open') trades whose exit_date falls within the period. */
export function filterClosedByPeriod(trades: Trade[], period: Period): Trade[] {
  const closed = trades.filter(t => t.status !== 'open');
  const start  = getPeriodStart(period);
  if (!start) return closed;
  return closed.filter(t => t.exit_date && t.exit_date >= start);
}

// ── Max Drawdown ───────────────────────────────────────────────────────────────

export interface DrawdownResult {
  pct:        number; // e.g. 12.4 for −12.4%
  fromAmount: number;
  toAmount:   number;
}

/**
 * Largest peak-to-trough equity decline over the supplied closed trades,
 * starting from `accountSize` as the equity baseline.
 * Returns null when there is nothing to compute (0 trades, or no drawdown).
 */
export function computeMaxDrawdown(
  closedTrades: Trade[],
  accountSize: number,
): DrawdownResult | null {
  const sorted = [...closedTrades]
    .filter(t => t.exit_date && t.pnl_dollars !== null)
    .sort((a, b) => new Date(a.exit_date!).getTime() - new Date(b.exit_date!).getTime());

  if (sorted.length === 0) return null;

  let equity = accountSize;
  let peak   = accountSize;
  let maxDD  = 0;
  let ddFrom = accountSize;
  let ddTo   = accountSize;

  for (const trade of sorted) {
    equity += trade.pnl_dollars!;
    if (equity > peak) peak = equity;
    const dd = peak > 0 ? (peak - equity) / peak : 0;
    if (dd > maxDD) { maxDD = dd; ddFrom = peak; ddTo = equity; }
  }

  if (maxDD === 0) return null;
  return { pct: maxDD * 100, fromAmount: ddFrom, toAmount: ddTo };
}

// ── Avg Win / Avg Loss ────────────────────────────────────────────────────────

export interface AvgWinLossResult {
  avgWin:    number | null; // absolute dollar average of winning trades
  winCount:  number;
  avgLoss:   number | null; // absolute dollar average of losing trades
  lossCount: number;
  ratio:     number | null; // avgWin / avgLoss
}

export function computeAvgWinLoss(closedTrades: Trade[]): AvgWinLossResult {
  const winners = closedTrades.filter(t => t.outcome === 'winner' && t.pnl_dollars !== null);
  const losers  = closedTrades.filter(t => t.outcome === 'loser'  && t.pnl_dollars !== null);

  const avgWin = winners.length > 0
    ? winners.reduce((s, t) => s + (t.pnl_dollars ?? 0), 0) / winners.length
    : null;
  const avgLoss = losers.length > 0
    ? Math.abs(losers.reduce((s, t) => s + (t.pnl_dollars ?? 0), 0) / losers.length)
    : null;
  const ratio = avgWin !== null && avgLoss !== null && avgLoss > 0
    ? avgWin / avgLoss
    : null;

  return { avgWin, winCount: winners.length, avgLoss, lossCount: losers.length, ratio };
}

// ── Unrealized PnL ────────────────────────────────────────────────────────────

/**
 * Sum of unrealized P&L across all supplied open trades for which a live price exists.
 * Uses `trade.current_shares ?? trade.phase1_shares` as the current position size.
 */
export function computeUnrealizedPnL(
  openTrades: Trade[],
  livePrices: Record<string, LivePrice>,
): number {
  return openTrades.reduce((sum, t) => {
    const price = livePrices[t.ticker]?.price;
    if (price == null) return sum;
    const shares = t.current_shares || t.phase1_shares;
    return sum + (price - computeAvgEntry(t)) * shares;
  }, 0);
}

// ── Per-position R-Multiple ───────────────────────────────────────────────────

/**
 * Current R-Multiple for an open position.
 * Returns null when stop === entry (zero risk).
 */
export function computeCurrentR(trade: Trade, currentPrice: number): number | null {
  const entry = computeAvgEntry(trade);
  const stop  = trade.current_stop ?? trade.initial_stop;
  const risk  = entry - stop;
  if (risk <= 0) return null;
  return (currentPrice - entry) / risk;
}
