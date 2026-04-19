// app/page.tsx
//
// The Momentum Playbook — Main Dashboard
// Real data from Supabase. No mock constants.

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity, ArrowRight, Award, LineChart, Loader2,
  Plus, Target, TrendingUp,
} from 'lucide-react';
import { AppNav } from '@/components/nav/app-nav';
import { GridOverlay } from '@/components/ui/grid-overlay';
import { PreTradeValidator } from '@/components/validator/pre-trade-validator';
import { AddPositionModal } from '@/components/dashboard/add-position-modal';
import { supabase, type Trade } from '@/lib/supabase-client';
import { useAuth } from '@/lib/auth-context';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import type { PositionSizerResult } from '@/lib/position-sizer';
import type { TickerResponse } from '@/app/api/ticker/[symbol]/route';

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user, profile, loading: authLoading } = useAuth();

  const [trades,        setTrades]        = useState<Trade[]>([]);
  const [tradesLoading, setTradesLoading] = useState(true);
  const [showAddModal,  setShowAddModal]  = useState(false);

  // ── Fetch all trades for this user ────────────────────────────────────────

  const fetchTrades = useCallback(async () => {
    if (!user) return;
    setTradesLoading(true);
    const { data, error } = await supabase
      .from('trades')
      .select('*')
      .order('phase1_date', { ascending: false });
    if (!error) setTrades((data as Trade[]) ?? []);
    setTradesLoading(false);
  }, [user]);

  useEffect(() => { void fetchTrades(); }, [fetchTrades]);

  // ── Derived stats ─────────────────────────────────────────────────────────

  const openTrades = useMemo(() => trades.filter(t => t.status === 'open'), [trades]);

  const stats = useMemo(() => {
    const completed = trades.filter(t => t.status !== 'open');
    const winners   = completed.filter(t => t.outcome === 'winner');
    const withR     = completed.filter(t => t.r_multiple !== null);
    const ytdStart  = `${new Date().getFullYear()}-01-01T00:00:00.000Z`;
    const ytdPnL    = completed
      .filter(t => t.exit_date && t.exit_date >= ytdStart)
      .reduce((s, t) => s + (t.pnl_dollars ?? 0), 0);

    return {
      accountSize: profile?.account_size ?? 0,
      openCount:   openTrades.length,
      winRate:     completed.length > 0 ? (winners.length / completed.length) * 100 : null,
      avgR:        withR.length > 0 ? withR.reduce((s, t) => s + (t.r_multiple ?? 0), 0) / withR.length : null,
      ytdPnL,
    };
  }, [trades, openTrades, profile]);

  const playbookCounts = useMemo(() => ({
    winners:    trades.filter(t => t.outcome === 'winner').length,
    losers:     trades.filter(t => t.outcome === 'loser').length,
    breakevens: trades.filter(t => t.outcome === 'breakeven').length,
    whatIf:     trades.filter(t => t.is_what_if).length,
    all:        trades.length,
  }), [trades]);

  // ── Submit handler (validator → Supabase) ─────────────────────────────────

  const handleLogPhase1 = async (payload: {
    ticker: string;
    entry: number;
    stop: number;
    sizing: Extract<PositionSizerResult, { status: 'ok' }>;
    tickerData: TickerResponse;
    amountInvested: number;
    isWhatIf: boolean;
  }) => {
    if (!user) return;

    const { error } = await supabase.from('trades').insert({
      user_id: user.id,
      ticker: payload.ticker,
      phase1_date: new Date().toISOString(),
      phase1_price: payload.entry,
      phase1_shares: payload.sizing.phase1Shares,
      initial_stop: payload.stop,
      current_stop: payload.stop,
      stop_distance_pct: payload.sizing.stopDistancePct,
      risk_dollars: payload.sizing.dollarRisk,
      trend_template_passed: payload.tickerData.trendTemplate.passed,
      status: 'open',
      is_what_if: payload.isWhatIf,
    });

    if (error) {
      toast({ title: 'Failed to log trade', body: error.message, variant: 'error' });
      return;
    }

    if (payload.isWhatIf) {
      toast({
        title: `${payload.ticker} logged as non-system trade`,
        body: `Checklist incomplete — logged for tracking only. Not counted in system stats.`,
        variant: 'warning',
        durationMs: 5000,
      });
    } else {
      toast({
        title: `${payload.ticker} logged — Phase 1 open`,
        body: `${payload.sizing.phase1Shares} sh @ $${payload.entry.toFixed(2)} · stop $${payload.stop.toFixed(2)}`,
        variant: 'success',
        durationMs: 4500,
      });
    }

    void fetchTrades();
  };

  // ── Loading screen ────────────────────────────────────────────────────────

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#22D3EE]" />
      </div>
    );
  }

  // If authenticated but no profile → send to onboarding
  if (user && !profile && !authLoading) {
    if (typeof window !== 'undefined') window.location.replace('/onboarding');
    return null;
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] font-[Manrope,ui-sans-serif,system-ui,sans-serif]">
      <GridOverlay />
      <AppNav />

      <main className="max-w-[1400px] mx-auto px-6 py-8 relative">

        {/* Stats strip */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <StatCard
            label="Account"
            value={stats.accountSize > 0 ? `$${stats.accountSize.toLocaleString()}` : '—'}
            icon={Activity}
            accent="cyan"
          />
          <StatCard
            label="Open Positions"
            value={tradesLoading ? '…' : String(stats.openCount)}
            icon={Target}
            accent="amber"
          />
          <StatCard
            label="Win Rate"
            value={stats.winRate !== null ? `${stats.winRate.toFixed(1)}%` : '—'}
            icon={Award}
            accent="green"
          />
          <StatCard
            label="Avg R"
            value={stats.avgR !== null ? `${stats.avgR.toFixed(2)}R` : '—'}
            icon={TrendingUp}
            accent={stats.avgR !== null && stats.avgR >= 0 ? 'green' : 'red'}
          />
          <StatCard
            label="YTD PnL"
            value={stats.ytdPnL !== 0
              ? `${stats.ytdPnL >= 0 ? '+' : ''}$${Math.abs(stats.ytdPnL).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
              : '—'}
            icon={LineChart}
            accent={stats.ytdPnL >= 0 ? 'green' : 'red'}
          />
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[480px_1fr] gap-5">

          {/* LEFT: Validator */}
          <section>
            <SectionHeader
              title="Pre-Trade Validator"
              subtitle="5 gates. No trade without green lights."
            />
            <PreTradeValidator
              accountSize={profile?.account_size ?? 10000}
              maxStopDistancePct={profile?.max_stop_distance_pct ?? 10}
              maxPortfolioRiskPct={profile?.max_risk_per_trade_pct ?? 2.5}
              onSubmit={handleLogPhase1}
            />
          </section>

          {/* RIGHT: Active positions + Playbook */}
          <section className="flex flex-col gap-5">
            <div>
              <div className="flex items-center justify-between mb-3">
                <SectionHeader
                  title="Active Positions"
                  subtitle="Phase 1 entries awaiting resolution"
                  compact
                />
                <Link
                  href="/journal"
                  className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#22D3EE] hover:text-[#10F088] transition-colors"
                >
                  Open Journal
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              <div className="flex flex-col gap-2.5">
                {tradesLoading && (
                  <div className="flex items-center gap-2 py-6 text-[var(--text-faint)] text-[12px]">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading positions…
                  </div>
                )}
                {!tradesLoading && openTrades.length === 0 && (
                  <div className="py-8 text-center text-[12px] text-[var(--text-faint)]">
                    No open positions. Log a trade using the validator.
                  </div>
                )}
                {!tradesLoading && openTrades.slice(0, 6).map(trade => (
                  <PositionCard key={trade.id} trade={trade} />
                ))}
                <button
                  type="button"
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center justify-center gap-2 px-3 py-3 border border-dashed border-[var(--border-subtle)] rounded-[10px] text-[12px] text-[var(--text-muted)] hover:border-[#22D3EE]/40 hover:text-[#22D3EE] hover:bg-[#22D3EE]/[0.03] transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span className="font-semibold uppercase tracking-wider">Add position manually</span>
                </button>
              </div>
            </div>

            <div>
              <SectionHeader
                title="Playbook"
                subtitle="Your visual archive of winners and losers"
                compact
              />
              <PlaybookStrip counts={playbookCounts} />
            </div>
          </section>
        </div>
      </main>

      {showAddModal && user && profile && (
        <AddPositionModal
          userId={user.id}
          maxStopDistancePct={profile.max_stop_distance_pct}
          onClose={() => setShowAddModal(false)}
          onSaved={() => { setShowAddModal(false); void fetchTrades(); }}
        />
      )}
    </div>
  );
}

// ── Subcomponents ─────────────────────────────────────────────────────────────

function PositionCard({ trade }: { trade: Trade }) {
  const daysSince = Math.floor(
    (Date.now() - new Date(trade.phase1_date).getTime()) / 86_400_000,
  );

  return (
    <Link
      href="/journal"
      className="group w-full text-left p-3.5 rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--border-hover)] hover:bg-[var(--bg-elevated)] transition-all block"
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-mono text-[16px] font-extrabold tracking-tight">{trade.ticker}</span>
            <span className="text-[9px] font-bold uppercase tracking-[0.14em] px-1.5 py-0.5 rounded bg-[#22D3EE]/15 text-[#22D3EE]">
              Phase 1
            </span>
            {trade.setup_type && (
              <span className="text-[9px] font-bold uppercase tracking-[0.14em] px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-secondary)]">
                {trade.setup_type}
              </span>
            )}
          </div>
          <div className="text-[10px] font-mono text-[var(--text-muted)]">
            {trade.phase1_shares} sh @ ${trade.phase1_price.toFixed(2)}
            &nbsp;·&nbsp;
            stop ${trade.initial_stop.toFixed(2)}
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-[13px] font-bold text-[#FF3B5C]">
            −{trade.stop_distance_pct.toFixed(2)}%
          </div>
          <div className="font-mono text-[10px] text-[var(--text-faint)]">
            stop dist
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-[10px] text-[var(--text-faint)]">
        <span className="font-mono">risk ${trade.risk_dollars.toFixed(0)}</span>
        <span>{daysSince}d in trade</span>
      </div>
    </Link>
  );
}

function StatCard({
  label, value, icon: Icon, accent,
}: {
  label: string; value: string;
  icon: typeof Activity;
  accent: 'cyan' | 'green' | 'red' | 'amber';
}) {
  const accents = {
    cyan:  { dot: 'bg-[#22D3EE]', icon: 'text-[#22D3EE]' },
    green: { dot: 'bg-[#10F088]', icon: 'text-[#10F088]' },
    red:   { dot: 'bg-[#EF4444]', icon: 'text-[#EF4444]'  },
    amber: { dot: 'bg-amber-400', icon: 'text-amber-400'  },
  };
  const a = accents[accent];
  return (
    <div
      className="relative p-5 rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden"
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn('w-3 h-3', a.icon)} />
        <span className="text-[9px] uppercase tracking-[0.18em] font-bold text-[var(--text-muted)] opacity-70">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-mono text-[22px] font-extrabold tracking-tight text-[var(--text-primary)]">
          {value}
        </span>
        {value !== '—' && (
          <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', a.dot)} />
        )}
      </div>
    </div>
  );
}

function SectionHeader({
  title, subtitle, compact = false,
}: { title: string; subtitle: string; compact?: boolean }) {
  return (
    <div className={compact ? 'mb-2.5' : 'mb-3'}>
      <h2 className={cn('font-extrabold tracking-tight', compact ? 'text-[13px]' : 'text-[15px]')}>
        {title}
      </h2>
      <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{subtitle}</p>
    </div>
  );
}

function PlaybookStrip({ counts }: {
  counts: { winners: number; losers: number; breakevens: number; whatIf: number; all: number };
}) {
  const items = [
    { label: 'Winners',    count: counts.winners,    href: '/playbook?filter=winners',    dot: 'bg-[#10F088]' },
    { label: 'Losers',     count: counts.losers,     href: '/playbook?filter=losers',     dot: 'bg-[#EF4444]' },
    { label: 'Breakevens', count: counts.breakevens, href: '/playbook?filter=breakevens', dot: 'bg-[#22D3EE]' },
    { label: 'What-If',    count: counts.whatIf,     href: '/playbook?filter=what-if',    dot: 'bg-amber-500' },
    { label: 'All',        count: counts.all,        href: '/playbook',                   dot: 'bg-[var(--text-faint)]' },
  ];
  return (
    <div className="grid grid-cols-5 gap-2">
      {items.map(item => (
        <Link
          key={item.label}
          href={item.href}
          className="p-3.5 rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] hover:border-[var(--border-hover)] transition-all group"
          style={{ boxShadow: 'var(--shadow-card)' }}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', item.dot)} />
            <span className="text-[9px] uppercase tracking-[0.14em] font-bold text-[var(--text-faint)] group-hover:text-[var(--text-muted)] transition-colors">
              {item.label}
            </span>
          </div>
          <div className="font-mono text-[22px] font-extrabold tracking-tight text-[var(--text-primary)]">
            {item.count}
          </div>
        </Link>
      ))}
    </div>
  );
}
