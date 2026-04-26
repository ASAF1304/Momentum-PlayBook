// app/page.tsx — Momentum Playbook Dashboard
// 3-column layout: [Checklist | Sizer | Positions + Playbook + Stage2Leaders]

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, Loader2, Plus, RefreshCw } from 'lucide-react';
import { AppNav }                                          from '@/components/nav/app-nav';
import { GridOverlay }                                     from '@/components/ui/grid-overlay';
import { ValidatorProvider, ChecklistCard, SizerCard }    from '@/components/validator/pre-trade-validator';
import { AddPositionModal }                                from '@/components/dashboard/add-position-modal';
import { Stage2Leaders }                                   from '@/components/dashboard/stage2-leaders';
import { supabase, type Trade }                            from '@/lib/supabase-client';
import { useAuth }                                         from '@/lib/auth-context';
import { useLivePrices, type LivePrice }                   from '@/lib/use-live-prices';
import { toast }                                           from '@/lib/toast';
import { cn }                                              from '@/lib/utils';
import type { PositionSizerResult }                        from '@/lib/position-sizer';
import type { TickerResponse }                             from '@/app/api/ticker/[symbol]/route';

export default function Dashboard() {
  const { user, profile, loading: authLoading } = useAuth();

  const [trades,           setTrades]           = useState<Trade[]>([]);
  const [tradesLoading,    setTradesLoading]     = useState(true);
  const [tradesError,      setTradesError]       = useState<string | null>(null);
  const [showAddModal,     setShowAddModal]      = useState(false);
  const [prefilledTicker,  setPrefilledTicker]   = useState<string | undefined>(undefined);
  const validatorRef = useRef<HTMLDivElement>(null);

  const fetchTrades = useCallback(async (attempt = 0) => {
    if (!user) return;
    if (attempt === 0) { setTradesLoading(true); setTradesError(null); }
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 15_000);
    let ok = false;
    try {
      console.time(`[DASHBOARD] fetchTrades (attempt ${attempt})`);
      const { data, error } = await supabase
        .from('trades').select('*').order('phase1_date', { ascending: false })
        .abortSignal(controller.signal);
      console.timeEnd(`[DASHBOARD] fetchTrades (attempt ${attempt})`);
      if (error) throw new Error(error.message);
      setTrades((data as Trade[]) ?? []);
      ok = true;
    } catch (err) {
      console.timeEnd(`[DASHBOARD] fetchTrades (attempt ${attempt})`);
      if (attempt === 0) { setTimeout(() => void fetchTrades(1), 2_000); return; }
      const isTimeout = (err as Error).name === 'AbortError';
      setTradesError(isTimeout ? 'Request timed out — check your connection.' : ((err as Error).message || 'Failed to load.'));
    } finally {
      clearTimeout(tid);
      if (ok || attempt > 0) setTradesLoading(false);
    }
  }, [user]);

  useEffect(() => { void fetchTrades(); }, [fetchTrades]);

  const openTrades = useMemo(() => trades.filter(t => t.status === 'open' && !t.is_what_if), [trades]);

  // Live prices for all open positions — polls every 60s, pauses when tab hidden
  const openTickers = useMemo(() => openTrades.map(t => t.ticker), [openTrades]);
  const { prices: livePrices, lastUpdated: pricesUpdatedAt, refreshing: pricesRefreshing, refresh: refreshPrices } = useLivePrices(openTickers);

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

  // When user clicks a ticker in Stage2Leaders — pre-fill validator and scroll to it
  const handleSelectTicker = useCallback((ticker: string) => {
    setPrefilledTicker(ticker);
    setTimeout(() => {
      validatorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
    toast({ title: `${ticker} loaded in validator`, body: 'Check the checklist below.', variant: 'success', durationMs: 2500 });
  }, []);

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
          <StatCard label="Account"       value={stats.accountSize > 0 ? fmtAccountSize(stats.accountSize) : '—'} />
          <StatCard label="Open"          value={tradesLoading ? '…' : String(stats.openCount)} />
          <StatCard label="Win Rate"      value={stats.winRate !== null ? `${stats.winRate.toFixed(1)}%` : '—'} />
          <StatCard label="Avg R"         value={stats.avgR !== null ? `${stats.avgR >= 0 ? '+' : ''}${stats.avgR.toFixed(2)}R` : '—'}
                                          positive={stats.avgR !== null && stats.avgR >= 0} />
          <StatCard label="YTD P&L"       value={stats.ytdPnL !== 0 ? `${stats.ytdPnL >= 0 ? '+' : ''}$${Math.abs(stats.ytdPnL).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}
                                          positive={stats.ytdPnL > 0} negative={stats.ytdPnL < 0} />
        </div>

        {/* ── 3-column grid ─────────────────────────────────────────────────── */}
        <ValidatorProvider
          accountSize={profile?.account_size ?? 10_000}
          maxStopDistancePct={profile?.max_stop_distance_pct ?? 10}
          maxPortfolioRiskPct={profile?.max_risk_per_trade_pct ?? 2.5}
          initialTicker={prefilledTicker}
          onSubmit={handleLogPhase1}
        >
          <div ref={validatorRef} className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-[420px_1fr_380px] gap-5 items-start">

            {/* Col 1 (lg: left top, xl: col 1) — Checklist */}
            <ChecklistCard className="lg:col-start-1 lg:row-start-1 xl:col-start-1" />

            {/* Col 3 (lg: right col spanning 2 rows, xl: col 3) — Positions + Playbook + Leaders */}
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
                  {!tradesLoading && tradesError && (
                    <div className="py-4 flex flex-col gap-2 items-start">
                      <p className="text-[11px] text-red-500">{tradesError}</p>
                      <button onClick={() => void fetchTrades()} className="text-[11px] font-semibold text-[#22D3EE] hover:underline">
                        Retry
                      </button>
                    </div>
                  )}
                  {!tradesLoading && !tradesError && openTrades.length === 0 && (
                    <PositionsEmptyState />
                  )}
                  {!tradesLoading && !tradesError && openTrades.slice(0, 6).map(trade => (
                    <PositionCard
                      key={trade.id}
                      trade={trade}
                      livePrice={livePrices[trade.ticker]}
                    />
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

                {/* Live price footer */}
                {openTrades.length > 0 && (
                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-[9px] text-[var(--text-faint)]">
                      Market data delayed by 15 minutes
                    </p>
                    <div className="flex items-center gap-2">
                      {pricesUpdatedAt && (
                        <span className="text-[9px] text-[var(--text-faint)] font-mono">
                          Updated {pricesUpdatedAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={refreshPrices}
                        disabled={pricesRefreshing}
                        className="flex items-center gap-1 text-[9px] text-[var(--text-faint)] hover:text-[#22D3EE] transition-colors"
                      >
                        <RefreshCw className={cn('w-2.5 h-2.5', pricesRefreshing && 'animate-spin')} />
                        {pricesRefreshing ? 'Refreshing…' : 'Refresh'}
                      </button>
                    </div>
                  </div>
                )}
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

              {/* Stage 2 Leaders */}
              <Stage2Leaders onSelectTicker={handleSelectTicker} />

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

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtAccountSize(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `$${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
  }
  if (n >= 1_000) {
    return `$${(n / 1_000).toFixed(0)}K`;
  }
  return `$${n.toLocaleString()}`;
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
        <span className={cn(
          'font-mono text-[22px] font-extrabold tracking-tight tabular-nums',
          positive === true ? 'text-emerald-400'
            : negative === true ? 'text-red-400'
            : positive === false ? 'text-zinc-400'
            : 'text-[var(--text-primary)]',
        )}>
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

function PositionCard({ trade, livePrice }: { trade: Trade; livePrice?: LivePrice }) {
  const daysIn = Math.floor((Date.now() - new Date(trade.phase1_date).getTime()) / 86_400_000);
  const currentShares = trade.current_shares || trade.phase1_shares;

  // Live P&L
  const currentPrice = livePrice?.price ?? null;
  const unrealizedPnL = currentPrice != null
    ? (currentPrice - trade.phase1_price) * currentShares
    : null;

  // Stop proximity alert
  const stop = trade.current_stop ?? trade.initial_stop;
  const distanceToStop = currentPrice != null
    ? ((currentPrice - stop) / currentPrice) * 100
    : null;

  const isApproachingStop = distanceToStop !== null && distanceToStop <= 1;
  const isNearStop        = distanceToStop !== null && distanceToStop <= 3 && !isApproachingStop;
  const isWinning         = unrealizedPnL !== null && unrealizedPnL > 0 && !isNearStop && !isApproachingStop;
  const isLosing          = unrealizedPnL !== null && unrealizedPnL < 0 && !isNearStop && !isApproachingStop;

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

        {/* Status badge */}
        {isApproachingStop ? (
          <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-red-400 flex-shrink-0">
            <AlertTriangle className="w-3 h-3" /> Approaching Stop
          </span>
        ) : isNearStop ? (
          <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-amber-400 flex-shrink-0">
            <AlertTriangle className="w-3 h-3" /> Near Stop
          </span>
        ) : isWinning ? (
          <span className="text-[9px] font-bold uppercase tracking-wider text-[#10F088] flex-shrink-0">
            Winning +${unrealizedPnL!.toFixed(0)}
          </span>
        ) : isLosing ? (
          <span className="text-[9px] font-bold uppercase tracking-wider text-red-400 flex-shrink-0">
            Losing −${Math.abs(unrealizedPnL!).toFixed(0)}
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-amber-500 flex-shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            Live
          </span>
        )}
      </div>

      {/* Live price row */}
      {currentPrice != null && (
        <div className="flex items-baseline gap-2 mb-2">
          <span className="font-mono text-[15px] font-extrabold text-[var(--text-primary)]">
            ${currentPrice.toFixed(2)}
          </span>
          {livePrice && (
            <span className={cn(
              'font-mono text-[11px] font-semibold',
              livePrice.changePct >= 0 ? 'text-[#10F088]' : 'text-[#FF3B5C]',
            )}>
              {livePrice.changePct >= 0 ? '+' : ''}{livePrice.changePct.toFixed(2)}%
            </span>
          )}
        </div>
      )}

      {/* Mini stat strip */}
      <div className="grid grid-cols-4 gap-x-2 text-[10px] font-mono mb-2">
        {[
          { k: 'Entry',  v: `$${trade.phase1_price.toFixed(2)}` },
          { k: 'Stop',   v: `$${stop.toFixed(2)}`               },
          { k: 'Shares', v: String(currentShares)                },
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
        {unrealizedPnL !== null && (
          <>
            <span className="text-[var(--border-hover)]">·</span>
            <span className={cn('tabular-nums', unrealizedPnL >= 0 ? 'text-emerald-400' : 'text-red-400')}>
              P&amp;L {unrealizedPnL >= 0 ? '+' : ''}${unrealizedPnL.toFixed(0)}
            </span>
          </>
        )}
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
