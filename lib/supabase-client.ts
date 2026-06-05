// lib/supabase-client.ts
//
// Browser-side Supabase singleton + all shared types.
// Uses createBrowserClient from @supabase/ssr for proper cookie handling.

import { createBrowserClient } from '@supabase/ssr';

// ── Auth / profile ─────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  display_name: string | null;
  account_size: number;
  max_risk_per_trade_pct: number;
  max_stop_distance_pct: number;
  created_at: string;
  accepted_terms_at: string | null;
  dismissed_onboarding_at: string | null;
  is_admin: boolean;
}

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'paused'
  | 'cancelled'
  | 'grace'          // beta users: 30 days free, no card required
  | 'comp'           // permanent free access granted by admin
  | 'expired_grace'; // grace period ended, no active sub

export interface Subscription {
  id: string;
  user_id: string;
  grow_subscription_id?: string | null;
  status: SubscriptionStatus;
  trial_ends_at: string | null;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
}

// ── Trades ─────────────────────────────────────────────────────────────────────

export type TradeStatus  = 'open' | 'closed' | 'stopped_out';
export type TradeOutcome = 'winner' | 'loser' | 'breakeven';
export type SetupType    = 'VCP' | 'HTF' | 'Cup & Handle' | 'Gap-up' | 'Flat Base' | 'Confluence' | 'Other';

export interface PartialExit {
  id:          string;              // crypto.randomUUID()
  date:        string;              // ISO timestamp
  shares:      number;
  price:       number;
  action?:     'buy' | 'sell';     // undefined = 'sell' (backward compat for old rows)
  pnl_dollars: number;             // 0 for buys; realized PnL for sells
  pnl_pct:     number;             // % vs avg entry; 0 for buys
  r_multiple:  number;             // 0 for buys
}

export interface Trade {
  id: string;
  created_at: string;

  ticker: string;
  setup_type: SetupType | null;

  phase1_date: string;
  phase1_price: number;
  phase1_shares: number;

  phase2_date: string | null;
  phase2_price: number | null;
  phase2_shares: number | null;

  initial_stop: number;
  current_stop: number | null;
  risk_dollars: number;
  stop_distance_pct: number;

  rs_rating: number | null;
  trend_template_passed: boolean;

  exit_date: string | null;
  exit_price: number | null;
  status: TradeStatus;
  outcome: TradeOutcome | null;

  pnl_dollars: number | null;
  pnl_pct: number | null;
  r_multiple: number | null;

  notes: string | null;
  lesson_learned: string | null;
  screenshot_url: string | null;

  // Partial-exit columns — added via migration
  partials: PartialExit[];
  current_shares: number;

  // What-If / non-system trade flag
  is_what_if: boolean;

  // Retrospective — gates that failed at entry time
  failed_gates: string[] | null;
  what_if_reason: string | null;

  // Non-System review (Step 3)
  system_status: 'system' | 'partial' | 'non_system' | null;
  trend_checks: boolean[] | null; // 8 Minervini conditions, index 0-7
}

// ── Stage 2 Leaders ────────────────────────────────────────────────────────────

export interface Stage2Leader {
  id: number;
  ticker: string;
  company: string | null;
  price: number | null;
  change_pct: number | null;
  volume: number | null;
  market_cap: string | null;
  rs_rating: number | null;
  scanned_at: string;
  rank: number | null;
}

// ── Asaf's Thoughts ────────────────────────────────────────────────────────────

export interface AsafThought {
  id:         string;
  ticker:     string;
  notes:      string | null;
  image_url:  string | null;
  created_at: string;
  updated_at: string;
}

// ── Watchlist ──────────────────────────────────────────────────────────────────

export interface WatchlistItem {
  id: string;
  user_id: string;
  ticker: string;
  notes: string | null;
  added_at: string;
}

// ── Client singleton ───────────────────────────────────────────────────────────

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);
