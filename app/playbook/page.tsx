// app/playbook/page.tsx
//
// Visual archive of all trades — closed winners/losers and live open positions.
// Stats (Win Rate, Avg R) are calculated STRICTLY from fully realized outcomes.

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import {
  AlertTriangle, Check, Layers, Loader2, Plus, Radar, TrendingDown, TrendingUp, Trophy, X, Zap,
} from 'lucide-react';
import { AppNav } from '@/components/nav/app-nav';
import { GridOverlay } from '@/components/ui/grid-overlay';
import { AddWhatIfModal } from '@/components/playbook/add-what-if-modal';
import { supabase, type Trade, type TradeOutcome, type PartialExit } from '@/lib/supabase-client';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import Link from 'next/link';

type TabFilter = 'all' | 'winner' | 'loser' | 'breakeven' | 'live' | 'what-if' | 'charts';

// ── helpers ────────────────────────────────────────────────────────────────────

const getPartials = (t: Trade): PartialExit[] => Array.isArray(t.partials) ? t.partials : [];
const getSells    = (t: Trade) => getPartials(t).filter(p => (p.action ?? 'sell') === 'sell');
const getBuys     = (t: Trade) => getPartials(t).filter(p => p.action === 'buy');

function getExitEvents(t: Trade): { isWin: boolean; r_multiple: number }[] {
  const events: { isWin: boolean; r_multiple: number }[] = [];
  let shares   = t.phase1_shares;
  let invested = t.phase1_price * t.phase1_shares;

  const sorted = [...getPartials(t)].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  for (const p of sorted) {
    if (shares <= 0) break;
    if ((p.action ?? 'sell') === 'sell') {
      const avgEntry = invested / shares;
      events.push({ isWin: p.price > avgEntry, r_multiple: p.r_multiple });
      invested = Math.max(0, invested - avgEntry * p.shares);
      shares  -= p.shares;
    } else {
      invested += p.shares * p.price;
      shares   += p.shares;
    }
  }

  if (t.status !== 'open' && t.exit_price !== null && shares > 0) {
    const avgEntry = shares > 0 ? invested / shares : t.phase1_price;
    events.push({ isWin: t.exit_price > avgEntry, r_multiple: t.r_multiple ?? 0 });
  }

  return events;
}

function PlaybookInner() {
  const params = useSearchParams();
  const filterParam = params.get('filter') ?? 'all';
  const filter: TabFilter =
    filterParam === 'live'       ? 'live'      :
    filterParam === 'winners'    ? 'winner'    :
    filterParam === 'losers'     ? 'loser'     :
    filterParam === 'breakevens' ? 'breakeven' :
    filterParam === 'what-if'    ? 'what-if'   :
    filterParam === 'charts'     ? 'charts'    : 'all';

  const { user } = useAuth();
  const [trades,        setTrades]        = useState<Trade[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [showWhatIf,    setShowWhatIf]    = useState(false);

  const fetchTrades = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('trades')
      .select('*')
      .order('phase1_date', { ascending: false });
    if (!error) setTrades((data as Trade[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { void fetchTrades(); }, [fetchTrades]);

  const stats = useMemo(() => {
    const allEvents = trades.flatMap(getExitEvents);
    const wins      = allEvents.filter(e => e.isWin).length;
    const closed    = trades.filter(t => t.status !== 'open');
    const withR     = closed.filter(t => t.r_multiple !== null);
    const totalPnL  = closed.reduce((s, t) => s + (t.pnl_dollars ?? 0), 0);
    const openPartialPnL = trades
      .filter(t => t.status === 'open')
      .flatMap(getSells)
      .reduce((s, p) => s + p.pnl_dollars, 0);
    return {
      winRate:     allEvents.length > 0 ? (wins / allEvents.length) * 100 : null,
      totalEvents: allEvents.length,
      winCount:    wins,
      avgR:        withR.length > 0 ? withR.reduce((s, t) => s + (t.r_multiple ?? 0), 0) / withR.length : null,
      totalPnL,
      openPartialPnL,
      closedCount: closed.length,
    };
  }, [trades]);

  const counts = useMemo(() => {
    const closed = trades.filter(t => t.status !== 'open');
    return {
      all:       closed.length,
      winner:    closed.filter(t => t.outcome === 'winner').length,
      loser:     closed.filter(t => t.outcome === 'loser').length,
      breakeven: closed.filter(t => t.outcome === 'breakeven').length,
      live:      trades.filter(t => t.status === 'open').length,
      'what-if': trades.filter(t => t.is_what_if).length,
      charts:    trades.filter(t => t.screenshot_url).length,
    };
  }, [trades]);

  const visible = useMemo(() => {
    if (filter === 'live')     return trades.filter(t => t.status === 'open');
    if (filter === 'what-if')  return trades.filter(t => t.is_what_if);
    if (filter === 'charts')   return trades.filter(t => t.screenshot_url);
    const closed = trades.filter(t => t.status !== 'open');
    if (filter === 'all') return closed;
    return closed.filter(t => t.outcome === filter);
  }, [trades, filter]);

  const TABS: { key: TabFilter; href: string; label: string }[] = [
    { key: 'all',      href: '/playbook',                   label: 'Closed'   },
    { key: 'live',     href: '/playbook?filter=live',       label: 'Live'     },
    { key: 'winner',   href: '/playbook?filter=winners',    label: 'Winners'  },
    { key: 'loser',    href: '/playbook?filter=losers',     label: 'Losers'   },
    { key: 'breakeven',href: '/playbook?filter=breakevens', label: 'Breakevens'},
    { key: 'what-if',  href: '/playbook?filter=what-if',    label: 'What-If'  },
    { key: 'charts',   href: '/playbook?filter=charts',     label: 'Charts'   },
  ];

  const tabBadgeActive: Record<TabFilter, string> = {
    'all':       'bg-slate-400/20 text-slate-500',
    'live':      'bg-amber-400/20 text-amber-600',
    'winner':    'bg-green-400/20 text-green-600',
    'loser':     'bg-red-400/20 text-red-500',
    'breakeven': 'bg-cyan-400/20 text-cyan-600',
    'what-if':   'bg-amber-500/20 text-amber-700',
    'charts':    'bg-violet-400/20 text-violet-600',
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <GridOverlay />
      <AppNav />

      <main className="max-w-[1200px] mx-auto px-6 py-10 relative">

        <div className="flex items-start justify-between mb-7">
          <div>
            <h1 className="text-[20px] font-extrabold tracking-tight mb-1">Playbook</h1>
            <p className="text-[13px] text-[var(--text-muted)] leading-relaxed">
              Every trade — closed and live. Stats computed from realized outcomes only.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowWhatIf(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-[10px] bg-amber-500/15 border border-amber-500/30 text-amber-600 hover:bg-amber-500/25 hover:border-amber-500/50 transition-all text-[12px] font-bold uppercase tracking-wider flex-shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Log Off-System Trade
          </button>
        </div>

        {showWhatIf && user && (
          <AddWhatIfModal
            userId={user.id}
            onClose={() => setShowWhatIf(false)}
            onSaved={trade => {
              setTrades(prev => [trade, ...prev]);
              setShowWhatIf(false);
            }}
          />
        )}

        {/* Stats strip */}
        {!loading && stats.closedCount > 0 && (
          <div className="grid grid-cols-3 gap-5 mb-7">
            <StatTile
              label="Win Rate"
              sublabel={`${stats.totalEvents} exit event${stats.totalEvents !== 1 ? 's' : ''}`}
              value={stats.winRate !== null ? `${stats.winRate.toFixed(1)}%` : '—'}
              positive={stats.winRate !== null && stats.winRate >= 50}
            />
            <StatTile
              label="Avg R"
              sublabel="realized exits only"
              value={stats.avgR !== null ? `${stats.avgR >= 0 ? '+' : ''}${stats.avgR.toFixed(2)}R` : '—'}
              positive={stats.avgR !== null && stats.avgR >= 0}
            />
            <StatTile
              label="Total PnL"
              sublabel={stats.openPartialPnL !== 0
                ? `+$${stats.openPartialPnL.toFixed(0)} booked open`
                : 'closed trades'}
              value={`${stats.totalPnL >= 0 ? '+' : ''}$${Math.abs(stats.totalPnL).toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
              positive={stats.totalPnL >= 0}
            />
          </div>
        )}

        {/* Segmented control tabs */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--tab-strip-bg)] mb-7 overflow-x-auto">
          {TABS.map(t => (
            <Link
              key={t.key}
              href={t.href}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all whitespace-nowrap flex-shrink-0',
                filter === t.key
                  ? 'bg-[var(--tab-active-bg)] text-[var(--text-primary)] shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]',
              )}
            >
              {t.key === 'live' && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
              )}
              {t.label}
              <span className={cn(
                'font-mono text-[10px] px-1.5 py-0.5 rounded-full tabular-nums',
                filter === t.key
                  ? tabBadgeActive[t.key]
                  : 'bg-[var(--bg-elevated)] text-[var(--text-faint)]',
              )}>
                {counts[t.key]}
              </span>
            </Link>
          ))}
        </div>

        {/* Content */}
        {loading && (
          <div className="flex items-center justify-center py-24 gap-3 text-[var(--text-muted)]">
            <Loader2 className="w-5 h-5 animate-spin text-[#22D3EE]" />
            <span className="text-[13px] font-semibold">Loading trades…</span>
          </div>
        )}

        {!loading && visible.length === 0 && (
          <EmptyState filter={filter} />
        )}

        {!loading && visible.length > 0 && filter === 'charts' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visible.map(trade => (
              <ChartCard key={trade.id} trade={trade} />
            ))}
          </div>
        )}

        {!loading && visible.length > 0 && filter !== 'charts' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visible.map(trade =>
              trade.is_what_if
                ? <WhatIfTradeCard key={trade.id} trade={trade} />
                : trade.status === 'open'
                  ? <LiveTradeCard key={trade.id} trade={trade} />
                  : <ClosedTradeCard key={trade.id} trade={trade} />
            )}
          </div>
        )}
      </main>
    </div>
  );
}

// ── StatTile ───────────────────────────────────────────────────────────────────

function StatTile({
  label, sublabel, value, positive,
}: { label: string; sublabel: string; value: string; positive: boolean }) {
  return (
    <div
      className="p-5 rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface)]"
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <div className="text-[9px] uppercase tracking-[0.18em] font-bold text-[var(--text-muted)] mb-2 opacity-70">
        {label}
      </div>
      <div className="flex items-center gap-2.5 mb-1">
        <span className="font-mono text-3xl font-extrabold tracking-tight text-[var(--text-primary)]">
          {value}
        </span>
        <span className={cn(
          'w-2 h-2 rounded-full flex-shrink-0',
          positive ? 'bg-[#10F088]' : 'bg-[#EF4444]',
        )} />
      </div>
      <div className="text-[10px] font-mono text-[var(--text-faint)] opacity-70">{sublabel}</div>
    </div>
  );
}

// ── ClosedTradeCard ────────────────────────────────────────────────────────────

function ClosedTradeCard({ trade }: { trade: Trade }) {
  const outcome     = trade.outcome;
  const pnlPositive = (trade.pnl_dollars ?? 0) >= 0;
  const sells       = getSells(trade);
  const entryDate   = formatDate(trade.phase1_date);
  const exitDate    = trade.exit_date ? formatDate(trade.exit_date) : null;

  const topBg =
    outcome === 'winner'    ? 'bg-green-500'  :
    outcome === 'loser'     ? 'bg-red-500'    :
    outcome === 'breakeven' ? 'bg-amber-400'  : 'bg-[var(--border-subtle)]';

  const accentText =
    outcome === 'winner'    ? 'text-[#10F088]'  :
    outcome === 'loser'     ? 'text-[#EF4444]'  :
    outcome === 'breakeven' ? 'text-amber-400'   : 'text-[var(--text-secondary)]';

  const badgeCls =
    outcome === 'winner'    ? 'bg-[#10F088]/15 text-[#10F088]'  :
    outcome === 'loser'     ? 'bg-[#EF4444]/15 text-[#EF4444]'  :
    outcome === 'breakeven' ? 'bg-amber-400/15 text-amber-400'   : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)]';

  return (
    <div
      className="rounded-[12px] overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-surface)] flex flex-col"
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <div className={cn('h-[3px] w-full flex-shrink-0', topBg)} />
      <div className="p-4 flex flex-col gap-3 flex-1">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-mono text-[20px] font-extrabold tracking-tight">{trade.ticker}</span>
              {trade.setup_type && (
                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-muted)]">
                  {trade.setup_type}
                </span>
              )}
              {sells.length > 0 && (
                <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-400">
                  <Layers className="w-2.5 h-2.5" />
                  {sells.length} exit{sells.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="text-[10px] font-mono text-[var(--text-faint)]">
              {entryDate}{exitDate ? ` → ${exitDate}` : ''}
            </div>
          </div>

          <div className={cn(
            'flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider px-2 py-1 rounded-[6px] flex-shrink-0',
            badgeCls,
          )}>
            {outcome === 'winner' && <Check className="w-2.5 h-2.5" strokeWidth={3} />}
            {outcome === 'loser'  && <X     className="w-2.5 h-2.5" strokeWidth={3} />}
            {outcome === 'winner' ? 'Win' : outcome === 'loser' ? 'Loss' : 'Even'}
          </div>
        </div>

        {/* Price grid */}
        <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
          <div>
            <div className="text-[var(--text-faint)] mb-0.5 uppercase tracking-wider text-[9px]">Entry</div>
            <div className="text-[#22D3EE] font-semibold">${trade.phase1_price.toFixed(2)}</div>
          </div>
          {trade.exit_price !== null && (
            <div>
              <div className="text-[var(--text-faint)] mb-0.5 uppercase tracking-wider text-[9px]">Exit</div>
              <div className={cn('font-semibold', pnlPositive ? 'text-[#10F088]' : 'text-[#EF4444]')}>
                ${trade.exit_price.toFixed(2)}
              </div>
            </div>
          )}
          <div>
            <div className="text-[var(--text-faint)] mb-0.5 uppercase tracking-wider text-[9px]">Stop</div>
            <div className="text-[var(--text-secondary)] font-semibold">${trade.initial_stop.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-[var(--text-faint)] mb-0.5 uppercase tracking-wider text-[9px]">Shares</div>
            <div className="text-[var(--text-secondary)] font-semibold">{trade.phase1_shares}</div>
          </div>
        </div>

        {/* PnL strip */}
        {(trade.pnl_dollars !== null || trade.r_multiple !== null) && (
          <div className={cn(
            'flex items-center justify-between px-3 py-2 rounded-[8px] border',
            pnlPositive
              ? 'bg-[#10F088]/[0.06] border-[#10F088]/20'
              : 'bg-[#EF4444]/[0.06] border-[#EF4444]/20',
          )}>
            <div className="flex items-center gap-1.5">
              {pnlPositive
                ? <TrendingUp   className="w-3 h-3 text-[#10F088]" />
                : <TrendingDown className="w-3 h-3 text-[#EF4444]" />}
              <span className={cn('font-mono text-[13px] font-extrabold', accentText)}>
                {pnlPositive ? '+' : ''}${Math.abs(trade.pnl_dollars ?? 0).toFixed(0)}
              </span>
            </div>
            {trade.r_multiple !== null && (
              <span className={cn('font-mono text-[12px] font-bold', accentText)}>
                {trade.r_multiple >= 0 ? '+' : ''}{trade.r_multiple.toFixed(2)}R
              </span>
            )}
          </div>
        )}

        {/* Trend Template */}
        <div className="flex items-center gap-1.5">
          <span className={cn(
            'w-3.5 h-3.5 rounded-sm flex items-center justify-center flex-shrink-0',
            trade.trend_template_passed ? 'bg-[#10F088]/25' : 'bg-[#EF4444]/20',
          )}>
            {trade.trend_template_passed
              ? <Check className="w-2.5 h-2.5 text-[#10F088]" strokeWidth={4} />
              : <X     className="w-2.5 h-2.5 text-[#EF4444]" strokeWidth={4} />}
          </span>
          <span className="text-[10px] text-[var(--text-muted)]">Trend Template</span>
        </div>

        {/* Partial exits mini-list */}
        {sells.length > 0 && (
          <div className="flex flex-col gap-1 border-t border-[var(--divider-dim)] pt-2.5">
            {sells.map((p, i) => (
              <div key={p.id} className="flex items-center justify-between text-[10px] font-mono text-[var(--text-faint)]">
                <span>Exit {i + 1} · {p.shares} sh @ ${p.price.toFixed(2)}</span>
                <span className={p.pnl_dollars >= 0 ? 'text-[#10F088]' : 'text-[#EF4444]'}>
                  {p.pnl_dollars >= 0 ? '+' : ''}${p.pnl_dollars.toFixed(0)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Notes */}
        {trade.notes && (
          <p className="text-[11px] text-[var(--text-muted)] leading-relaxed line-clamp-2 border-t border-[var(--border-subtle)] pt-2.5">
            {trade.notes}
          </p>
        )}
      </div>
    </div>
  );
}

// ── LiveTradeCard ──────────────────────────────────────────────────────────────

function LiveTradeCard({ trade }: { trade: Trade }) {
  const sells           = getSells(trade);
  const buys            = getBuys(trade);
  const bookedPnL       = sells.reduce((s, p) => s + p.pnl_dollars, 0);
  const bookedPositive  = bookedPnL >= 0;
  const sharesRemaining = trade.phase1_shares
    + buys.reduce((s, p)  => s + p.shares, 0)
    - sells.reduce((s, p) => s + p.shares, 0);
  const daysIn = Math.floor((Date.now() - new Date(trade.phase1_date).getTime()) / 86_400_000);

  return (
    <div
      className="rounded-[12px] overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-surface)] flex flex-col"
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <div className="h-[3px] w-full flex-shrink-0 bg-amber-400" />
      <div className="p-4 flex flex-col gap-3 flex-1">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-mono text-[20px] font-extrabold tracking-tight">{trade.ticker}</span>
              {trade.setup_type && (
                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-muted)]">
                  {trade.setup_type}
                </span>
              )}
              {sells.length > 0 && (
                <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-400">
                  <Layers className="w-2.5 h-2.5" />
                  {sells.length} trim{sells.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="text-[10px] font-mono text-[var(--text-faint)]">{formatDate(trade.phase1_date)} · {daysIn}d in trade</div>
          </div>

          <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-[6px] bg-amber-400/15 text-amber-500 flex-shrink-0">
            <Zap className="w-2.5 h-2.5" />
            Live
          </div>
        </div>

        {/* Entry details */}
        <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
          <div>
            <div className="text-[var(--text-faint)] mb-0.5 uppercase tracking-wider text-[9px]">Entry</div>
            <div className="text-[#22D3EE] font-semibold">${trade.phase1_price.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-[var(--text-faint)] mb-0.5 uppercase tracking-wider text-[9px]">Stop</div>
            <div className="text-[#EF4444] font-semibold">${trade.initial_stop.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-[var(--text-faint)] mb-0.5 uppercase tracking-wider text-[9px]">Shares left</div>
            <div className="text-[var(--text-dim)] font-semibold">{sharesRemaining}</div>
          </div>
          <div>
            <div className="text-[var(--text-faint)] mb-0.5 uppercase tracking-wider text-[9px]">Risk $</div>
            <div className="text-[var(--text-secondary)] font-semibold">${trade.risk_dollars.toFixed(0)}</div>
          </div>
        </div>

        {bookedPnL !== 0 && (
          <div className={cn(
            'flex items-center justify-between px-3 py-2 rounded-[8px] border',
            bookedPositive
              ? 'bg-[#10F088]/[0.06] border-[#10F088]/20'
              : 'bg-[#EF4444]/[0.06] border-[#EF4444]/20',
          )}>
            <span className="text-[9px] uppercase tracking-wider font-bold text-[var(--text-faint)]">Booked so far</span>
            <span className={cn('font-mono text-[13px] font-extrabold', bookedPositive ? 'text-[#10F088]' : 'text-[#EF4444]')}>
              {bookedPositive ? '+' : ''}${bookedPnL.toFixed(0)}
            </span>
          </div>
        )}

        {/* Trend Template */}
        <div className="flex items-center gap-1.5">
          <span className={cn(
            'w-3.5 h-3.5 rounded-sm flex items-center justify-center flex-shrink-0',
            trade.trend_template_passed ? 'bg-[#10F088]/25' : 'bg-[#EF4444]/20',
          )}>
            {trade.trend_template_passed
              ? <Check className="w-2.5 h-2.5 text-[#10F088]" strokeWidth={4} />
              : <X     className="w-2.5 h-2.5 text-[#EF4444]" strokeWidth={4} />}
          </span>
          <span className="text-[10px] text-[var(--text-muted)]">Trend Template</span>
        </div>

        <Link
          href="/journal"
          className="text-center text-[11px] font-semibold text-[var(--text-muted)] hover:text-[#22D3EE] transition-colors mt-auto"
        >
          Manage in Journal →
        </Link>
      </div>
    </div>
  );
}

// ── Gate label map for retrospective ──────────────────────────────────────────

const GATE_LABELS: Record<string, string> = {
  stage2:           'Stage 2 uptrend not confirmed',
  vcp_confirmed:    'VCP setup not confirmed',
  clear_pivot:      'No clear breakout pivot',
  earnings_safe:    'Earnings risk (imminent)',
  above_emas:       'Price below key EMAs',
  rs_above_80:      'RS Rating below 80',
  market_uptrend:   'Market not in uptrend',
  time_of_day:      'Suboptimal entry timing',
  volume_spike:     'No volume spike on breakout',
  stop_under_10pct: 'Stop distance exceeded cap',
  manual_entry:     'Manually logged outside validator',
};

// ── WhatIfTradeCard ────────────────────────────────────────────────────────────

function WhatIfTradeCard({ trade }: { trade: Trade }) {
  const sells  = getSells(trade);
  const buys   = getBuys(trade);
  const daysIn = Math.floor((Date.now() - new Date(trade.phase1_date).getTime()) / 86_400_000);
  const pnlPositive = (trade.pnl_dollars ?? 0) >= 0;

  return (
    <div
      className="rounded-[12px] overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-surface)] flex flex-col"
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <div className="h-[3px] w-full flex-shrink-0 bg-amber-600" />
      <div className="p-4 flex flex-col gap-3 flex-1">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-mono text-[20px] font-extrabold tracking-tight">{trade.ticker}</span>
              {trade.setup_type && (
                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-muted)]">
                  {trade.setup_type}
                </span>
              )}
            </div>
            <div className="text-[10px] font-mono text-[var(--text-faint)]">
              {formatDate(trade.phase1_date)} · {trade.status === 'open' ? `${daysIn}d in trade` : 'closed'}
            </div>
          </div>
          <span className="text-[9px] font-extrabold uppercase tracking-wider px-2 py-1 rounded-[6px] bg-red-100 text-red-700 flex-shrink-0">
            Non-System
          </span>
        </div>

        {/* Price grid */}
        <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
          <div>
            <div className="text-[var(--text-faint)] mb-0.5 uppercase tracking-wider text-[9px]">Entry</div>
            <div className="text-[#22D3EE] font-semibold">${trade.phase1_price.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-[var(--text-faint)] mb-0.5 uppercase tracking-wider text-[9px]">Stop</div>
            <div className="text-[#EF4444] font-semibold">${trade.initial_stop.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-[var(--text-faint)] mb-0.5 uppercase tracking-wider text-[9px]">Shares</div>
            <div className="text-[var(--text-secondary)] font-semibold">{trade.phase1_shares}</div>
          </div>
          <div>
            <div className="text-[var(--text-faint)] mb-0.5 uppercase tracking-wider text-[9px]">Risk $</div>
            <div className="text-[var(--text-secondary)] font-semibold">${trade.risk_dollars.toFixed(0)}</div>
          </div>
        </div>

        {/* PnL if closed */}
        {trade.pnl_dollars !== null && (
          <div className={cn(
            'flex items-center justify-between px-3 py-2 rounded-[8px] border',
            pnlPositive
              ? 'bg-[#10F088]/[0.06] border-[#10F088]/20'
              : 'bg-[#EF4444]/[0.06] border-[#EF4444]/20',
          )}>
            <span className="text-[9px] uppercase tracking-wider font-bold text-[var(--text-faint)]">Hypothetical P&L</span>
            <span className={cn('font-mono text-[13px] font-extrabold', pnlPositive ? 'text-[#10F088]' : 'text-[#EF4444]')}>
              {pnlPositive ? '+' : ''}${Math.abs(trade.pnl_dollars).toFixed(0)}
            </span>
          </div>
        )}

        {/* Failed-gates retrospective — only on losing What-If trades */}
        {trade.pnl_dollars !== null && trade.pnl_dollars < 0 && trade.failed_gates && trade.failed_gates.length > 0 && (
          <div className="px-3 py-2.5 rounded-[9px] bg-[#EF4444]/[0.06] border border-[#EF4444]/25">
            <div className="flex items-center gap-1.5 mb-1.5">
              <AlertTriangle className="w-3 h-3 text-[#EF4444] flex-shrink-0" />
              <span className="text-[9px] font-extrabold uppercase tracking-wider text-[#EF4444]">Why this failed</span>
            </div>
            <ul className="flex flex-col gap-0.5">
              {trade.failed_gates.map(g => (
                <li key={g} className="flex items-start gap-1.5 text-[10px] text-[var(--text-dim)]">
                  <span className="w-1 h-1 rounded-full bg-[#EF4444]/60 flex-shrink-0 mt-[5px]" />
                  {GATE_LABELS[g] ?? g}
                </li>
              ))}
            </ul>
            {trade.what_if_reason && (
              <p className="text-[10px] text-[var(--text-muted)] italic mt-1.5 leading-snug">
                "{trade.what_if_reason}"
              </p>
            )}
          </div>
        )}

        <div className="flex items-center gap-1.5 pt-0.5 border-t border-[var(--divider)] mt-auto">
          <span className="text-[10px] text-amber-600 font-semibold">⚠ Not counted in system stats</span>
        </div>
      </div>
    </div>
  );
}

// ── ChartCard ──────────────────────────────────────────────────────────────────

function ChartCard({ trade }: { trade: Trade }) {
  const outcome = trade.outcome;
  const topBg =
    outcome === 'winner'    ? 'bg-green-500' :
    outcome === 'loser'     ? 'bg-red-500'   :
    outcome === 'breakeven' ? 'bg-amber-400' : 'bg-[var(--border-subtle)]';
  const outcomeText =
    outcome === 'winner'    ? 'text-[#10F088]'  :
    outcome === 'loser'     ? 'text-[#EF4444]'  :
    outcome === 'breakeven' ? 'text-amber-400'   : 'text-[var(--text-muted)]';

  return (
    <div
      className="rounded-[12px] overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-surface)]"
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <div className={cn('h-[3px] w-full', topBg)} />
      <div className="relative" style={{ aspectRatio: '16/7' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={trade.screenshot_url!} alt={`${trade.ticker} chart`} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute bottom-2 left-3 right-3 flex items-end justify-between">
          <span className="font-mono text-[15px] font-extrabold tracking-tight text-white">{trade.ticker}</span>
          {trade.pnl_pct !== null && (
            <span className={cn('font-mono text-[12px] font-bold', trade.pnl_pct >= 0 ? 'text-[#10F088]' : 'text-[#EF4444]')}>
              {trade.pnl_pct >= 0 ? '+' : ''}{trade.pnl_pct.toFixed(2)}%
            </span>
          )}
        </div>
      </div>
      <div className="px-3 py-2 flex items-center gap-2 text-[10px] font-mono text-[var(--text-muted)]">
        <span>{formatDate(trade.phase1_date)}</span>
        {trade.setup_type && <span className="px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-secondary)]">{trade.setup_type}</span>}
        <span className={cn('ml-auto font-bold uppercase', outcomeText)}>
          {outcome ?? (trade.status === 'open' ? 'open' : '—')}
        </span>
      </div>
    </div>
  );
}

// ── EmptyState ─────────────────────────────────────────────────────────────────

function EmptyState({ filter }: { filter: TabFilter }) {
  const config: Record<TabFilter, { icon: typeof Layers; title: string; body: string }> = {
    all:       { icon: Layers,  title: 'No closed trades yet',      body: 'Close a trade in the Journal and it will appear here.' },
    live:      { icon: Radar,   title: 'No open positions',         body: 'Log a trade in the Journal to see it here.' },
    winner:    { icon: Trophy,  title: 'No winners yet',            body: 'Keep executing your system. They\'ll come.' },
    loser:     { icon: Layers,  title: 'No losses logged',          body: 'Good — but closed losers will show here.' },
    breakeven: { icon: Layers,  title: 'No breakevens logged',      body: 'Breakeven trades will appear here.' },
    'what-if': { icon: Layers,  title: 'No What-If trades',         body: 'Trades logged outside the system rules appear here for reference.' },
    charts:    { icon: Layers,  title: 'No chart screenshots yet',  body: 'Upload a chart screenshot when logging a trade.' },
  };
  const { icon: Icon, title, body } = config[filter];

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <Icon className="w-12 h-12 text-[var(--text-faint)] mb-5" strokeWidth={1.2} />
      <h3 className="text-[16px] font-extrabold text-[var(--text-primary)] mb-2">{title}</h3>
      <p className="text-[13px] text-[var(--text-muted)] mb-6 max-w-[280px] leading-relaxed">{body}</p>
      <Link
        href="/journal"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-[12px] uppercase tracking-[0.08em] hover:opacity-90 transition bg-[var(--text-primary)] text-[var(--bg-primary)]"
      >
        Go to Journal
      </Link>
    </div>
  );
}

// ── helpers ────────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
}

export default function PlaybookPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--bg-primary)]" />}>
      <PlaybookInner />
    </Suspense>
  );
}
