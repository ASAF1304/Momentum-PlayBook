// app/page.tsx — Momentum Playbook Dashboard
// 3-column layout: [Checklist | Sizer | Positions + Playbook]

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Loader2, Plus } from 'lucide-react';
import { AppNav }                                          from '@/components/nav/app-nav';
import { GridOverlay }                                     from '@/components/ui/grid-overlay';
import { ValidatorProvider, ChecklistCard, SizerCard }    from '@/components/validator/pre-trade-validator';
import { AddPositionModal }                                from '@/components/dashboard/add-position-modal';
import { supabase, type Trade }                            from '@/lib/supabase-client';
import { useAuth }                                         from '@/lib/auth-context';
import { toast }                                           from '@/lib/toast';
import { cn }                                              from '@/lib/utils';
import type { PositionSizerResult }                        from '@/lib/position-sizer';
import type { TickerResponse }                             from '@/app/api/ticker/[symbol]/route';

export default function Dashboard() {
  const { user, profile, loading: authLoading } = useAuth();

  const [trades,        setTrades]        = useState<Trade[]>([]);
  const [tradesLoading, setTradesLoading] = useState(true);
  const [showAddModal,  setShowAddModal]  = useState(false);

  const fetchTrades = useCallback(async () => {
    if (!user) return;
    setTradesLoading(true);
    const { data, error } = await supabase
      .from('trades').select('*').order('phase1_date', { ascending: false });
    if (!error) setTrades((data as Trade[]) ?? []);
    setTradesLoading(false);
  }, [user]);

  useEffect(() => { void fetchTrades(); }, [fetchTrades]);

  const openTrades = useMemo(() => trades.filter(t => t.status === 'open' && !t.is_what_if), [trades]);

  const stats = useMemo(() => {
    const system    = trades.filter(t => !t.is_what_if);
    const completed = system.filter(t => t.status !== 'open');
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
    winners:    trades.filter(t => !t.is_what_if && t.outcome === 'winner').length,
    losers:     trades.filter(t => !t.is_what_if && t.outcome === 'loser').length,
    breakevens: trades.filter(t => !t.is_what_if && t.outcome === 'breakeven').length,
    whatIf:     trades.filter(t => t.is_what_if).length,
    all:        trades.filter(t => !t.is_what_if).length,
  }), [trades]);

  const handleLogPhase1 = async (payload: {
    ticker: string; entry: number; stop: number;
    sizing: Extract<PositionSizerResult, { status: 'ok' }>;
    tickerData: TickerResponse; amountInvested: number;
    isWhatIf: boolean; failedGates: string[];
  }) => {
    if (!user) return;
    const { error } = await supabase.from('trades').insert({
      user_id:              user.id,
      ticker:               payload.ticker,
      phase1_date:          new Date().toISOString(),
      phase1_price:         payload.entry,
      phase1_shares:        payload.sizing.phase1Shares,
      initial_stop:         payload.stop,
      current_stop:         payload.stop,
      stop_distance_pct:    payload.sizing.stopDistancePct,
      risk_dollars:         payload.sizing.dollarRisk,
      trend_template_passed: payload.tickerData.trendTemplate.passed,
      status:               'open',
      is_what_if:           payload.isWhatIf,
      failed_gates:         payload.isWhatIf ? payload.failedGates : null,
      what_if_reason:       null,
    });
    if (error) { toast({ title: 'Failed to log trade', body: error.message, variant: 'error' }); return; }
    if (payload.isWhatIf) {
      toast({ title: `${payload.ticker} logged as non-system trade`, body: 'Checklist incomplete — tracked for reference only.', variant: 'warning', durationMs: 5000 });
    } else {
      toast({ title: `${payload.ticker} · Phase 1 open`, body: `${payload.sizing.phase1Shares} sh @ $${payload.entry.toFixed(2)} · stop $${payload.stop.toFixed(2)}`, variant: 'success', durationMs: 4500 });
    }
    void fetchTrades();
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-[#22D3EE]" />
      </div>
    );
  }
  if (user && !profile && !authLoading) {
    if (typeof window !== 'undefined') window.location.replace('/onboarding');
    return null;
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <GridOverlay />
      <AppNav />

      <main className="max-w-[1440px] mx-auto px-6 py-7 relative">

        {/* ── Stats strip ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-7">
          <StatCard label="Account"       value={stats.accountSize > 0 ? `$${stats.accountSize.toLocaleString()}` : '—'} />
          <StatCard label="Open"          value={tradesLoading ? '…' : String(stats.openCount)} />
          <StatCard label="Win Rate"      value={stats.winRate !== null ? `${stats.winRate.toFixed(1)}%` : '—'} />
          <StatCard label="Avg R"         value={stats.avgR !== null ? `${stats.avgR >= 0 ? '+' : ''}${stats.avgR.toFixed(2)}R` : '—'}
                                          positive={stats.avgR !== null && stats.avgR >= 0} />
          <StatCard label="YTD P&L"       value={stats.ytdPnL !== 0 ? `${stats.ytdPnL >= 0 ? '+' : ''}$${Math.abs(stats.ytdPnL).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}
                                          positive={stats.ytdPnL > 0} negative={stats.ytdPnL < 0} />
        </div>

        {/* ── 3-column grid ─────────────────────────────────────────────────── */}
        {/* lg: [checklist | sizer] stacked left + positions right
            xl: true 3-column — each card in its own column             */}
        <ValidatorProvider
          accountSize={profile?.account_size ?? 10_000}
          maxStopDistancePct={profile?.max_stop_distance_pct ?? 10}
          maxPortfolioRiskPct={profile?.max_risk_per_trade_pct ?? 2.5}
          onSubmit={handleLogPhase1}
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-[420px_1fr_380px] gap-5 items-start">

            {/* Col 1 (lg: left top, xl: col 1) — Checklist */}
            <ChecklistCard className="lg:col-start-1 lg:row-start-1 xl:col-start-1" />

            {/* Col 3 (lg: right col spanning 2 rows, xl: col 3) — Positions + Playbook */}
            <div className="flex flex-col gap-5 lg:col-start-2 lg:row-start-1 lg:row-span-2 xl:col-start-3 xl:row-start-1 xl:row-span-1">

              {/* Active Positions */}
              <div
                className="rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5"
                style={{ boxShadow: 'var(--shadow-card), var(--inner-highlight)' }}
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-[15px] font-bold tracking-tight text-[var(--text-primary)]">Active Positions</h2>
                    <p className="text-[12px] text-[var(--text-muted)] mt-0.5">Phase 1 entries</p>
                  </div>
                  <Link href="/journal" className="flex items-center gap-1 text-[11px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors uppercase tracking-wider">
                    Journal <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>

                <div className="flex flex-col gap-2">
                  {tradesLoading && (
                    <div className="flex items-center gap-2 py-5 text-[var(--text-faint)] text-[12px]">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
                    </div>
                  )}
                  {!tradesLoading && openTrades.length === 0 && (
                    <PositionsEmptyState />
                  )}
                  {!tradesLoading && openTrades.slice(0, 6).map(trade => (
                    <PositionCard key={trade.id} trade={trade} />
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setShowAddModal(true)}
                  className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2.5 border border-dashed border-[var(--border-subtle)] rounded-[9px] text-[11px] font-semibold uppercase tracking-wider text-[var(--text-faint)] hover:border-[var(--border-hover)] hover:text-[var(--text-muted)] transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add position manually
                </button>
              </div>

              {/* Playbook summary */}
              <div
                className="rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5"
                style={{ boxShadow: 'var(--shadow-card), var(--inner-highlight)' }}
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-[15px] font-bold tracking-tight text-[var(--text-primary)]">Playbook</h2>
                    <p className="text-[12px] text-[var(--text-muted)] mt-0.5">Realized outcomes</p>
                  </div>
                  <Link href="/playbook" className="flex items-center gap-1 text-[11px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors uppercase tracking-wider">
                    View all <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
                <PlaybookStrip counts={playbookCounts} />
              </div>
            </div>

            {/* Col 2 (lg: left bottom, xl: col 2) — Sizer */}
            <SizerCard className="lg:col-start-1 lg:row-start-2 xl:col-start-2 xl:row-start-1" />

          </div>
        </ValidatorProvider>

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

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({ label, value, positive, negative }: {
  label: string; value: string; positive?: boolean; negative?: boolean;
}) {
  return (
    <div
      className="p-4 rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-surface)]"
      style={{ boxShadow: 'var(--shadow-card), var(--inner-highlight)' }}
    >
      <div className="text-[10px] uppercase tracking-[0.18em] font-semibold text-[var(--text-muted)] opacity-60 mb-2">
        {label}
      </div>
      <div className="flex items-center gap-2">
        <span className="font-mono text-[22px] font-extrabold tracking-tight tabular-nums text-[var(--text-primary)]">
          {value}
        </span>
        {positive !== undefined && value !== '—' && (
          <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0',
            positive ? 'bg-[#10F088]' : negative ? 'bg-red-500' : 'bg-[var(--text-faint)]',
          )} />
        )}
      </div>
    </div>
  );
}

function PositionCard({ trade }: { trade: Trade }) {
  const daysIn = Math.floor((Date.now() - new Date(trade.phase1_date).getTime()) / 86_400_000);
  return (
    <Link
      href="/journal"
      className="group block rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--border-hover)] transition-colors p-3.5"
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between mb-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-[18px] font-extrabold tracking-tight text-[var(--text-primary)]">
            {trade.ticker}
          </span>
          {trade.setup_type && (
            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-muted)]">
              {trade.setup_type}
            </span>
          )}
        </div>
        {/* Live status dot */}
        <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-amber-500 flex-shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          Live
        </span>
      </div>

      {/* Mini stat strip */}
      <div className="grid grid-cols-4 gap-x-2 text-[10px] font-mono mb-2">
        {[
          { k: 'Entry',  v: `$${trade.phase1_price.toFixed(2)}` },
          { k: 'Stop',   v: `$${trade.initial_stop.toFixed(2)}`  },
          { k: 'Shares', v: String(trade.phase1_shares)          },
          { k: 'Days',   v: String(daysIn)                       },
        ].map(({ k, v }) => (
          <div key={k}>
            <div className="text-[var(--text-faint)] uppercase tracking-wider text-[8px] mb-0.5">{k}</div>
            <div className="font-semibold text-[var(--text-dim)]">{v}</div>
          </div>
        ))}
      </div>

      {/* Risk line */}
      <div className="text-[10px] text-[var(--text-faint)] font-mono flex items-center gap-2">
        <span>Risk ${trade.risk_dollars.toFixed(0)}</span>
        <span className="text-[var(--border-hover)]">·</span>
        <span className="text-red-500/70">−{trade.stop_distance_pct.toFixed(2)}% stop</span>
      </div>
    </Link>
  );
}

function PositionsEmptyState() {
  return (
    <div className="py-8 flex flex-col items-center text-center">
      <div className="w-10 h-10 rounded-full border-2 border-dashed border-[var(--border-hover)] flex items-center justify-center mb-3">
        <span className="font-mono text-[16px] font-bold text-[var(--text-faint)]">0</span>
      </div>
      <p className="text-[13px] font-semibold text-[var(--text-secondary)] mb-1">No open positions</p>
      <p className="text-[11px] text-[var(--text-muted)]">
        Log a trade using the validator or add manually.
      </p>
    </div>
  );
}

function PlaybookStrip({ counts }: {
  counts: { winners: number; losers: number; breakevens: number; whatIf: number; all: number };
}) {
  const items = [
    { label: 'W',   count: counts.winners,    href: '/playbook?filter=winners',    cls: 'text-[#10F088]' },
    { label: 'L',   count: counts.losers,     href: '/playbook?filter=losers',     cls: 'text-red-500'   },
    { label: 'BE',  count: counts.breakevens, href: '/playbook?filter=breakevens', cls: 'text-amber-400' },
    { label: 'WI',  count: counts.whatIf,     href: '/playbook?filter=what-if',    cls: 'text-amber-600' },
    { label: 'All', count: counts.all,        href: '/playbook',                   cls: 'text-[var(--text-secondary)]' },
  ];
  const labels: Record<string, string> = { W: 'Winners', L: 'Losers', BE: 'Breakeven', WI: 'What-If', All: 'All' };

  return (
    <div className="grid grid-cols-5 gap-1.5">
      {items.map(item => (
        <Link
          key={item.label}
          href={item.href}
          className="flex flex-col items-center p-3 rounded-[9px] border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/50 hover:border-[var(--border-hover)] hover:bg-[var(--bg-elevated)] transition-all"
        >
          <span className={cn('font-mono text-[20px] font-extrabold tabular-nums leading-none mb-1', item.cls)}>
            {item.count}
          </span>
          <span className="text-[8px] uppercase tracking-[0.14em] font-semibold text-[var(--text-faint)]">
            {labels[item.label]}
          </span>
        </Link>
      ))}
    </div>
  );
}
