// lib/admin/user-stats.ts
// Server-side helper — uses service-role client (bypasses RLS).

import { getServiceClient } from '@/lib/supabase-service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = ReturnType<typeof import('@supabase/supabase-js').createClient<any>>;

export interface UserStats {
  totalTrades:      number;
  openTrades:       number;
  closedTrades:     number;
  winRate:          number | null; // percentage 0–100
  totalPnl:         number;
  avgPositionSize:  number | null;
  signupDate:       string | null;
  lastSignIn:       string | null;
}

export async function getUserStats(userId: string): Promise<UserStats> {
  const db = getServiceClient() as unknown as AnyDb;

  const [tradesResult, authResult] = await Promise.all([
    db
      .from('trades')
      .select('status, outcome, pnl_dollars, phase1_price, phase1_shares')
      .eq('user_id', userId),
    (db as AnyDb).auth.admin.getUserById(userId),
  ]);

  const trades = (tradesResult.data ?? []) as {
    status:        string;
    outcome:       string | null;
    pnl_dollars:   number | null;
    phase1_price:  number;
    phase1_shares: number;
  }[];

  const closed = trades.filter(t => t.status !== 'open');
  const open   = trades.filter(t => t.status === 'open');
  const wins   = closed.filter(t => t.outcome === 'winner').length;

  const totalPnl       = closed.reduce((s, t) => s + (t.pnl_dollars ?? 0), 0);
  const winRate        = closed.length > 0 ? (wins / closed.length) * 100 : null;
  const totalPositions = trades.reduce((s, t) => s + t.phase1_price * t.phase1_shares, 0);
  const avgPositionSize = trades.length > 0 ? totalPositions / trades.length : null;

  const authUser = authResult.data?.user;

  return {
    totalTrades:     trades.length,
    openTrades:      open.length,
    closedTrades:    closed.length,
    winRate,
    totalPnl,
    avgPositionSize,
    signupDate:      authUser?.created_at ?? null,
    lastSignIn:      authUser?.last_sign_in_at ?? null,
  };
}
