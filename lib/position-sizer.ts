// lib/position-sizer.ts
//
// The Momentum Playbook — core risk engine.
// Rule 1: Stop distance ≤ 10% (Livermore/O'Neil hard cap)
// Rule 2: Trade risk ≤ 2.5% of account

export const MAX_STOP_DISTANCE_PCT = 10;
export const MAX_PORTFOLIO_RISK_PCT = 2.5;
export const PHASE_1_FRACTION = 0.5;
export const PHASE_2_FRACTION = 0.5;

export interface PositionSizerInput {
  accountSize: number;
  entryPrice: number;
  stopPrice: number;
  maxStopDistancePct?: number;
  maxPortfolioRiskPct?: number;
}

export type PositionSizerResult =
  | {
      status: 'ok';
      totalShares: number;
      phase1Shares: number;
      phase2Shares: number;
      phase1Notional: number;
      phase2Notional: number;
      totalNotional: number;
      dollarRisk: number;
      portfolioRiskPct: number;
      stopDistancePct: number;
      riskPerShare: number;
      rulesApplied: {
        maxStopDistancePct: number;
        maxPortfolioRiskPct: number;
      };
    }
  | {
      status: 'rejected';
      reason: SizerRejectionReason;
      message: string;
      context: Readonly<PositionSizerInput>;
    };

export type SizerRejectionReason =
  | 'stop_above_entry'
  | 'stop_exceeds_max_distance'
  | 'invalid_inputs'
  | 'shares_would_be_zero';

export function calculatePosition(
  input: PositionSizerInput
): PositionSizerResult {
  const {
    accountSize,
    entryPrice,
    stopPrice,
    maxStopDistancePct = MAX_STOP_DISTANCE_PCT,
    maxPortfolioRiskPct = MAX_PORTFOLIO_RISK_PCT,
  } = input;

  if (
    !Number.isFinite(accountSize) || accountSize <= 0 ||
    !Number.isFinite(entryPrice)  || entryPrice  <= 0 ||
    !Number.isFinite(stopPrice)   || stopPrice   <= 0
  ) {
    return reject('invalid_inputs',
      'Account size, entry and stop must all be positive numbers.', input);
  }

  if (stopPrice >= entryPrice) {
    return reject('stop_above_entry',
      'Stop price must be below entry price (long-only system).', input);
  }

  const stopDistancePct = ((stopPrice - entryPrice) / entryPrice) * 100;
  if (Math.abs(stopDistancePct) > maxStopDistancePct) {
    return reject('stop_exceeds_max_distance',
      `Stop distance ${stopDistancePct.toFixed(2)}% exceeds the ${maxStopDistancePct}% hard cap. Tighten the stop or pass on the trade.`,
      input);
  }

  const riskBudget   = accountSize * (maxPortfolioRiskPct / 100);
  const riskPerShare = entryPrice - stopPrice;
  const rawShares    = riskBudget / riskPerShare;
  const totalShares  = Math.floor(rawShares);

  if (totalShares < 1) {
    return reject('shares_would_be_zero',
      'Risk budget too small for this setup — account or entry/stop distance produces < 1 share.',
      input);
  }

  const phase1Shares = Math.floor(totalShares * PHASE_1_FRACTION);
  const phase2Shares = totalShares - phase1Shares;

  const phase1Notional = round2(phase1Shares * entryPrice);
  const phase2Notional = round2(phase2Shares * entryPrice);
  const totalNotional  = round2(totalShares  * entryPrice);
  const dollarRisk     = round2(totalShares  * riskPerShare);
  const portfolioRiskPct = round4((dollarRisk / accountSize) * 100);

  return {
    status: 'ok',
    totalShares,
    phase1Shares,
    phase2Shares,
    phase1Notional,
    phase2Notional,
    totalNotional,
    dollarRisk,
    portfolioRiskPct,
    stopDistancePct: round4(stopDistancePct),
    riskPerShare: round4(riskPerShare),
    rulesApplied: { maxStopDistancePct, maxPortfolioRiskPct },
  };
}

function reject(
  reason: SizerRejectionReason,
  message: string,
  context: PositionSizerInput
): PositionSizerResult {
  return { status: 'rejected', reason, message, context: Object.freeze({ ...context }) };
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const round4 = (n: number) => Math.round(n * 10000) / 10000;
