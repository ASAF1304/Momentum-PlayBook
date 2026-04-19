// lib/mindset-engine.ts
//
// The "coach" layer.  Every checklist gate has a specific failure
// explanation that tells the user *why* this invalidates the setup.
// Quotes are drawn from Livermore, Minervini, O'Neil, and Asaf's
// own methodology document.

export type GateKey =
  | 'stage2'
  | 'above_emas'       // Price > 20/50/200 EMA
  | 'rs_above_80'
  | 'vcp_confirmed'
  | 'market_uptrend'
  | 'time_of_day'      // After 20:00 local
  | 'stop_under_10pct'
  | 'volume_spike';

export interface GateFailureExplanation {
  /** One-line why this kills the trade. */
  why: string;
  /** Mindset reinforcement — a quote or principle. */
  quote: string;
  /** Attribution for the quote. */
  source: string;
}

export const GATE_FAILURES: Record<GateKey, GateFailureExplanation> = {
  stage2: {
    why: 'Trading anything outside a confirmed Stage 2 uptrend is fighting gravity. The probabilities are against you before you even click buy.',
    quote: 'Never ever fight the tape.',
    source: 'Jesse Livermore',
  },

  above_emas: {
    why: 'Price below the moving averages means institutional support is gone. You are catching a falling knife — professionals are selling, not buying.',
    quote: 'Buy what is going up. What is going up is going up because the best money in the world is buying it.',
    source: "William O'Neil, How to Make Money in Stocks",
  },

  rs_above_80: {
    why: 'Relative Strength below 80 means this stock is underperforming 80% of the market. Leaders lead; laggards follow — and usually into the graveyard.',
    quote: 'If you buy the best 1–2% of stocks based on relative strength, you have skewed the probabilities heavily in your favor before you even start.',
    source: "William O'Neil",
  },

  vcp_confirmed: {
    why: 'No clear volatility contraction means the float is not tight. Without contraction, there is no coiled spring — and no spring, no breakout.',
    quote: 'The tighter the base, the tighter the stop, the bigger the move. Volatility contraction is the footprint of institutional accumulation.',
    source: 'Mark Minervini, Trade Like a Stock Market Wizard',
  },

  market_uptrend: {
    why: 'Three out of four stocks follow the market. Buying long in a correction or bear phase is statistically a losing hand — 75% of leaders fail when the general market is in distribution.',
    quote: 'M — Market Direction. Even if the other six CAN SLIM criteria are perfect, a bad market will take most of your picks down with it. The market is the trend; do not fight it.',
    source: "William O'Neil, CAN SLIM",
  },

  time_of_day: {
    why: 'Trading before the last hour means you are reacting to noise. Amateurs get trapped in fake moves at the open; institutions reveal their hand at the close.',
    quote: 'Amateurs at the open, pros at the close. The smartest money of the day is the last hour — watch where it goes.',
    source: "Asaf's Winning System",
  },

  stop_under_10pct: {
    why: 'Risk greater than 10% per trade violates the most basic rule of capital preservation. One bad call can undo three good ones. No setup is worth that.',
    quote: 'Jesse Livermore used 10% max. O\'Neil uses 8%. If the technical stop needs more than that, there is no trade. Wall Street does not end at this stock — there are 8,000 more.',
    source: "Asaf's Winning System",
  },

  volume_spike: {
    why: 'A breakout without volume is noise. Without at least 1.5× average volume, the move is not backed by institutional money — and these are the breakouts that fail and shake you out.',
    quote: 'The breakout must be confirmed by volume significantly higher than the average. No volume, no trade.',
    source: 'Mark Minervini',
  },
};

// ---- Green-light messages (all gates pass) -----------------------------

export const GREEN_LIGHT_MESSAGES = [
  {
    headline: 'Pristine Setup Confirmed',
    body: 'All gates green. This is the kind of setup that builds careers — protect the downside and let the winner run.',
  },
  {
    headline: 'A-Plus Setup',
    body: 'Trend, relative strength, base structure, and volume all align. Execute with confidence, manage with discipline.',
  },
  {
    headline: 'Sniper Shot',
    body: 'You waited. The setup came. Now act with conviction — and the moment you are 3% up, stop is at breakeven.',
  },
];

// ---- General mindset quotes (rotate on every render) -------------------

export const MINDSET_QUOTES = [
  {
    text: 'Amateurs force trades out of boredom. Professionals wait patiently for the perfect setup. Protect your capital first — profits follow discipline.',
    source: 'Asaf\'s Winning System',
  },
  {
    text: 'The goal is not to be right. The goal is to be profitable. Small losses, big wins, and the math takes care of itself.',
    source: 'Mark Minervini',
  },
  {
    text: 'It was never my thinking that made the big money for me. It was always my sitting.',
    source: 'Jesse Livermore, Reminiscences of a Stock Operator',
  },
  {
    text: 'Cut your losses short and let your winners run. The entire game comes down to this one sentence — and the discipline to live by it.',
    source: 'William O\'Neil',
  },
  {
    text: 'The market is an unforgiving mirror. It reflects your strongest traits and your weakest ones in the most hardcore way. Who conquers himself, wins.',
    source: 'Asaf\'s Winning System',
  },
  {
    text: 'You can be right only 50% of the time on your stock picks and still enjoy great success — if your reward/risk ratio is greater than one to one.',
    source: 'Mark Minervini',
  },
  {
    text: 'The stock market is a game of probabilities. One trade is random; 20 trades are not. Stick to the system, and the numbers will take care of themselves.',
    source: 'Asaf\'s Winning System',
  },
  {
    text: 'Hope is not a strategy. A stop-loss is.',
    source: 'Wall Street proverb',
  },
];

/** Pick one mindset quote deterministically by index — stable across renders. */
export function getMindsetQuote(seed: number = 0): typeof MINDSET_QUOTES[number] {
  const idx = Math.abs(seed) % MINDSET_QUOTES.length;
  return MINDSET_QUOTES[idx];
}

export function getGreenLightMessage(seed: number = 0): typeof GREEN_LIGHT_MESSAGES[number] {
  const idx = Math.abs(seed) % GREEN_LIGHT_MESSAGES.length;
  return GREEN_LIGHT_MESSAGES[idx];
}
