// app/page.tsx — Momentum Playbook Dashboard
// 3-column layout: [Checklist | Sizer | Positions + Playbook + Stage2Leaders]

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, Loader2, Plus, RefreshCw, WifiOff } from 'lucide-react';
import { AppNav }                                          from '@/components/nav/app-nav';
import { GridOverlay }                                     from '@/components/ui/grid-overlay';
import { OnboardingModal }                                 from '@/components/onboarding-modal';
import { ValidatorProvider, ChecklistCard, SizerCard }    from '@/components/validator/pre-trade-validator';
import { AddPositionModal }                                from '@/components/dashboard/add-position-modal';
import { Stage2Leaders }                                   from '@/components/dashboard/stage2-leaders';
import { supabase, type Trade }                            from '@/lib/supabase-client';
import { useAuth }                                         from '@/lib/auth-context';
import { useLivePrices, type LivePrice }                   from '@/lib/use-live-prices';
import { computeWinRate }                                  from '@/lib/stats/win-rate';
import {
  type Period,
  filterClosedByPeriod,
  computeMaxDrawdown,
  computeAvgWinLoss,
  computeUnrealizedPnL,
  computeCurrentR,
} from '@/lib/stats/dashboard-stats';
import { toast }                                           from '@/lib/toast';
import { cn }                                              from '@/lib/utils';
import type { PositionSizerResult }                        from '@/lib/position-sizer';
import type { TickerResponse }                             from '@/app/api/ticker/[symbol]/route';

const PERIODS: { key: Period; label: string }[] = [
  { key: 'all', label: 'All Time'    },
  { key: 'ytd', label: 'YTD'         },
  { key: 'mtd', label: 'MTD'         },
  { key: '30d', label: 'Last 30 Days' },
];

export default function Dashboard() {
  const { user, profile, loading: authLoading } = useAuth();

  const [trades,          setTrades]          = useState<Trade[]>([]);
  const [tradesLoading,   setTradesLoading]   = useState(true);
  const [tradesError,     setTradesError]     = useState<string | null>(null);
  const [showAddModal,    setShowAddModal]    = useState(false);
  const [prefilledTicker, setPrefilledTicker] = useState<string | undefined>(undefined);
  const [onboardingDone,  setOnboardingDone]  = useState(false);
  const [period,          setPeriod]          = useState<Period>('all');
  const validatorRef = useRef<HTMLDivElement>(null);

  const showOnboarding = !authLoading && !!profile && !profile.dismissed_onboarding_at && !onboardingDone;

  const fetchTrades = useCallback(async (attempt = 0) => {
    if (!user) return;
    if (attempt === 0) { setTradesLoading(true); setTradesError(null); }
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 15_000);
    let ok = false;
    try {
      const { data, error } = await supabase
        .from('trades').select('*').order('phase1_date', { ascending: false })
        .abortSignal(controller.signal);
      if (error) throw new Error(error.message);
      setTrades((data as Trade[]) ?? []);
      ok = true;
    } catch (err) {
      if (attempt === 0) { setTimeout(() => void fetchTrades(1), 2_000); return; }
      const isTimeout = (err as Error).name === 'AbortError';
      setTradesError(isTimeout ? 'Request timed out — check your connection.' : ((err as Error).message || 'Failed to load.'));
    } finally {
      clearTimeout(tid);
      if (ok || attempt > 0) setTradesLoading(false);
    }
  }, [user]);

  useEffect(() => { void fetchTrades(); }, [fetchTrades]);

  const openTrades = useMemo(() => trades.filter(t => t.status === 'open'), [trades]);

  // Live prices for all open positions — polls every 10s, pauses when tab hidden
  const openTickers = useMemo(() => openTrades.map(t => t.ticker), [openTrades]);
  const {
    prices: livePrices,
    lastUpdated: pricesUpdatedAt,
    refreshing: pricesRefreshing,
    refresh: refreshPrices,
    lastFetchFailed,
  } = useLivePrices(openTickers);

  // ── Stats (period-aware) ────────────────────────────────────────────────────
  const accountSize = profile?.account_size ?? 0;

  const dashStats = useMemo(() => {
    const periodClosed = filterClosedByPeriod(trades, period);
    const wr      = computeWinRate(periodClosed);
    const maxDD   = computeMaxDrawdown(periodClosed, accountSize);
    const winLoss = computeAvgWinLoss(periodClosed);
    return { wr, maxDD, winLoss, realizedPnL: wr.totalPnL };
  }, [trades, period, accountSize]);

  const unrealizedPnL = useMemo(
    () => computeUnrealizedPnL(openTrades, livePrices),
    [openTrades, livePrices],
  );

  const equityDelta    = dashStats.realizedPnL + unrealizedPnL;
  const accountEquity  = accountSize + equityDelta;
  const equityDeltaPct = accountSize > 0 ? (equityDelta / accountSize) * 100 : 0;

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
      user_id:               user.id,
      ticker:                payload.ticker,
      phase1_date:           new Date().toISOString(),
      phase1_price:          payload.entry,
      phase1_shares:         payload.sizing.phase1Shares,
      initial_stop:          payload.stop,
      current_stop:          payload.stop,
      stop_distance_pct:     payload.sizing.stopDistancePct,
      risk_dollars:          payload.sizing.dollarRisk,
      trend_template_passed: payload.tickerData.trendTemplate.passed,
      status:                'open',
      is_what_if:            payload.isWhatIf,
      failed_gates:          payload.isWhatIf ? payload.failedGates : null,
      what_if_reason:        null,
    });
    if (error) { toast({ title: 'Failed to log trade', body: error.message, variant: 'error' }); return; }
    if (payload.isWhatIf) {
      toast({ title: `${payload.ticker} logged as non-system trade`, body: 'Checklist incomplete — tracked for reference only.', variant: 'warning', durationMs: 5000 });
    } else {
      toast({ title: `${payload.ticker} · Phase 1 open`, body: `${payload.sizing.phase1Shares} sh @ $${payload.entry.toFixed(2)} · stop $${payload.stop.toFixed(2)}`, variant: 'success', durationMs: 4500 });
    }
    void fetchTrades();
  };

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
      {showOnboarding && <OnboardingModal onDismiss={() => setOnboardingDone(true)} />}
      <GridOverlay />
      <AppNav />

      <main className="max-w-[1440px] mx-auto px-6 py-7 relative">

        {/* ── Period filter tabs ─────────────────────────────────────────────── */}
        <div className="flex gap-1 mb-4 p-1 rounded-[10px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] w-fit">
          {PERIODS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setPeriod(key)}
              className={cn(
                'px-3 py-1.5 rounded-[8px] text-xs font-semibold transition-all',
                period === key
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Row 1: Account Equity hero ─────────────────────────────────────── */}
        <div
          className="mb-3 p-5 rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface)]"
          style={{ boxShadow: 'var(--shadow-card), var(--inner-highlight)' }}
        >
          <div className="flex items-start justify-between mb-2">
            <div className="text-xs uppercase tracking-[0.18em] font-semibold text-[var(--text-muted)] opacity-60">
              Account Equity
            </div>
            <div className="flex items-center gap-2">
              {lastFetchFailed && openTrades.length > 0 && (
                <WifiOff className="w-3 h-3 text-amber-400" aria-label="Price fetch failed — showing last known prices" />
              )}
              <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-amber-500">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                Live
              </div>
            </div>
          </div>

          <div className="font-mono text-[34px] font-extrabold tracking-tight tabular-nums">
            {accountSize > 0
              ? `$${Math.round(accountEquity).toLocaleString('en-US')}`
              : tradesLoading ? '…' : '$0'}
          </div>

          {accountSize > 0 && (
            <div className={cn(
              'flex items-baseline gap-2 mt-1',
              equityDelta >= 0 ? 'text-emerald-400' : 'text-red-400',
            )}>
              <span className="text-[15px] font-bold font-mono">
                {equityDelta >= 0 ? '+' : '−'}${Math.abs(Math.round(equityDelta)).toLocaleString('en-US')}
              </span>
              <span className="text-[13px] font-semibold">
                ({equityDeltaPct >= 0 ? '+' : ''}{equityDeltaPct.toFixed(1)}%)
              </span>
              <span className="text-xs text-[var(--text-faint)] font-normal">
                from ${accountSize.toLocaleString('en-US')}
              </span>
            </div>
          )}

          <div className="text-xs text-[var(--text-faint)] mt-1.5 font-mono">
            {openTrades.length} open position{openTrades.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* ── Row 2: Realized / Unrealized / Win Rate / Avg R ────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          <StatCard
            label="Realized PnL"
            value={dashStats.realizedPnL !== 0
              ? `${dashStats.realizedPnL >= 0 ? '+' : '−'}$${Math.abs(Math.round(dashStats.realizedPnL)).toLocaleString('en-US')}`
              : '$0'}
            positive={dashStats.realizedPnL > 0}
            negative={dashStats.realizedPnL < 0}
          />
          <StatCard
            label="Unrealized PnL"
            value={openTrades.length > 0
              ? `${unrealizedPnL >= 0 ? '+' : '−'}$${Math.abs(Math.round(unrealizedPnL)).toLocaleString('en-US')}`
              : '—'}
            sublabel={openTrades.length > 0 ? 'live positions' : undefined}
            positive={openTrades.length > 0 && unrealizedPnL > 0}
            negative={openTrades.length > 0 && unrealizedPnL < 0}
          />
          <StatCard
            label="Win Rate"
            value={dashStats.wr.winRate !== null ? `${dashStats.wr.winRate.toFixed(1)}%` : '—'}
            sublabel={dashStats.wr.closedCount > 0 ? `${dashStats.wr.closedCount} closed trades` : undefined}
            positive={dashStats.wr.winRate !== null && dashStats.wr.winRate >= 50}
          />
          <StatCard
            label="Avg R"
            value={dashStats.wr.avgR !== null
              ? `${dashStats.wr.avgR >= 0 ? '+' : ''}${dashStats.wr.avgR.toFixed(2)}R`
              : '—'}
            positive={dashStats.wr.avgR !== null && dashStats.wr.avgR > 0}
            negative={dashStats.wr.avgR !== null && dashStats.wr.avgR < 0}
          />
        </div>

        {/* ── Row 3: Max DD / Avg Win / Avg Loss / Win:Loss ratio ────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-7">
          <StatCard
            label="Max Drawdown"
            value={dashStats.maxDD ? `-${dashStats.maxDD.pct.toFixed(1)}%` : '—'}
            sublabel={dashStats.maxDD
              ? `$${Math.round(dashStats.maxDD.fromAmount).toLocaleString('en-US')} → $${Math.round(dashStats.maxDD.toAmount).toLocaleString('en-US')}`
              : undefined}
            negative={!!dashStats.maxDD}
          />
          <StatCard
            label="Avg Win"
            value={dashStats.winLoss.avgWin !== null
              ? `$${Math.round(dashStats.winLoss.avgWin).toLocaleString('en-US')}`
              : '—'}
            sublabel={dashStats.winLoss.winCount > 0
              ? `${dashStats.winLoss.winCount} winner${dashStats.winLoss.winCount !== 1 ? 's' : ''}`
              : undefined}
            positive={dashStats.winLoss.avgWin !== null}
          />
          <StatCard
            label="Avg Loss"
            value={dashStats.winLoss.avgLoss !== null
              ? `$${Math.round(dashStats.winLoss.avgLoss).toLocaleString('en-US')}`
              : '—'}
            sublabel={dashStats.winLoss.lossCount > 0
              ? `${dashStats.winLoss.lossCount} loser${dashStats.winLoss.lossCount !== 1 ? 's' : ''}`
              : undefined}
            negative={dashStats.winLoss.avgLoss !== null}
          />
          <StatCard
            label="Win / Loss"
            value={dashStats.winLoss.ratio !== null
              ? `${dashStats.winLoss.ratio.toFixed(1)}:1`
              : '—'}
            sublabel="avg win ÷ avg loss"
            positive={dashStats.winLoss.ratio !== null && dashStats.winLoss.ratio >= 1}
            negative={dashStats.winLoss.ratio !== null && dashStats.winLoss.ratio < 1}
          />
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

            {/* Col 1 — Checklist */}
            <ChecklistCard className="lg:col-start-1 lg:row-start-1 xl:col-start-1" />

            {/* Col 3 — Positions + Playbook + Leaders */}
            <div className="flex flex-col gap-5 lg:col-start-2 lg:row-start-1 lg:row-span-2 xl:col-start-3 xl:row-start-1 xl:row-span-1">

              {/* Active Positions */}
              <div
                className="rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5"
                style={{ boxShadow: 'var(--shadow-card), var(--inner-highlight)' }}
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-[15px] font-bold tracking-tight text-[var(--text-primary)]">Active Positions</h2>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">Phase 1 entries</p>
                  </div>
                  <Link href="/journal" className="flex items-center gap-1 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors uppercase tracking-wider">
                    Journal <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>

                <div className="flex flex-col gap-2">
                  {tradesLoading && (
                    <div className="flex items-center gap-2 py-5 text-[var(--text-faint)] text-xs">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
                    </div>
                  )}
                  {!tradesLoading && tradesError && (
                    <div className="py-4 flex flex-col gap-2 items-start">
                      <p className="text-xs text-red-500">{tradesError}</p>
                      <button onClick={() => void fetchTrades()} className="text-xs font-semibold text-[#22D3EE] hover:underline">
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
                  className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2.5 border border-dashed border-[var(--border-subtle)] rounded-[9px] text-xs font-semibold uppercase tracking-wider text-[var(--text-faint)] hover:border-[var(--border-hover)] hover:text-[var(--text-muted)] transition-all"
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
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">Realized outcomes</p>
                  </div>
                  <Link href="/playbook" className="flex items-center gap-1 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors uppercase tracking-wider">
                    View all <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
                <PlaybookStrip counts={playbookCounts} />
              </div>

              {/* Stage 2 Leaders */}
              <Stage2Leaders onSelectTicker={handleSelectTicker} />

            </div>

            {/* Col 2 — Sizer */}
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
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}
// Keep export-compatible for any future imports
export { fmtAccountSize };

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({
  label, value, sublabel, positive, negative,
}: {
  label: string; value: string; sublabel?: string;
  positive?: boolean; negative?: boolean;
}) {
  const hasValue  = value !== '—';
  const isPositive = positive === true;
  const isNegative = negative === true;

  return (
    <div
      className="p-4 rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-surface)]"
      style={{ boxShadow: 'var(--shadow-card), var(--inner-highlight)' }}
    >
      <div className="text-xs uppercase tracking-[0.18em] font-semibold text-[var(--text-muted)] opacity-60 mb-2">
        {label}
      </div>
      <div className="flex items-center gap-2">
        <span className={cn(
          'font-mono text-[22px] font-extrabold tracking-tight tabular-nums',
          isPositive ? 'text-emerald-400'
            : isNegative ? 'text-red-400'
            : 'text-[var(--text-primary)]',
        )}>
          {value}
        </span>
        {hasValue && (positive !== undefined || negative !== undefined) && (
          <span className={cn(
            'w-1.5 h-1.5 rounded-full flex-shrink-0',
            isPositive ? 'bg-[#10F088]' : isNegative ? 'bg-red-500' : 'bg-[var(--text-faint)]',
          )} />
        )}
      </div>
      {sublabel && (
        <div className="text-[10px] text-[var(--text-faint)] font-mono mt-1 truncate">
          {sublabel}
        </div>
      )}
    </div>
  );
}

function PositionCard({ trade, livePrice }: { trade: Trade; livePrice?: LivePrice }) {
  const daysIn       = Math.floor((Date.now() - new Date(trade.phase1_date).getTime()) / 86_400_000);
  const currentShares = trade.current_shares || trade.phase1_shares;
  const currentPrice  = livePrice?.price ?? null;

  const unrealizedPnL = currentPrice != null
    ? (currentPrice - trade.phase1_price) * currentShares
    : null;

  const stop = trade.current_stop ?? trade.initial_stop;
  const distanceToStop = currentPrice != null
    ? ((currentPrice - stop) / currentPrice) * 100
    : null;

  const isApproachingStop = distanceToStop !== null && distanceToStop <= 1;
  const isNearStop        = distanceToStop !== null && distanceToStop <= 3 && !isApproachingStop;
  const isWinning         = unrealizedPnL !== null && unrealizedPnL > 0 && !isNearStop && !isApproachingStop;
  const isLosing          = unrealizedPnL !== null && unrealizedPnL < 0 && !isNearStop && !isApproachingStop;

  const currentR = currentPrice != null ? computeCurrentR(trade, currentPrice) : null;

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
              'font-mono text-xs font-semibold',
              livePrice.changePct >= 0 ? 'text-[#10F088]' : 'text-[#FF3B5C]',
            )}>
              {livePrice.changePct >= 0 ? '+' : ''}{livePrice.changePct.toFixed(2)}%
            </span>
          )}
        </div>
      )}

      {/* Mini stat strip */}
      <div className="grid grid-cols-4 gap-x-2 text-xs font-mono mb-2">
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

      {/* Risk + P&L + Current R */}
      <div className="text-xs text-[var(--text-faint)] font-mono flex items-center gap-2 flex-wrap">
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
        {currentR !== null && (
          <>
            <span className="text-[var(--border-hover)]">·</span>
            <span className={cn('tabular-nums font-semibold', currentR >= 0 ? 'text-emerald-400' : 'text-red-400')}>
              {currentR >= 0 ? '+' : ''}{currentR.toFixed(2)}R
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
      <p className="text-xs text-[var(--text-muted)]">
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
