// lib/stats/win-rate.ts
//
// Single source of truth for Win Rate and related trade statistics.
// Both /journal and /playbook must import from here to stay in sync.
//
// Definition:
//   win  = closed trade where outcome === 'winner'
//   Win Rate = wins / all closed (non-open) trades
//   A "closed" trade has status !== 'open'
//   Imported (is_what_if) trades are included in both pages.

import type { Trade } from '@/lib/supabase-client';

export interface WinRateStats {
  winRate:     number | null;   // null when no closed trades
  wins:        number;
  losses:      number;
  breakevens:  number;
  closedCount: number;
  avgR:        number | null;
  totalPnL:    number;
}

function retroR(t: Trade): number | null {
  const exit  = t.exit_price;
  const entry = t.phase1_price;
  const stop  = t.initial_stop;
  if (exit == null || entry == null || stop == null) return null;
  const risk = entry - stop;
  if (risk <= 0) return null;
  return (exit - entry) / risk;
}

export function computeWinRate(trades: Trade[]): WinRateStats {
  const closed     = trades.filter(t => t.status !== 'open' && t.outcome !== null);
  const wins       = closed.filter(t => t.outcome === 'winner').length;
  const losses     = closed.filter(t => t.outcome === 'loser').length;
  const breakevens = closed.filter(t => t.outcome === 'breakeven').length;
  const totalPnL   = closed.reduce((s, t) => s + (t.pnl_dollars ?? 0), 0);

  const rValues = closed
    .map(t => t.r_multiple ?? retroR(t))
    .filter((r): r is number => r !== null);

  return {
    winRate:     closed.length > 0 ? (wins / closed.length) * 100 : null,
    wins,
    losses,
    breakevens,
    closedCount: closed.length,
    avgR:        rValues.length > 0 ? rValues.reduce((s, r) => s + r, 0) / rValues.length : null,
    totalPnL,
  };
}
