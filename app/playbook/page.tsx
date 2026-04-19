// app/playbook/page.tsx
//
// Visual archive of all trades — closed winners/losers and live open positions.
// Stats (Win Rate, Avg R) are calculated STRICTLY from fully realized outcomes.

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Check, Layers, Loader2, TrendingDown, TrendingUp, X, Zap } from 'lucide-react';
import { AppNav } from '@/components/nav/app-nav';
import { GridOverlay } from '@/components/ui/grid-overlay';
import { supabase, type Trade, type TradeOutcome, type PartialExit } from '@/lib/supabase-client';
import { cn } from '@/lib/utils';
import Link from 'next/link';

type TabFilter = 'all' | 'winner' | 'loser' | 'breakeven' | 'live' | 'charts';

// ── helpers ────────────────────────────────────────────────────────────────────

const getPartials = (t: Trade): PartialExit[] => Array.isArray(t.partials) ? t.partials : [];
const getSells    = (t: Trade) => getPartials(t).filter(p => (p.action ?? 'sell') === 'sell');
const getBuys     = (t: Trade) => getPartials(t).filter(p => p.action === 'buy');

/**
 * Each trim or full-close is an independent exit event.
 * Tracks running weighted avg entry so buys correctly shift the cost basis
 * before each sell is evaluated.
 */
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

  // Final close exit (remaining shares after partials)
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
    filterParam === 'charts'     ? 'charts'    : 'all';

  const [trades,  setTrades]  = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

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

  // ── Stats: win rate from every exit event (partials + closes, all trades) ─────
  const stats = useMemo(() => {
    const allEvents = trades.flatMap(getExitEvents);
    const wins      = allEvents.filter(e => e.isWin).length;

    const closed   = trades.filter(t => t.status !== 'open');
    const withR    = closed.filter(t => t.r_multiple !== null);
    const totalPnL = closed.reduce((s, t) => s + (t.pnl_dollars ?? 0), 0);

    // Booked PnL from sell partials on still-open trades
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

  // ── Tab counts ─────────────────────────────────────────────────────────────
  const counts = useMemo(() => {
    const closed = trades.filter(t => t.status !== 'open');
    return {
      all:       closed.length,
      winner:    closed.filter(t => t.outcome === 'winner').length,
      loser:     closed.filter(t => t.outcome === 'loser').length,
      breakeven: closed.filter(t => t.outcome === 'breakeven').length,
      live:      trades.filter(t => t.status === 'open').length,
      charts:    trades.filter(t => t.screenshot_url).length,
    };
  }, [trades]);

  // ── Visible rows for current tab ───────────────────────────────────────────
  const visible = useMemo(() => {
    if (filter === 'live')   return trades.filter(t => t.status === 'open');
    if (filter === 'charts') return trades.filter(t => t.screenshot_url);
    const closed = trades.filter(t => t.status !== 'open');
    if (filter === 'all') return closed;
    return closed.filter(t => t.outcome === filter);
  }, [trades, filter]);

  const TABS: { key: TabFilter; href: string; label: string }[] = [
    { key: 'all',       href: '/playbook',                   label: 'Closed'     },
    { key: 'live',      href: '/playbook?filter=live',       label: 'Live'       },
    { key: 'winner',    href: '/playbook?filter=winners',    label: 'Winners'    },
    { key: 'loser',     href: '/playbook?filter=losers',     label: 'Losers'     },
    { key: 'breakeven', href: '/playbook?filter=breakevens', label: 'Breakevens' },
    { key: 'charts',    href: '/playbook?filter=charts',     label: 'Charts'     },
  ];

  return (
    <div className="min-h-screen bg-[#040507] text-zinc-100">
      <GridOverlay />
      <AppNav />

      <main className="max-w-[1200px] mx-auto px-6 py-10 relative">

        <div className="mb-7">
          <h1 className="text-[20px] font-extrabold tracking-tight mb-1">Playbook</h1>
          <p className="text-[12px] text-zinc-500">
            Every trade — closed and live. Stats computed from realized outcomes only.
          </p>
        </div>

        {/* Stats strip — realized outcomes only */}
        {!loading && stats.closedCount > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-7">
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

        {/* Filter tabs */}
        <div className="flex items-center gap-1 mb-7 border-b border-white/[0.06]">
          {TABS.map(t => (
            <Link
              key={t.key}
              href={t.href}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2.5 text-[12px] font-semibold tracking-tight border-b-2 transition-all -mb-px',
                filter === t.key
                  ? t.key === 'live'
                    ? 'border-amber-400 text-zinc-100'
                    : 'border-[#22D3EE] text-zinc-100'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300',
              )}
            >
              {t.key === 'live' && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              )}
              {t.label}
              <span className={cn(
                'font-mono text-[10px] px-1.5 py-0.5 rounded',
                filter === t.key
                  ? t.key === 'live'
                    ? 'bg-amber-400/20 text-amber-400'
                    : 'bg-[#22D3EE]/20 text-[#22D3EE]'
                  : 'bg-white/[0.06] text-zinc-600',
              )}>
                {counts[t.key]}
              </span>
            </Link>
          ))}
        </div>

        {/* Content */}
        {loading && (
          <div className="flex items-center justify-center py-24 gap-3 text-zinc-500">
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
              trade.status === 'open'
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
  const color = positive ? 'text-[#10F088]' : 'text-[#FF3B5C]';
  return (
    <div className="p-4 rounded-[10px] border border-white/[0.06] bg-white/[0.025]">
      <div className="flex items-baseline justify-between mb-0.5">
        <div className="text-[9px] uppercase tracking-[0.18em] font-bold text-zinc-600">{label}</div>
        <div className="text-[9px] font-mono text-zinc-700">{sublabel}</div>
      </div>
      <div className={cn('font-mono text-[22px] font-extrabold', color)}>{value}</div>
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

  const borderColor =
    outcome === 'winner'    ? 'border-[#10F088]/25'  :
    outcome === 'loser'     ? 'border-[#FF3B5C]/25'  :
    outcome === 'breakeven' ? 'border-amber-400/25'   : 'border-white/[0.06]';

  const accentBg =
    outcome === 'winner'    ? 'bg-[#10F088]/[0.04]'  :
    outcome === 'loser'     ? 'bg-[#FF3B5C]/[0.04]'  :
    outcome === 'breakeven' ? 'bg-amber-400/[0.04]'   : 'bg-white/[0.025]';

  const accentText =
    outcome === 'winner'    ? 'text-[#10F088]'  :
    outcome === 'loser'     ? 'text-[#FF3B5C]'  :
    outcome === 'breakeven' ? 'text-amber-400'   : 'text-zinc-400';

  return (
    <div className={cn('rounded-[12px] border p-4 flex flex-col gap-3', borderColor, accentBg)}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-mono text-[18px] font-extrabold tracking-tight">{trade.ticker}</span>
            {trade.setup_type && (
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/[0.06] text-zinc-500">
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
          <div className="text-[10px] font-mono text-zinc-600">
            {entryDate}{exitDate ? ` → ${exitDate}` : ''}
          </div>
        </div>

        <div className={cn(
          'flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider px-2 py-1 rounded-[6px] flex-shrink-0',
          outcome === 'winner'    ? 'bg-[#10F088]/15 text-[#10F088]'  :
          outcome === 'loser'     ? 'bg-[#FF3B5C]/15 text-[#FF3B5C]'  :
          outcome === 'breakeven' ? 'bg-amber-400/15 text-amber-400'   : 'bg-white/[0.06] text-zinc-400',
        )}>
          {outcome === 'winner' && <Check className="w-2.5 h-2.5" strokeWidth={3} />}
          {outcome === 'loser'  && <X     className="w-2.5 h-2.5" strokeWidth={3} />}
          {outcome === 'winner' ? 'Win' : outcome === 'loser' ? 'Loss' : 'Even'}
        </div>
      </div>

      {/* Price grid */}
      <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
        <div>
          <div className="text-zinc-600 mb-0.5">Entry</div>
          <div className="text-[#22D3EE] font-semibold">${trade.phase1_price.toFixed(2)}</div>
        </div>
        {trade.exit_price !== null && (
          <div>
            <div className="text-zinc-600 mb-0.5">Exit</div>
            <div className={cn('font-semibold', pnlPositive ? 'text-[#10F088]' : 'text-[#FF3B5C]')}>
              ${trade.exit_price.toFixed(2)}
            </div>
          </div>
        )}
        <div>
          <div className="text-zinc-600 mb-0.5">Stop</div>
          <div className="text-zinc-400 font-semibold">${trade.initial_stop.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-zinc-600 mb-0.5">Shares</div>
          <div className="text-zinc-400 font-semibold">{trade.phase1_shares}</div>
        </div>
      </div>

      {/* PnL strip */}
      {(trade.pnl_dollars !== null || trade.r_multiple !== null) && (
        <div className={cn(
          'flex items-center justify-between px-3 py-2 rounded-[8px] border',
          pnlPositive
            ? 'bg-[#10F088]/[0.06] border-[#10F088]/20'
            : 'bg-[#FF3B5C]/[0.06] border-[#FF3B5C]/20',
        )}>
          <div className="flex items-center gap-1.5">
            {pnlPositive
              ? <TrendingUp   className="w-3 h-3 text-[#10F088]" />
              : <TrendingDown className="w-3 h-3 text-[#FF3B5C]" />}
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
          trade.trend_template_passed ? 'bg-[#10F088]/25' : 'bg-[#FF3B5C]/20',
        )}>
          {trade.trend_template_passed
            ? <Check className="w-2.5 h-2.5 text-[#10F088]" strokeWidth={4} />
            : <X     className="w-2.5 h-2.5 text-[#FF3B5C]" strokeWidth={4} />}
        </span>
        <span className="text-[10px] text-zinc-500">Trend Template</span>
      </div>

      {/* Partial exits mini-list (sell trims only) */}
      {sells.length > 0 && (
        <div className="flex flex-col gap-1 border-t border-white/[0.05] pt-2.5">
          {sells.map((p, i) => (
            <div key={p.id} className="flex items-center justify-between text-[10px] font-mono text-zinc-600">
              <span>Exit {i + 1} · {p.shares} sh @ ${p.price.toFixed(2)}</span>
              <span className={p.pnl_dollars >= 0 ? 'text-[#10F088]' : 'text-[#FF3B5C]'}>
                {p.pnl_dollars >= 0 ? '+' : ''}${p.pnl_dollars.toFixed(0)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Notes */}
      {trade.notes && (
        <p className="text-[11px] text-zinc-500 leading-relaxed line-clamp-2 border-t border-white/[0.06] pt-2.5">
          {trade.notes}
        </p>
      )}
    </div>
  );
}

// ── LiveTradeCard ──────────────────────────────────────────────────────────────

function LiveTradeCard({ trade }: { trade: Trade }) {
  const sells          = getSells(trade);
  const buys           = getBuys(trade);
  const bookedPnL      = sells.reduce((s, p) => s + p.pnl_dollars, 0);
  const bookedPositive = bookedPnL >= 0;
  const sharesRemaining = trade.phase1_shares
    + buys.reduce((s, p)  => s + p.shares, 0)
    - sells.reduce((s, p) => s + p.shares, 0);
  const daysIn = Math.floor((Date.now() - new Date(trade.phase1_date).getTime()) / 86_400_000);

  return (
    <div className="rounded-[12px] border border-amber-400/20 bg-amber-400/[0.03] p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-mono text-[18px] font-extrabold tracking-tight">{trade.ticker}</span>
            {trade.setup_type && (
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/[0.06] text-zinc-500">
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
          <div className="text-[10px] font-mono text-zinc-600">{formatDate(trade.phase1_date)} · {daysIn}d in trade</div>
        </div>

        <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-[6px] bg-amber-400/15 text-amber-400 flex-shrink-0">
          <Zap className="w-2.5 h-2.5" />
          Live
        </div>
      </div>

      {/* Entry details */}
      <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
        <div>
          <div className="text-zinc-600 mb-0.5">Entry</div>
          <div className="text-[#22D3EE] font-semibold">${trade.phase1_price.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-zinc-600 mb-0.5">Stop</div>
          <div className="text-[#FF3B5C] font-semibold">${trade.initial_stop.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-zinc-600 mb-0.5">Shares left</div>
          <div className="text-zinc-300 font-semibold">{sharesRemaining}</div>
        </div>
        <div>
          <div className="text-zinc-600 mb-0.5">Risk $</div>
          <div className="text-zinc-400 font-semibold">${trade.risk_dollars.toFixed(0)}</div>
        </div>
      </div>

      {/* Booked partials PnL */}
      {bookedPnL !== 0 && (
        <div className={cn(
          'flex items-center justify-between px-3 py-2 rounded-[8px] border',
          bookedPositive
            ? 'bg-[#10F088]/[0.06] border-[#10F088]/20'
            : 'bg-[#FF3B5C]/[0.06] border-[#FF3B5C]/20',
        )}>
          <span className="text-[9px] uppercase tracking-wider font-bold text-zinc-600">Booked so far</span>
          <span className={cn('font-mono text-[13px] font-extrabold', bookedPositive ? 'text-[#10F088]' : 'text-[#FF3B5C]')}>
            {bookedPositive ? '+' : ''}${bookedPnL.toFixed(0)}
          </span>
        </div>
      )}

      {/* Trend Template */}
      <div className="flex items-center gap-1.5">
        <span className={cn(
          'w-3.5 h-3.5 rounded-sm flex items-center justify-center flex-shrink-0',
          trade.trend_template_passed ? 'bg-[#10F088]/25' : 'bg-[#FF3B5C]/20',
        )}>
          {trade.trend_template_passed
            ? <Check className="w-2.5 h-2.5 text-[#10F088]" strokeWidth={4} />
            : <X     className="w-2.5 h-2.5 text-[#FF3B5C]" strokeWidth={4} />}
        </span>
        <span className="text-[10px] text-zinc-500">Trend Template</span>
      </div>

      <Link
        href="/journal"
        className="text-center py-1.5 rounded-[8px] border border-amber-400/20 text-[10px] font-bold uppercase tracking-wider text-amber-400 hover:bg-amber-400/[0.06] transition-colors"
      >
        Manage in Journal →
      </Link>
    </div>
  );
}

// ── EmptyState ─────────────────────────────────────────────────────────────────

// ── ChartCard ──────────────────────────────────────────────────────────────────

function ChartCard({ trade }: { trade: Trade }) {
  const outcome = trade.outcome;
  const borderColor =
    outcome === 'winner'    ? 'border-[#10F088]/25'  :
    outcome === 'loser'     ? 'border-[#FF3B5C]/25'  :
    outcome === 'breakeven' ? 'border-amber-400/25'   : 'border-white/[0.08]';
  const outcomeText =
    outcome === 'winner'    ? 'text-[#10F088]'  :
    outcome === 'loser'     ? 'text-[#FF3B5C]'  :
    outcome === 'breakeven' ? 'text-amber-400'   : 'text-zinc-500';

  return (
    <div className={cn('rounded-[12px] border overflow-hidden bg-white/[0.02]', borderColor)}>
      <div className="relative" style={{ aspectRatio: '16/7' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={trade.screenshot_url!} alt={`${trade.ticker} chart`} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute bottom-2 left-3 right-3 flex items-end justify-between">
          <span className="font-mono text-[15px] font-extrabold tracking-tight">{trade.ticker}</span>
          {trade.pnl_pct !== null && (
            <span className={cn('font-mono text-[12px] font-bold', trade.pnl_pct >= 0 ? 'text-[#10F088]' : 'text-[#FF3B5C]')}>
              {trade.pnl_pct >= 0 ? '+' : ''}{trade.pnl_pct.toFixed(2)}%
            </span>
          )}
        </div>
      </div>
      <div className="px-3 py-2 flex items-center gap-2 text-[10px] font-mono text-zinc-500">
        <span>{formatDate(trade.phase1_date)}</span>
        {trade.setup_type && <span className="px-1.5 py-0.5 rounded bg-white/[0.06] text-zinc-400">{trade.setup_type}</span>}
        <span className={cn('ml-auto font-bold uppercase', outcomeText)}>
          {outcome ?? (trade.status === 'open' ? 'open' : '—')}
        </span>
      </div>
    </div>
  );
}

function EmptyState({ filter }: { filter: TabFilter }) {
  const messages: Record<TabFilter, { title: string; body: string }> = {
    all:       { title: 'No closed trades yet',   body: 'Close a trade in the Journal and it will appear here.' },
    live:      { title: 'No open positions',      body: 'Log a trade in the Journal to see it here.' },
    winner:    { title: 'No winners yet',         body: 'Keep executing your system. They\'ll come.' },
    loser:     { title: 'No losses logged',       body: 'Good — but closed losers will show here.' },
    breakeven: { title: 'No breakevens logged',   body: 'Breakeven trades will appear here.' },
    charts:    { title: 'No chart screenshots yet', body: 'Upload a chart screenshot when logging a trade to see it here.' },
  };
  const { title, body } = messages[filter];

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="text-[13px] font-semibold text-zinc-500 mb-2">{title}</div>
      <p className="text-[12px] text-zinc-700 mb-5">{body}</p>
      <Link
        href="/journal"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-br from-[#22D3EE] to-[#10F088] text-black font-bold text-[12px] uppercase tracking-[0.08em] hover:brightness-110 transition"
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
    <Suspense fallback={<div className="min-h-screen bg-[#040507]" />}>
      <PlaybookInner />
    </Suspense>
  );
}
