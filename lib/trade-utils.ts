// lib/trade-utils.ts
// Shared trade calculation helpers — used by Journal and Playbook pages.

import type { Trade, PartialExit } from './supabase-client';

export const getPartials = (t: Trade): PartialExit[] =>
  Array.isArray(t.partials) ? t.partials : [];

export const getSells = (t: Trade) =>
  getPartials(t).filter(p => (p.action ?? 'sell') === 'sell');

export const getBuys = (t: Trade) =>
  getPartials(t).filter(p => p.action === 'buy');

/** Weighted average entry price across initial lot + all scale-in buys. */
export const computeAvgEntry = (t: Trade): number => {
  const buys = getBuys(t);
  if (buys.length === 0) return t.phase1_price;
  const extraShares   = buys.reduce((s, p) => s + p.shares, 0);
  const totalShares   = t.phase1_shares + extraShares;
  const totalInvested = t.phase1_price * t.phase1_shares
                      + buys.reduce((s, p) => s + p.shares * p.price, 0);
  return totalInvested / totalShares;
};

/** Total capital deployed — used as PnL% denominator. */
export const computeTotalInvested = (t: Trade): number => {
  const buys = getBuys(t);
  return t.phase1_price * t.phase1_shares
       + buys.reduce((s, p) => s + p.shares * p.price, 0);
};

/** Current shares — computed from first principles so DB default-0 can't corrupt it. */
export const getCurrentShares = (t: Trade): number => {
  const sold  = getSells(t).reduce((s, p) => s + p.shares, 0);
  const added = getBuys(t).reduce((s, p) => s + p.shares, 0);
  return t.phase1_shares + added - sold;
};
