// app/journal/page.tsx

'use client';

import { createPortal } from 'react-dom';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownLeft, ArrowUpRight, Check, ChevronRight, ClipboardCheck,
  Layers, Loader2, Plus, Search, Trash2, TrendingDown, TrendingUp, UploadCloud, X,
} from 'lucide-react';
import { AppNav } from '@/components/nav/app-nav';
import { GridOverlay } from '@/components/ui/grid-overlay';
import { AddTradeModal } from '@/components/journal/add-trade-modal';
import { ImportExcelModal } from '@/components/journal/import-excel-modal';
import { ReviewSetupModal } from '@/components/journal/review-setup-modal';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { useAuth } from '@/lib/auth-context';
import {
  supabase,
  type PartialExit,
  type Trade,
  type TradeOutcome,
  type TradeStatus,
} from '@/lib/supabase-client';
type SystemFilter = 'all' | 'system' | 'partial' | 'non_system' | 'unreviewed';
import { getPartials, getSells, getBuys, computeAvgEntry, computeTotalInvested, getCurrentShares } from '@/lib/trade-utils';
import { computeWinRate } from '@/lib/stats/win-rate';
import { useLivePrices } from '@/lib/use-live-prices';
import { StopAlertBanner } from '@/components/stop-alert-banner';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import Link from 'next/link';

type StatusFilter  = 'all' | TradeStatus;
type OutcomeFilter = 'all' | 'winner' | 'loser' | 'breakeven';
type ScaleTab      = 'sell' | 'buy';


// ── Main page ─────────────────────────────────────────────────────────────────

export default function JournalPage() {
  const { user, profile } = useAuth();

  const [trades,        setTrades]        = useState<Trade[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [fetchError,    setFetchError]    = useState<string | null>(null);
  const [slowLoad,      setSlowLoad]      = useState(false);
  const [statusFilter,  setStatusFilter]  = useState<StatusFilter>('all');
  const [tickerSearch,  setTickerSearch]  = useState('');
  const [dateFrom,      setDateFrom]      = useState('');
  const [dateTo,        setDateTo]        = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>('all');
  const [selectedTrade,  setSelectedTrade]  = useState<Trade | null>(null);
  const [showAddModal,     setShowAddModal]     = useState(false);
  const [showImport,       setShowImport]       = useState(false);
  const [deleteConfirmId,  setDeleteConfirmId]  = useState<string | null>(null);
  const [systemFilter,     setSystemFilter]     = useState<SystemFilter>('all');
  const [reviewTarget,     setReviewTarget]     = useState<Trade | null>(null);

  useEffect(() => {
    if (!loading) { setSlowLoad(false); return; }
    const t = setTimeout(() => setSlowLoad(true), 8_000);
    return () => clearTimeout(t);
  }, [loading]);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchTrades = useCallback(async (attempt = 0) => {
    if (attempt === 0) { setLoading(true); setFetchError(null); }
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
      setFetchError(isTimeout ? 'Request timed out — check your connection.' : ((err as Error).message || 'Failed to load trades.'));
    } finally {
      clearTimeout(tid);
      if (ok || attempt > 0) setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchTrades(); }, [fetchTrades]);

  // ── Derived state ──────────────────────────────────────────────────────────

  const counts = useMemo(() => ({
    all:         trades.length,
    open:        trades.filter(t => t.status === 'open').length,
    closed:      trades.filter(t => t.status === 'closed').length,
    stopped_out: trades.filter(t => t.status === 'stopped_out').length,
  }), [trades]);

  const filteredTrades = useMemo(() => {
    let result = statusFilter === 'all' ? trades : trades.filter(t => t.status === statusFilter);
    if (tickerSearch.trim()) {
      const q = tickerSearch.trim().toUpperCase();
      result = result.filter(t => t.ticker.includes(q));
    }
    if (dateFrom) result = result.filter(t => t.phase1_date >= dateFrom);
    if (dateTo)   result = result.filter(t => t.phase1_date <= dateTo);
    if (outcomeFilter !== 'all') result = result.filter(t => t.outcome === outcomeFilter);
    if (systemFilter === 'unreviewed') result = result.filter(t => t.system_status === null);
    else if (systemFilter !== 'all')   result = result.filter(t => t.system_status === systemFilter);
    return result;
  }, [trades, statusFilter, tickerSearch, dateFrom, dateTo, outcomeFilter, systemFilter]);

  const stats = useMemo(() => {
    const wr = computeWinRate(trades);
    return {
      total:   trades.length,
      winRate: wr.winRate,
      avgR:    wr.avgR,
      open:    counts.open,
      totalPnL: wr.totalPnL,
    };
  }, [trades, counts.open]);

  const setupBreakdown = useMemo(() => {
    const closed = trades.filter(t =>
      (t.status === 'closed' || t.status === 'stopped_out') && t.setup_type,
    );
    if (closed.length === 0) return [];

    const groups = new Map<string, { count: number; wins: number; totalPnL: number; totalR: number }>();
    for (const t of closed) {
      const key = t.setup_type!;
      const g = groups.get(key) ?? { count: 0, wins: 0, totalPnL: 0, totalR: 0 };
      g.count++;
      if (t.outcome === 'winner') g.wins++;
      g.totalPnL += t.pnl_dollars ?? 0;
      g.totalR   += t.r_multiple ?? 0;
      groups.set(key, g);
    }

    return Array.from(groups.entries())
      .map(([setup, g]) => ({
        setup,
        count:    g.count,
        winRate:  g.count > 0 ? (g.wins / g.count) * 100 : 0,
        totalPnL: g.totalPnL,
        avgR:     g.count > 0 ? g.totalR / g.count : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }, [trades]);

  // ── Stop-loss live prices ──────────────────────────────────────────────────

  const openTrades  = useMemo(() => trades.filter(t => t.status === 'open'), [trades]);
  const openTickers = useMemo(() => openTrades.map(t => t.ticker), [openTrades]);
  const { prices: livePrices } = useLivePrices(openTickers);

  // ── Callbacks ──────────────────────────────────────────────────────────────

  const handleTradeUpdated = (updated: Trade) => {
    setTrades(prev => prev.map(t => t.id === updated.id ? updated : t));
    setSelectedTrade(null);
  };

  const handlePartialLogged = (updated: Trade) => {
    setTrades(prev => prev.map(t => t.id === updated.id ? updated : t));
    setSelectedTrade(updated);
  };

  const handleTradeAdded = (trade: Trade) => {
    setTrades(prev => [trade, ...prev]);
    setShowAddModal(false);
    toast({ title: 'Trade added', body: `${trade.ticker} logged successfully`, variant: 'success' });
  };

  const handleDeleteTrade = useCallback((id: string) => {
    setDeleteConfirmId(id);
  }, []);

  const performDelete = useCallback(async () => {
    if (!deleteConfirmId) return;
    const id = deleteConfirmId;
    setDeleteConfirmId(null);
    const { error } = await supabase.from('trades').delete().eq('id', id);
    if (error) {
      toast({ title: 'Delete failed', body: error.message, variant: 'error' });
      return;
    }
    setTrades(prev => prev.filter(t => t.id !== id));
    setSelectedTrade(null);
  }, [deleteConfirmId]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <GridOverlay />
      <AppNav />

      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 py-10 relative">

        {/* Stop-loss alerts */}
        <StopAlertBanner openTrades={openTrades} livePrices={livePrices} />

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-7">
          <div>
            <h1 className="text-[20px] font-extrabold tracking-tight mb-1">Trade Journal</h1>
            <p className="text-xs text-[var(--text-muted)]">Every trade logged. Every lesson earned.</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => setShowImport(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-[10px] border border-[#10F088]/40 bg-[#10F088]/[0.08] text-[#10F088] text-xs font-extrabold uppercase tracking-wider hover:bg-[#10F088]/[0.14] hover:-translate-y-px transition-all"
              style={{ boxShadow: 'var(--shadow-card)' }}
            >
              <UploadCloud className="w-3.5 h-3.5" strokeWidth={2.5} />
              Import from Broker
            </button>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-[10px] bg-[var(--text-primary)] text-[var(--bg-primary)] text-xs font-extrabold uppercase tracking-wider hover:opacity-90 hover:-translate-y-px transition-all"
              style={{ boxShadow: 'var(--shadow-card)' }}
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={3} />
              New Trade
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-7">
          <StatCard label="Total Trades" value={stats.total > 0 ? String(stats.total) : '—'} accent="cyan" />
          <StatCard label="Open" value={stats.open > 0 ? String(stats.open) : '—'} accent="amber" />
          <StatCard
            label="Win Rate"
            value={stats.winRate !== null ? `${stats.winRate.toFixed(1)}%` : '—'}
            accent={stats.winRate !== null && stats.winRate >= 50 ? 'green' : 'red'}
          />
          <StatCard
            label="Avg R"
            value={stats.avgR !== null ? `${stats.avgR >= 0 ? '+' : ''}${stats.avgR.toFixed(2)}R` : '—'}
            accent={stats.avgR !== null && stats.avgR >= 0 ? 'green' : 'red'}
          />
        </div>

        {/* P&L by Setup Type */}
        <SetupBreakdown groups={setupBreakdown} />

        {/* Segmented control filter tabs */}
        <div className="overflow-x-auto mb-5">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--tab-strip-bg)] w-fit min-w-max">
          {([
            { key: 'all',         label: 'All'         },
            { key: 'open',        label: 'Open'        },
            { key: 'closed',      label: 'Closed'      },
            { key: 'stopped_out', label: 'Stopped out' },
          ] as { key: StatusFilter; label: string }[]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap',
                statusFilter === key
                  ? 'bg-[var(--tab-active-bg)] text-[var(--text-primary)] shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]',
              )}
            >
              {label}
              <span className={cn(
                'font-mono text-xs px-1.5 py-0.5 rounded-full tabular-nums',
                statusFilter === key
                  ? key === 'open' ? 'bg-amber-400/20 text-amber-600'
                    : 'bg-slate-400/20 text-slate-500'
                  : 'bg-[var(--bg-elevated)] text-[var(--text-faint)]',
              )}>
                {counts[key]}
              </span>
            </button>
          ))}
        </div>
        </div>

        {/* Search & Filter */}
        <div className="flex flex-wrap gap-2 mb-5">
          {/* Ticker search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-faint)]" />
            <input
              value={tickerSearch}
              onChange={e => setTickerSearch(e.target.value.toUpperCase().replace(/[^A-Z.]/g, ''))}
              placeholder="Search ticker…"
              className="w-36 bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-[8px] pl-8 pr-3 py-2 text-[16px] sm:text-xs font-mono font-bold text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[#22D3EE] focus:ring-[2px] focus:ring-[#22D3EE]/15 transition"
            />
          </div>

          {/* Date from */}
          <input
            type="date"
            value={dateFrom}
            max={todayIso()}
            onChange={e => { const v = e.target.value; if (!v || v <= todayIso()) setDateFrom(v); }}
            title="From date"
            className="bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-[8px] px-3 py-2 text-[16px] sm:text-xs text-[var(--text-muted)] focus:outline-none focus:border-[#22D3EE] focus:ring-[2px] focus:ring-[#22D3EE]/15 transition [color-scheme:dark]"
          />
          <span className="self-center text-[var(--text-faint)] text-xs">→</span>
          {/* Date to */}
          <input
            type="date"
            value={dateTo}
            min={dateFrom || undefined}
            max={todayIso()}
            onChange={e => { const v = e.target.value; if (!v || v <= todayIso()) setDateTo(v); }}
            title="To date"
            className="bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-[8px] px-3 py-2 text-[16px] sm:text-xs text-[var(--text-muted)] focus:outline-none focus:border-[#22D3EE] focus:ring-[2px] focus:ring-[#22D3EE]/15 transition [color-scheme:dark]"
          />

          {/* Outcome filter */}
          <div className="flex items-center gap-1 p-0.5 rounded-[8px] bg-[var(--tab-strip-bg)] border border-[var(--border-subtle)]">
            {(['all', 'winner', 'loser', 'breakeven'] as OutcomeFilter[]).map(opt => (
              <button
                key={opt}
                onClick={() => setOutcomeFilter(opt)}
                className={cn(
                  'px-2.5 py-1.5 rounded-[6px] text-xs font-semibold capitalize transition-all',
                  outcomeFilter === opt
                    ? opt === 'winner'    ? 'bg-[#10F088]/15 text-[#10F088]'
                    : opt === 'loser'     ? 'bg-[#FF3B5C]/15 text-[#FF3B5C]'
                    : opt === 'breakeven' ? 'bg-amber-400/15 text-amber-400'
                    : 'bg-[var(--tab-active-bg)] text-[var(--text-primary)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]',
                )}
              >
                {opt === 'all' ? 'All outcomes' : opt}
              </button>
            ))}
          </div>

          {/* System / Non-System filter */}
          <div className="flex items-center gap-1 p-0.5 rounded-[8px] bg-[var(--tab-strip-bg)] border border-[var(--border-subtle)]">
            {([
              { key: 'all',        label: 'All setups'  },
              { key: 'system',     label: '✅ System'    },
              { key: 'partial',    label: '🟡 Partial'   },
              { key: 'non_system', label: '❌ Non-System' },
              { key: 'unreviewed', label: '— Unreviewed' },
            ] as { key: SystemFilter; label: string }[]).map(opt => (
              <button
                key={opt.key}
                onClick={() => setSystemFilter(opt.key)}
                className={cn(
                  'px-2.5 py-1.5 rounded-[6px] text-xs font-semibold transition-all whitespace-nowrap',
                  systemFilter === opt.key
                    ? 'bg-[var(--tab-active-bg)] text-[var(--text-primary)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Clear filters */}
          {(tickerSearch || dateFrom || dateTo || outcomeFilter !== 'all' || statusFilter !== 'all' || systemFilter !== 'all') && (
            <button
              onClick={() => { setTickerSearch(''); setDateFrom(''); setDateTo(''); setOutcomeFilter('all'); setStatusFilter('all'); setSystemFilter('all'); }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-[8px] border border-[var(--border-subtle)] text-xs text-[var(--text-faint)] hover:text-[#FF3B5C] hover:border-[#FF3B5C]/30 transition-all"
            >
              <X className="w-3 h-3" />
              Clear
            </button>
          )}
        </div>

        {/* Body */}
        {loading && <LoadingState slow={slowLoad} />}
        {!loading && fetchError && <ErrorState message={fetchError} onRetry={fetchTrades} />}
        {!loading && !fetchError && filteredTrades.length === 0 && trades.length === 0 && (
          <EmptyState filter="all" onAdd={() => setShowAddModal(true)} />
        )}
        {!loading && !fetchError && filteredTrades.length === 0 && trades.length > 0 && (
          <EmptyState filter="filtered" onAdd={() => { setTickerSearch(''); setDateFrom(''); setDateTo(''); setOutcomeFilter('all'); setStatusFilter('all'); }} />
        )}
        {!loading && !fetchError && filteredTrades.length > 0 && (
          <div className="overflow-x-auto">
            <TradeTable
              trades={filteredTrades}
              onRowClick={setSelectedTrade}
              onDelete={id => void handleDeleteTrade(id)}
              onReview={t => setReviewTarget(t)}
            />
          </div>
        )}
      </main>

      {selectedTrade && (
        <EditModal
          key={selectedTrade.id}
          trade={selectedTrade}
          onClose={() => setSelectedTrade(null)}
          onSaved={handleTradeUpdated}
          onPartialLogged={handlePartialLogged}
          onDelete={() => void handleDeleteTrade(selectedTrade.id)}
        />
      )}

      {showAddModal && user && (
        <AddTradeModal
          userId={user.id}
          portfolioSize={profile?.account_size ?? 100_000}
          onClose={() => setShowAddModal(false)}
          onSaved={handleTradeAdded}
        />
      )}

      {showImport && user && (
        <ImportExcelModal
          userId={user.id}
          onClose={() => setShowImport(false)}
          onImported={() => { setShowImport(false); void fetchTrades(); }}
        />
      )}

      {deleteConfirmId && (
        <ConfirmModal
          title="Delete trade"
          message="This action cannot be undone."
          confirmLabel="Delete"
          onConfirm={() => void performDelete()}
          onCancel={() => setDeleteConfirmId(null)}
        />
      )}

      {reviewTarget && (
        <ReviewSetupModal
          trade={reviewTarget}
          onClose={() => setReviewTarget(null)}
          onSaved={updated => {
            setTrades(prev => prev.map(t => t.id === updated.id ? updated : t));
            setReviewTarget(null);
          }}
        />
      )}
    </div>
  );
}

// ── TradeTable ─────────────────────────────────────────────────────────────────

function TradeTable({
  trades, onRowClick, onDelete, onReview,
}: {
  trades: Trade[];
  onRowClick: (t: Trade) => void;
  onDelete: (id: string) => void;
  onReview: (t: Trade) => void;
}) {
  return (
    <div className="rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
      <div className="grid grid-cols-[5rem_1fr_5rem_5rem_4rem_4.5rem_5.5rem_5rem_6.5rem] gap-x-3 px-4 py-2.5 border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)]">
        {['Date', 'Ticker', 'Avg Entry', 'Stop', 'Shares', 'Template', 'Status', 'PnL%', 'PnL$'].map(h => (
          <span key={h} className="text-[9px] uppercase tracking-[0.18em] font-bold text-[var(--text-faint)]">{h}</span>
        ))}
      </div>
      <div className="divide-y divide-[var(--divider)]">
        {trades.map(t => (
          <TradeRow key={t.id} trade={t} onClick={() => onRowClick(t)} onDelete={() => onDelete(t.id)} onReview={() => onReview(t)} />
        ))}
      </div>
    </div>
  );
}

// ── TradeRow ───────────────────────────────────────────────────────────────────

function TradeRow({ trade, onClick, onDelete, onReview }: { trade: Trade; onClick: () => void; onDelete: () => void; onReview: () => void }) {
  const pnlPositive = trade.pnl_pct !== null && trade.pnl_pct >= 0;
  const sells       = getSells(trade);
  const buys        = getBuys(trade);
  const avgEntry    = computeAvgEntry(trade);
  const hasScaleIn  = buys.length > 0;

  return (
    <div
      onClick={onClick}
      className="relative w-full grid grid-cols-[5rem_1fr_5rem_5rem_4rem_4.5rem_5.5rem_5rem_6.5rem] gap-x-3 px-4 py-3.5 items-center text-left hover:bg-[var(--bg-elevated)] transition-colors group cursor-pointer"
    >
      <span className="absolute left-0 top-2 bottom-2 w-[2px] rounded-r-full bg-gradient-to-b from-[#22D3EE] to-[#10F088] opacity-0 group-hover:opacity-100 transition-opacity" />

      <span className="text-xs font-mono text-[var(--text-muted)] whitespace-nowrap">
        {formatDate(trade.phase1_date)}
      </span>

      <div className="flex items-center gap-1.5 min-w-[64px] flex-wrap">
        {trade.screenshot_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={trade.screenshot_url} alt={`${trade.ticker} chart`} className="w-8 h-5 rounded object-cover flex-shrink-0 opacity-60 border border-[var(--border-subtle)]" />
        )}
        <span className="font-mono text-[15px] font-extrabold tracking-tight truncate">{trade.ticker}</span>
        {trade.setup_type && (
          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-muted)] flex-shrink-0">
            {trade.setup_type}
          </span>
        )}
        {trade.system_status === 'system'     && <span className="text-[9px] flex-shrink-0" title="System Trade">✅</span>}
        {trade.system_status === 'partial'    && <span className="text-[9px] flex-shrink-0" title="Partial System">🟡</span>}
        {trade.system_status === 'non_system' && <span className="text-[9px] flex-shrink-0" title="Non-System">❌</span>}
        {sells.length > 0 && (
          <span className="flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#A78BFA]/10 text-[#A78BFA] flex-shrink-0">
            <ArrowDownLeft className="w-2.5 h-2.5" />
            {sells.length}T
          </span>
        )}
        {hasScaleIn && (
          <span className="flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#22D3EE]/10 text-[#22D3EE] flex-shrink-0">
            <ArrowUpRight className="w-2.5 h-2.5" />
            {buys.length}A
          </span>
        )}
      </div>

      {/* Avg entry — cyan if scaled in, normal otherwise */}
      <span className={cn('font-mono text-xs whitespace-nowrap', hasScaleIn ? 'text-[#22D3EE]' : 'text-[var(--text-dim)]')}>
        ${avgEntry.toFixed(2)}
      </span>
      <span className="font-mono text-xs text-[#FF3B5C] whitespace-nowrap">
        ${trade.initial_stop.toFixed(2)}
      </span>
      <span className="font-mono text-xs text-[var(--text-secondary)] whitespace-nowrap">
        {getCurrentShares(trade)}
      </span>

      <span className={cn('text-xs font-bold whitespace-nowrap', trade.trend_template_passed ? 'text-[#10F088]' : 'text-[var(--text-faint)]')}>
        {trade.trend_template_passed ? '✓ Pass' : '✗ Fail'}
      </span>

      <StatusBadge status={trade.status} />

      <span className={cn(
        'font-mono text-xs font-bold whitespace-nowrap tabular-nums',
        trade.pnl_pct === null  && 'text-[var(--text-faint)]',
        trade.pnl_pct !== null  && pnlPositive  && 'text-emerald-400',
        trade.pnl_pct !== null  && !pnlPositive && 'text-red-400',
      )}>
        {trade.pnl_pct === null ? '—' : `${pnlPositive ? '+' : ''}${trade.pnl_pct.toFixed(2)}%`}
      </span>

      <div className="flex items-center gap-1.5">
        <span className={cn(
          'font-mono text-xs font-bold whitespace-nowrap tabular-nums flex-1 min-w-0',
          trade.pnl_dollars === null  && 'text-[var(--text-faint)]',
          trade.pnl_dollars !== null  && pnlPositive  && 'text-emerald-400',
          trade.pnl_dollars !== null  && !pnlPositive && 'text-red-400',
        )}>
          {trade.pnl_dollars === null ? '—' : `${pnlPositive ? '+' : ''}$${Math.abs(trade.pnl_dollars).toFixed(0)}`}
        </span>
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onReview(); }}
          className="opacity-0 group-hover:opacity-100 flex-shrink-0 w-5 h-5 flex items-center justify-center rounded text-[var(--text-faint)] hover:text-[#22D3EE] hover:bg-[#22D3EE]/10 transition-all"
          aria-label="Review setup"
          title="Review Setup"
        >
          <ClipboardCheck className="w-3 h-3" />
        </button>
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onDelete(); }}
          className="opacity-0 group-hover:opacity-100 flex-shrink-0 w-5 h-5 flex items-center justify-center rounded text-[var(--text-faint)] hover:text-[#FF3B5C] hover:bg-[#FF3B5C]/10 transition-all"
          aria-label="Delete trade"
        >
          <Trash2 className="w-3 h-3" />
        </button>
        <ChevronRight className="w-3 h-3 text-[var(--text-faint)] group-hover:text-[#22D3EE] transition-colors flex-shrink-0" />
      </div>
    </div>
  );
}

// ── StatusBadge ────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: TradeStatus }) {
  const MAP: Record<TradeStatus, { label: string; cls: string }> = {
    open:        { label: 'Open',    cls: 'bg-[#22D3EE]/15 text-[#22D3EE] border border-[#22D3EE]/20' },
    closed:      { label: 'Closed', cls: 'bg-[#10F088]/15 text-[#10F088] border border-[#10F088]/20' },
    stopped_out: { label: 'Stopped',cls: 'bg-[#FF3B5C]/15 text-[#FF3B5C] border border-[#FF3B5C]/20' },
  };
  const { label, cls } = MAP[status];
  return (
    <span className={cn('text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded whitespace-nowrap', cls)}>
      {label}
    </span>
  );
}

// ── EditModal ──────────────────────────────────────────────────────────────────

function EditModal({
  trade, onClose, onSaved, onPartialLogged, onDelete,
}: {
  trade: Trade;
  onClose: () => void;
  onSaved: (updated: Trade) => void;
  onPartialLogged: (updated: Trade) => void;
  onDelete: () => void;
}) {
  const [mounted, setMounted] = useState(false);

  type AutoClosedInfo = { outcome: TradeOutcome; pnl: number; pct: number; r: number };
  const [autoClosed,    setAutoClosed]    = useState<AutoClosedInfo | null>(null);

  // Full-close fields
  const [exitPrice,     setExitPrice]     = useState(trade.exit_price?.toFixed(2) ?? '');
  const [status,        setStatus]        = useState<TradeStatus>(trade.status);
  const [outcome,       setOutcome]       = useState<TradeOutcome | ''>(trade.outcome ?? '');
  const [notes,         setNotes]         = useState(trade.notes ?? '');
  const [lessonLearned, setLessonLearned] = useState(trade.lesson_learned ?? '');
  const [saving,        setSaving]        = useState(false);

  // Scale panel: which tab is active
  const [scaleTab, setScaleTab] = useState<ScaleTab>('sell');

  // SELL (trim) fields
  const [sellDate,   setSellDate]   = useState(todayIso());
  const [sellShares, setSellShares] = useState('');
  const [sellPrice,  setSellPrice]  = useState('');
  const [savingSell, setSavingSell] = useState(false);

  // BUY (add) fields
  const [buyDate,   setBuyDate]   = useState(todayIso());
  const [buyAmount, setBuyAmount] = useState('');   // $ invested (auto-fills shares)
  const [buyShares, setBuyShares] = useState('');   // direct share count
  const [buyPrice,  setBuyPrice]  = useState('');
  const [savingBuy, setSavingBuy] = useState(false);

  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // ── Derived from fresh trade prop ─────────────────────────────────────────
  const partials      = getPartials(trade);
  const sells         = getSells(trade);
  const buys          = getBuys(trade);
  const currentShares = getCurrentShares(trade);
  const avgEntryPrice = computeAvgEntry(trade);
  const totalInvested = computeTotalInvested(trade);
  const realizedPnL   = sells.reduce((s, p) => s + p.pnl_dollars, 0);
  const riskPerShare  = Math.max(0, avgEntryPrice - trade.initial_stop);

  // ── SELL preview ──────────────────────────────────────────────────────────
  const sellCalc = useMemo(() => {
    const sh = parseInt(sellShares, 10);
    const pr = parseFloat(sellPrice);
    if (!Number.isFinite(sh) || sh < 1 || sh > currentShares) return null;
    if (!Number.isFinite(pr) || pr <= 0) return null;
    const pnl    = (pr - avgEntryPrice) * sh;
    const pnlPct = avgEntryPrice > 0 ? ((pr - avgEntryPrice) / avgEntryPrice) * 100 : 0;
    const rMult  = riskPerShare > 0 ? pnl / (riskPerShare * sh) : 0;
    return { sh, pr, pnl, pnlPct, rMult };
  }, [sellShares, sellPrice, currentShares, avgEntryPrice, riskPerShare]);

  // ── BUY preview ───────────────────────────────────────────────────────────
  const buyCalc = useMemo(() => {
    const pr = parseFloat(buyPrice);
    if (!Number.isFinite(pr) || pr <= 0) return null;
    const sh = parseInt(buyShares, 10);
    if (!Number.isFinite(sh) || sh < 1) return null;

    const newTotalShares = currentShares + sh;
    const newAvgEntry = (avgEntryPrice * currentShares + sh * pr) / newTotalShares;
    const newRiskDollars = Math.max(0, (newAvgEntry - trade.initial_stop) * newTotalShares);
    const totalCost = sh * pr;

    return { sh, pr, newTotalShares, newAvgEntry, newRiskDollars, totalCost };
  }, [buyShares, buyPrice, currentShares, avgEntryPrice, trade.initial_stop]);

  // Auto-fill buyShares when amount + price are both valid
  const handleBuyAmountChange = (v: string) => {
    setBuyAmount(v);
    const amt = parseFloat(v);
    const pr  = parseFloat(buyPrice);
    if (Number.isFinite(amt) && amt > 0 && Number.isFinite(pr) && pr > 0) {
      setBuyShares(String(Math.floor(amt / pr)));
    }
  };
  const handleBuyPriceChange = (v: string) => {
    setBuyPrice(v);
    const pr  = parseFloat(v);
    const amt = parseFloat(buyAmount);
    if (Number.isFinite(amt) && amt > 0 && Number.isFinite(pr) && pr > 0) {
      setBuyShares(String(Math.floor(amt / pr)));
    }
  };

  // ── Close preview (remaining shares + realized partials) ──────────────────
  const closeCalc = useMemo(() => {
    const ep = parseFloat(exitPrice);
    if (!Number.isFinite(ep) || ep <= 0 || currentShares <= 0) return null;
    const remainingPnl  = (ep - avgEntryPrice) * currentShares;
    const totalPnl      = realizedPnL + remainingPnl;
    const totalPct      = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;
    const totalR        = trade.risk_dollars > 0 ? totalPnl / trade.risk_dollars : 0;
    const autoOutcome: TradeOutcome = totalPnl > 0.005 ? 'winner' : totalPnl < -0.005 ? 'loser' : 'breakeven';
    return { totalPnl, totalPct, totalR, autoOutcome };
  }, [exitPrice, currentShares, realizedPnL, avgEntryPrice, totalInvested, trade.risk_dollars]);

  const effectiveOutcome: TradeOutcome | null =
    (outcome as string) !== '' ? (outcome as TradeOutcome) :
    closeCalc?.autoOutcome ?? null;

  // ── Handle SELL (trim) ────────────────────────────────────────────────────
  const handleSell = async () => {
    if (!sellCalc || savingSell) return;
    setSavingSell(true);

    try {
      const newPartial: PartialExit = {
        id:          crypto.randomUUID(),
        date:        new Date(sellDate + 'T12:00:00').toISOString(),
        shares:      sellCalc.sh,
        price:       sellCalc.pr,
        action:      'sell',
        pnl_dollars: sellCalc.pnl,
        pnl_pct:     sellCalc.pnlPct,
        r_multiple:  sellCalc.rMult,
      };

      const newPartials      = [...partials, newPartial];
      const newCurrentShares = Math.max(0, currentShares - sellCalc.sh);
      const isNowClosed      = newCurrentShares <= 0;

      const newRealizedPnL = sells.reduce((s, p) => s + p.pnl_dollars, 0) + sellCalc.pnl;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const patch: Record<string, any> = {
        partials:       newPartials,
        current_shares: newCurrentShares,
      };

      let autoOut: TradeOutcome = 'breakeven';
      if (isNowClosed) {
        const totalPnl = newRealizedPnL;
        const totalPct = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;
        const totalR   = trade.risk_dollars > 0 ? totalPnl / trade.risk_dollars : 0;
        autoOut = totalPnl > 0.005 ? 'winner' : totalPnl < -0.005 ? 'loser' : 'breakeven';
        patch.status      = 'closed';
        patch.exit_date   = new Date().toISOString();
        patch.exit_price  = sellCalc.pr;
        patch.pnl_dollars = totalPnl;
        patch.pnl_pct     = totalPct;
        patch.r_multiple  = totalR;
        patch.outcome     = autoOut;
      }

      console.log(`[TRIM] trade.id=${trade.id} currentShares=${currentShares} selling=${sellCalc.sh} newCurrentShares=${newCurrentShares} isNowClosed=${isNowClosed}`, isNowClosed ? `outcome=${autoOut}` : '');

      const { data: updateRows, error } = await supabase
        .from('trades')
        .update(patch)
        .eq('id', trade.id)
        .select('id, status, outcome');

      if (error) throw new Error(error.message);
      console.log(`[TRIM] DB update result:`, updateRows);

      if (isNowClosed && (!updateRows || updateRows.length === 0)) {
        throw new Error('Update matched 0 rows — trade ID mismatch or RLS blocked it.');
      }

      const updatedTrade: Trade = { ...trade, ...patch };

      toast({
        title:   `Trim logged · ${trade.ticker}`,
        body:    `${sellCalc.sh} sh @ $${sellCalc.pr.toFixed(2)} · ${sellCalc.pnl >= 0 ? '+' : ''}$${sellCalc.pnl.toFixed(0)} · ${sellCalc.rMult >= 0 ? '+' : ''}${sellCalc.rMult.toFixed(2)}R${newCurrentShares > 0 ? ` · ${newCurrentShares} sh left` : ''}`,
        variant: 'success',
        durationMs: 5000,
      });

      setSellDate(todayIso());
      setSellShares('');
      setSellPrice('');

      if (isNowClosed) {
        setAutoClosed({ outcome: autoOut, pnl: patch.pnl_dollars, pct: patch.pnl_pct, r: patch.r_multiple });
        setStatus('closed');
        setOutcome(autoOut);
        onPartialLogged(updatedTrade);
      } else {
        onPartialLogged(updatedTrade);
      }
    } catch (err) {
      toast({ title: 'Trim failed', body: err instanceof Error ? err.message : 'Unknown error', variant: 'error' });
    } finally {
      setSavingSell(false);
    }
  };

  // ── Handle BUY (scale-in) ─────────────────────────────────────────────────
  const handleBuy = async () => {
    if (!buyCalc || savingBuy) return;
    setSavingBuy(true);

    try {
      const newPartial: PartialExit = {
        id:          crypto.randomUUID(),
        date:        new Date(buyDate + 'T12:00:00').toISOString(),
        shares:      buyCalc.sh,
        price:       buyCalc.pr,
        action:      'buy',
        pnl_dollars: 0,
        pnl_pct:     0,
        r_multiple:  0,
      };

      const newPartials      = [...partials, newPartial];
      const newCurrentShares = currentShares + buyCalc.sh;

      const patch = {
        partials:       newPartials,
        current_shares: newCurrentShares,
        risk_dollars:   buyCalc.newRiskDollars,
      };

      const { error } = await supabase.from('trades').update(patch).eq('id', trade.id);
      if (error) throw new Error(error.message);

      const updatedTrade: Trade = { ...trade, ...patch };

      toast({
        title:   `Scale-in logged · ${trade.ticker}`,
        body:    `+${buyCalc.sh} sh @ $${buyCalc.pr.toFixed(2)} · new avg $${buyCalc.newAvgEntry.toFixed(2)} · ${newCurrentShares} sh total · risk $${buyCalc.newRiskDollars.toFixed(0)}`,
        variant: 'success',
        durationMs: 5000,
      });

      setBuyDate(todayIso());
      setBuyAmount('');
      setBuyShares('');
      setBuyPrice('');

      onPartialLogged(updatedTrade);
    } catch (err) {
      toast({ title: 'Scale-in failed', body: err instanceof Error ? err.message : 'Unknown error', variant: 'error' });
    } finally {
      setSavingBuy(false);
    }
  };

  // ── Save / close ──────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (saving) return;
    setSaving(true);

    try {
      // When there are no remaining shares (auto-closed by trims) the pnl/outcome
      // are already written to DB by handleSell — do NOT overwrite them with null.
      // Derive outcome from existing realizedPnL as a fallback if outcome state is ''.
      const alreadyAutoClosedByTrims = currentShares <= 0 && trade.status === 'closed';
      const fallbackOutcome: TradeOutcome | null = (() => {
        if ((outcome as string) !== '') return outcome as TradeOutcome;
        if (alreadyAutoClosedByTrims && trade.outcome) return trade.outcome;
        if ((status === 'closed' || status === 'stopped_out') && !closeCalc) {
          // No exit price entered — derive from realized partials PnL
          if (realizedPnL > 0.01) return 'winner';
          if (realizedPnL < -0.01) return 'loser';
          return 'breakeven';
        }
        return effectiveOutcome;
      })();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const patch: Record<string, any> = {
        status,
        outcome:        fallbackOutcome,
        notes:          notes.trim()         || null,
        lesson_learned: lessonLearned.trim() || null,
      };

      if (closeCalc) {
        const ep = parseFloat(exitPrice);
        const remainingPnl  = (ep - avgEntryPrice) * currentShares;
        const finalPartial: PartialExit = {
          id:          crypto.randomUUID(),
          date:        new Date().toISOString(),
          shares:      currentShares,
          price:       ep,
          action:      'sell',
          pnl_dollars: remainingPnl,
          pnl_pct:     avgEntryPrice > 0 ? ((ep - avgEntryPrice) / avgEntryPrice) * 100 : 0,
          r_multiple:  riskPerShare > 0 ? remainingPnl / (riskPerShare * currentShares) : 0,
        };

        patch.partials       = [...partials, finalPartial];
        patch.current_shares = 0;
        patch.exit_price     = ep;
        patch.pnl_dollars    = closeCalc.totalPnl;
        patch.pnl_pct        = closeCalc.totalPct;
        patch.r_multiple     = closeCalc.totalR;
        patch.outcome        = fallbackOutcome ?? closeCalc.autoOutcome;
      }

      const isClosingNow = (status === 'closed' || status === 'stopped_out') && !trade.exit_date;
      if (isClosingNow) patch.exit_date = new Date().toISOString();

      const { error } = await supabase.from('trades').update(patch).eq('id', trade.id);
      if (error) throw new Error(error.message);

      const updatedTrade: Trade = { ...trade, ...patch };

      const totalActions = sells.length + buys.length + (closeCalc ? 1 : 0);
      toast({
        title:   `${trade.ticker} saved`,
        body:    closeCalc
          ? `${closeCalc.totalPnl >= 0 ? '+' : ''}$${closeCalc.totalPnl.toFixed(0)} · ${closeCalc.totalR >= 0 ? '+' : ''}${closeCalc.totalR.toFixed(2)}R${totalActions > 0 ? ` (${totalActions} actions)` : ''}`
          : 'Notes saved.',
        variant: 'success',
        durationMs: 4000,
      });

      onSaved(updatedTrade);
    } catch (err) {
      toast({ title: 'Save failed', body: err instanceof Error ? err.message : 'Unknown error', variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const pnlSign = closeCalc ? closeCalc.totalPnl >= 0 : null;
  const hasScaleIns = buys.length > 0;

  if (!mounted) return null;

  const modal = (
    <div
      ref={backdropRef}
      onClick={e => { if (e.target === backdropRef.current) onClose(); }}
      className="fixed inset-0 z-[9999] flex items-center justify-center px-4 py-6"
      style={{
        background: 'var(--modal-overlay)',
        backdropFilter: 'blur(20px) saturate(130%)',
        WebkitBackdropFilter: 'blur(20px) saturate(130%)',
      }}
    >
      <div className="animate-modal-enter relative w-full max-w-[560px] rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-modal)] overflow-hidden flex flex-col max-h-[92vh]" style={{ boxShadow: 'var(--shadow-modal)' }}>

        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-[#22D3EE] to-[#10F088] z-10" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-6 pb-4 border-b border-[var(--border-subtle)] flex-shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 mb-0.5 flex-wrap">
              <span className="font-mono text-[20px] font-extrabold tracking-tight">{trade.ticker}</span>
              <StatusBadge status={trade.status} />
              {sells.length > 0 && (
                <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#A78BFA]/10 text-[#A78BFA]">
                  <ArrowDownLeft className="w-2.5 h-2.5" />
                  {sells.length} trim{sells.length > 1 ? 's' : ''}
                </span>
              )}
              {buys.length > 0 && (
                <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#22D3EE]/10 text-[#22D3EE]">
                  <ArrowUpRight className="w-2.5 h-2.5" />
                  {buys.length} add{buys.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="text-xs text-[var(--text-muted)] font-mono leading-relaxed">
              orig {trade.phase1_shares} sh @ ${trade.phase1_price.toFixed(2)}
              {hasScaleIns && (
                <span className="text-[#22D3EE]"> · avg ${avgEntryPrice.toFixed(2)}</span>
              )}
              &nbsp;·&nbsp;{currentShares} sh now
              &nbsp;·&nbsp;stop ${trade.initial_stop.toFixed(2)}
              &nbsp;·&nbsp;risk ${trade.risk_dollars.toFixed(0)}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-dim)] hover:bg-[var(--bg-elevated)] transition-colors ml-3 flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1">
          <div className="p-5 flex flex-col gap-5">

            {/* ── Scale Position panel (only when open) ─────────────────── */}
            {trade.status === 'open' && (
              <section className={cn(
                'rounded-[12px] border p-4 flex flex-col gap-3 transition-colors',
                scaleTab === 'sell'
                  ? 'border-[#A78BFA]/20 bg-[#A78BFA]/[0.025]'
                  : 'border-[#22D3EE]/20 bg-[#22D3EE]/[0.025]',
              )}>

                {/* Panel header + toggle */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Layers className={cn('w-3.5 h-3.5', scaleTab === 'sell' ? 'text-[#A78BFA]' : 'text-[#22D3EE]')} />
                    <span className={cn(
                      'text-xs uppercase tracking-[0.16em] font-bold',
                      scaleTab === 'sell' ? 'text-[#A78BFA]' : 'text-[#22D3EE]',
                    )}>
                      Scale Position
                    </span>
                  </div>

                  {/* Sell / Buy tab toggle */}
                  <div className="flex items-center rounded-[8px] border border-[var(--border-strong)] overflow-hidden text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setScaleTab('sell')}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 transition-all',
                        scaleTab === 'sell'
                          ? 'bg-[#A78BFA]/20 text-[#A78BFA]'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-dim)]',
                      )}
                    >
                      <ArrowDownLeft className="w-3 h-3" />
                      Trim
                    </button>
                    <span className="w-px h-5 bg-[var(--border-strong)]" />
                    <button
                      type="button"
                      onClick={() => setScaleTab('buy')}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 transition-all',
                        scaleTab === 'buy'
                          ? 'bg-[#22D3EE]/15 text-[#22D3EE]'
                          : 'text-[var(--text-muted)] hover:text-[var(--text-dim)]',
                      )}
                    >
                      <ArrowUpRight className="w-3 h-3" />
                      Add
                    </button>
                  </div>
                </div>

                {/* ── SELL (Trim) tab ──────────────────────────────────── */}
                {scaleTab === 'sell' && currentShares > 0 && (
                  <>
                    {/* Quick-trim buttons */}
                    <div className="flex gap-2">
                      {[
                        { label: '¼', shares: Math.floor(currentShares / 4) },
                        { label: '⅓', shares: Math.floor(currentShares / 3) },
                        { label: '½', shares: Math.floor(currentShares / 2) },
                        { label: 'All', shares: currentShares },
                      ].filter(b => b.shares > 0).map(b => (
                        <button
                          key={b.label}
                          type="button"
                          onClick={() => setSellShares(String(b.shares))}
                          className={cn(
                            'flex-1 py-1.5 rounded-[7px] text-xs font-bold border transition-all',
                            sellShares === String(b.shares)
                              ? 'bg-[#A78BFA]/20 border-[#A78BFA]/40 text-[#A78BFA]'
                              : 'border-[var(--border-dim)] text-[var(--text-secondary)] hover:border-[#A78BFA]/30 hover:text-[#A78BFA]',
                          )}
                        >
                          {b.label}
                          <span className="block text-[9px] font-mono opacity-70">{b.shares} sh</span>
                        </button>
                      ))}
                    </div>

                    {/* Date */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs uppercase tracking-[0.14em] font-semibold text-[#A78BFA]">Trim Date</label>
                      <input
                        type="date"
                        value={sellDate}
                        onChange={e => setSellDate(e.target.value)}
                        className={cn(fieldCls, 'focus:border-[#A78BFA] focus:ring-[#A78BFA]/15')}
                      />
                    </div>

                    {/* Shares + Price */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs uppercase tracking-[0.14em] font-semibold text-[var(--text-secondary)]">Shares to sell</label>
                        <input
                          inputMode="numeric"
                          value={sellShares}
                          onChange={e => setSellShares(e.target.value)}
                          placeholder={`1–${currentShares}`}
                          className={cn(fieldCls, 'focus:border-[#A78BFA] focus:ring-[#A78BFA]/15')}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs uppercase tracking-[0.14em] font-semibold text-[#A78BFA]">Exit Price ($)</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] font-mono text-[13px]">$</span>
                          <input
                            inputMode="decimal"
                            value={sellPrice}
                            onChange={e => setSellPrice(e.target.value)}
                            placeholder="0.00"
                            className={cn(fieldCls, 'pl-7 focus:border-[#A78BFA] focus:ring-[#A78BFA]/15')}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Sell PnL preview */}
                    {sellCalc && (
                      <PreviewGrid
                        positive={sellCalc.pnl >= 0}
                        items={[
                          { label: 'PnL $', val: `${sellCalc.pnl >= 0 ? '+' : ''}$${sellCalc.pnl.toFixed(0)}` },
                          { label: 'PnL %', val: `${sellCalc.pnlPct >= 0 ? '+' : ''}${sellCalc.pnlPct.toFixed(2)}%` },
                          { label: 'R',     val: `${sellCalc.rMult >= 0 ? '+' : ''}${sellCalc.rMult.toFixed(2)}R` },
                        ]}
                      />
                    )}

                    <ActionButton
                      disabled={!sellCalc || savingSell}
                      loading={savingSell}
                      color="violet"
                      icon={<ArrowDownLeft className="w-3.5 h-3.5" />}
                      label="Log Trim"
                      onClick={() => void handleSell()}
                    />
                  </>
                )}

                {/* ── BUY (Add) tab ────────────────────────────────────── */}
                {scaleTab === 'buy' && (
                  <>
                    {/* Buy date */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs uppercase tracking-[0.14em] font-semibold text-[#22D3EE]">Add Date</label>
                      <input
                        type="date"
                        value={buyDate}
                        onChange={e => setBuyDate(e.target.value)}
                        className={cn(fieldCls, 'focus:border-[#22D3EE] focus:ring-[#22D3EE]/15')}
                      />
                    </div>

                    {/* Amount + Price → auto-shares */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs uppercase tracking-[0.14em] font-semibold text-[var(--text-secondary)]">
                          Amount to Invest ($)
                          <span className="ml-1 text-[var(--text-faint)] normal-case tracking-normal font-normal">optional</span>
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] font-mono text-[13px]">$</span>
                          <input
                            inputMode="decimal"
                            value={buyAmount}
                            onChange={e => handleBuyAmountChange(e.target.value)}
                            placeholder="5,000"
                            className={cn(fieldCls, 'pl-7 focus:border-[#22D3EE] focus:ring-[#22D3EE]/15')}
                          />
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs uppercase tracking-[0.14em] font-semibold text-[#22D3EE]">Buy Price ($)</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] font-mono text-[13px]">$</span>
                          <input
                            inputMode="decimal"
                            value={buyPrice}
                            onChange={e => handleBuyPriceChange(e.target.value)}
                            placeholder="0.00"
                            className={cn(fieldCls, 'pl-7 focus:border-[#22D3EE] focus:ring-[#22D3EE]/15')}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Shares (auto-filled or direct) */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs uppercase tracking-[0.14em] font-semibold text-[var(--text-secondary)]">
                        Shares to Add
                        <span className="ml-1 text-[var(--text-faint)] normal-case tracking-normal font-normal">auto-calculated · or enter directly</span>
                      </label>
                      <div className="relative">
                        <input
                          inputMode="numeric"
                          value={buyShares}
                          onChange={e => setBuyShares(e.target.value)}
                          placeholder="100"
                          className={cn(fieldCls, 'focus:border-[#22D3EE] focus:ring-[#22D3EE]/15 pr-16')}
                        />
                        {buyCalc && (
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-[var(--text-muted)]">
                            ${(buyCalc.totalCost).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Buy preview */}
                    {buyCalc && (
                      <PreviewGrid
                        positive
                        items={[
                          { label: 'New Total', val: `${buyCalc.newTotalShares} sh` },
                          { label: 'New Avg',   val: `$${buyCalc.newAvgEntry.toFixed(2)}` },
                          { label: 'New Risk',  val: `$${buyCalc.newRiskDollars.toFixed(0)}` },
                        ]}
                        accent="cyan"
                      />
                    )}

                    <ActionButton
                      disabled={!buyCalc || savingBuy}
                      loading={savingBuy}
                      color="cyan"
                      icon={<ArrowUpRight className="w-3.5 h-3.5" />}
                      label="Log Scale-In"
                      onClick={() => void handleBuy()}
                    />
                  </>
                )}
              </section>
            )}

            {/* ── Auto-close badge ──────────────────────────────────────── */}
            {autoClosed && (
              <div className={cn(
                'flex items-start gap-3 px-4 py-3.5 rounded-[10px] border',
                autoClosed.outcome === 'winner'
                  ? 'bg-[#10F088]/[0.08] border-[#10F088]/30'
                  : autoClosed.outcome === 'loser'
                    ? 'bg-[#FF3B5C]/[0.08] border-[#FF3B5C]/30'
                    : 'bg-amber-400/[0.08] border-amber-400/30',
              )}>
                <div className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
                  autoClosed.outcome === 'winner' ? 'bg-[#10F088]/20' : autoClosed.outcome === 'loser' ? 'bg-[#FF3B5C]/20' : 'bg-amber-400/20',
                )}>
                  {autoClosed.outcome === 'winner'
                    ? <TrendingUp   className="w-3.5 h-3.5 text-[#10F088]" />
                    : autoClosed.outcome === 'loser'
                      ? <TrendingDown className="w-3.5 h-3.5 text-[#FF3B5C]" />
                      : <span className="text-xs font-bold text-amber-400">BE</span>}
                </div>
                <div>
                  <p className={cn(
                    'text-[13px] font-bold uppercase tracking-wider',
                    autoClosed.outcome === 'winner' ? 'text-[#10F088]' : autoClosed.outcome === 'loser' ? 'text-[#FF3B5C]' : 'text-amber-400',
                  )}>
                    Auto-closed as {autoClosed.outcome.toUpperCase()}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    All shares sold via trims. Add notes if needed, then save.
                  </p>
                  <div className="flex gap-3 mt-1.5 text-xs font-mono font-bold tabular-nums">
                    <span className={autoClosed.pnl > 0 ? 'text-emerald-400' : autoClosed.pnl < 0 ? 'text-red-400' : 'text-zinc-400'}>
                      {autoClosed.pnl >= 0 ? '+' : ''}${autoClosed.pnl.toFixed(0)}
                    </span>
                    <span className={autoClosed.pct > 0 ? 'text-emerald-400' : autoClosed.pct < 0 ? 'text-red-400' : 'text-zinc-400'}>
                      {autoClosed.pct >= 0 ? '+' : ''}{autoClosed.pct.toFixed(2)}%
                    </span>
                    <span className={autoClosed.r > 0 ? 'text-emerald-400' : autoClosed.r < 0 ? 'text-red-400' : 'text-zinc-400'}>
                      {autoClosed.r >= 0 ? '+' : ''}{autoClosed.r.toFixed(2)}R
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* ── Chart Screenshot ──────────────────────────────────────── */}
            <ScreenshotSection trade={trade} />

            {/* ── Trade History ─────────────────────────────────────────── */}
            {partials.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="text-xs uppercase tracking-[0.16em] font-bold text-[var(--text-muted)]">Trade History</span>
                  <span className="flex-1 h-px bg-[var(--divider-dim)]" />
                  <span className={cn(
                    'font-mono text-xs tabular-nums',
                    realizedPnL > 0 ? 'text-emerald-400' : realizedPnL < 0 ? 'text-red-400' : 'text-zinc-400',
                  )}>
                    realized: {realizedPnL >= 0 ? '+' : ''}${realizedPnL.toFixed(0)}
                  </span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {partials.map(p => {
                    const isBuy = p.action === 'buy';
                    return (
                      <div
                        key={p.id}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2 rounded-[8px] border',
                          isBuy
                            ? 'bg-[#22D3EE]/[0.03] border-[#22D3EE]/10'
                            : 'bg-[var(--bg-surface)] border-[var(--divider-dim)]',
                        )}
                      >
                        {/* Action badge */}
                        <span className={cn(
                          'text-[8px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0',
                          isBuy
                            ? 'bg-[#22D3EE]/15 text-[#22D3EE]'
                            : 'bg-[#A78BFA]/15 text-[#A78BFA]',
                        )}>
                          {isBuy ? 'Add' : 'Trim'}
                        </span>

                        <span className="text-xs font-mono text-[var(--text-faint)] flex-shrink-0">
                          {formatDate(p.date)}
                        </span>
                        <span className="text-xs font-mono text-[var(--text-muted)] flex-shrink-0">
                          {isBuy ? '+' : '−'}{p.shares} sh @ ${p.price.toFixed(2)}
                        </span>

                        {!isBuy && (
                          <>
                            <span className={cn(
                              'ml-auto font-mono text-xs font-bold tabular-nums flex-shrink-0',
                              p.pnl_dollars > 0 ? 'text-emerald-400' : p.pnl_dollars < 0 ? 'text-red-400' : 'text-zinc-400',
                            )}>
                              {p.pnl_dollars >= 0 ? '+' : ''}${p.pnl_dollars.toFixed(0)}
                            </span>
                            <span className={cn(
                              'font-mono text-xs tabular-nums w-12 text-right flex-shrink-0',
                              p.r_multiple > 0 ? 'text-emerald-400' : p.r_multiple < 0 ? 'text-red-400' : 'text-zinc-400',
                            )}>
                              {p.r_multiple >= 0 ? '+' : ''}{p.r_multiple.toFixed(2)}R
                            </span>
                          </>
                        )}

                        {isBuy && (
                          <span className="ml-auto text-xs font-mono text-[var(--text-faint)] flex-shrink-0">
                            ${(p.shares * p.price).toLocaleString('en-US', { maximumFractionDigits: 0 })} deployed
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ── Close / Full Exit ─────────────────────────────────────── */}
            <section className="rounded-[12px] border border-[var(--border-strong)] bg-[var(--bg-surface)] p-4 flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#22D3EE]" />
                <span className="text-xs uppercase tracking-[0.16em] font-bold text-[var(--text-secondary)]">
                  {trade.status === 'open'
                    ? (currentShares > 0 ? 'Close Position' : 'Fully Closed via Trims')
                    : 'Exit Details'}
                </span>
              </div>

              {currentShares > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs uppercase tracking-[0.14em] font-semibold text-[#22D3EE]">
                      Exit Price ({currentShares} sh)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] font-mono text-[13px]">$</span>
                      <input
                        inputMode="decimal"
                        value={exitPrice}
                        onChange={e => setExitPrice(e.target.value)}
                        placeholder="0.00"
                        className={cn(fieldCls, 'pl-7 focus:border-[#22D3EE] focus:ring-[#22D3EE]/15 text-[15px] font-semibold')}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs uppercase tracking-[0.14em] font-semibold text-[var(--text-secondary)]">Status</label>
                    <select
                      value={status}
                      onChange={e => setStatus(e.target.value as TradeStatus)}
                      className="bg-[var(--bg-input)] border border-[var(--border-dim)] rounded-[8px] px-3 py-2.5 text-[13px] font-semibold text-[var(--text-primary)] focus:outline-none focus:border-[#22D3EE] focus:ring-[3px] focus:ring-[#22D3EE]/15 transition appearance-none"
                    >
                      <option value="open">Open</option>
                      <option value="closed">Closed</option>
                      <option value="stopped_out">Stopped out</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Cumulative PnL preview */}
              {closeCalc && (
                <PreviewGrid
                  large
                  positive={closeCalc.totalPnl >= 0}
                  items={[
                    { label: sells.length > 0 ? 'Total PnL $' : 'PnL $',
                      val: `${pnlSign ? '+' : ''}$${closeCalc.totalPnl.toFixed(0)}` },
                    { label: 'PnL %',
                      val: `${closeCalc.totalPct >= 0 ? '+' : ''}${closeCalc.totalPct.toFixed(2)}%` },
                    { label: 'R Multiple',
                      val: `${closeCalc.totalR >= 0 ? '+' : ''}${closeCalc.totalR.toFixed(2)}R` },
                  ]}
                />
              )}

              {/* Already-realized reminder when no exit price yet */}
              {sells.length > 0 && !closeCalc && (
                <div className="text-xs text-[var(--text-faint)] px-1">
                  {sells.length} trim{sells.length > 1 ? 's' : ''} realized: {realizedPnL >= 0 ? '+' : ''}${realizedPnL.toFixed(0)}.
                  {currentShares > 0 ? ` Enter exit price to close ${currentShares} remaining shares.` : ' Position fully closed.'}
                </div>
              )}

              {/* Outcome selector */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs uppercase tracking-[0.14em] font-semibold text-[var(--text-secondary)]">
                  Outcome{closeCalc && (outcome as string) === '' ? ' (auto)' : ''}
                </label>
                <div className="flex gap-2">
                  {(['winner', 'loser', 'breakeven'] as TradeOutcome[]).map(opt => {
                    const active = effectiveOutcome === opt;
                    const palette: Record<TradeOutcome, string> = {
                      winner:    active ? 'bg-[#10F088]/15 border-[#10F088]/40 text-[#10F088]' : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--border-hover)]',
                      loser:     active ? 'bg-[#FF3B5C]/15 border-[#FF3B5C]/40 text-[#FF3B5C]' : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--border-hover)]',
                      breakeven: active ? 'bg-amber-400/15 border-amber-400/40 text-amber-400'  : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[var(--border-hover)]',
                    };
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setOutcome(outcome === opt ? '' : opt)}
                        className={cn(
                          'flex-1 py-2 rounded-[8px] border text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1',
                          palette[opt],
                        )}
                      >
                        {active && <Check className="w-3 h-3" strokeWidth={3} />}
                        {opt}
                      </button>
                    );
                  })}
                </div>
                {(outcome as string) !== '' && (
                  <button onClick={() => setOutcome('')} className="self-start text-xs text-[var(--text-faint)] hover:text-[var(--text-secondary)] transition-colors">
                    Reset to auto
                  </button>
                )}
              </div>
            </section>

            {/* ── Notes ───────────────────────────────────────────────── */}
            <section className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs uppercase tracking-[0.14em] font-semibold text-[var(--text-secondary)]">Notes</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                  placeholder="What happened? Execution notes..."
                  className="bg-[var(--bg-input)] border border-[var(--border-dim)] rounded-[8px] px-3 py-2.5 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[#22D3EE] focus:ring-[3px] focus:ring-[#22D3EE]/15 transition resize-none"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs uppercase tracking-[0.14em] font-semibold text-[var(--text-secondary)]">Lesson Learned</label>
                <textarea
                  value={lessonLearned}
                  onChange={e => setLessonLearned(e.target.value)}
                  rows={2}
                  placeholder="What would you do differently?"
                  className="bg-[var(--bg-input)] border border-[var(--border-dim)] rounded-[8px] px-3 py-2.5 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[#A78BFA] focus:ring-[3px] focus:ring-[#A78BFA]/15 transition resize-none"
                />
              </div>
            </section>

            {/* ── Actions ─────────────────────────────────────────────── */}
            <div className="flex flex-col gap-2 pb-1">
              <div className="flex gap-2.5">
                <button
                  onClick={onClose}
                  className="flex-1 py-3 rounded-[10px] border border-[var(--border-strong)] text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] hover:text-[var(--text-dim)] hover:border-[var(--border-hover)] transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void handleSave()}
                  disabled={saving}
                  className={cn(
                    'flex-[2] py-3 rounded-[10px] text-xs font-extrabold uppercase tracking-wider transition-all flex items-center justify-center gap-2',
                    saving
                      ? 'bg-[var(--bg-elevated)] text-[var(--text-faint)] cursor-not-allowed'
                      : 'bg-gradient-to-br from-[#22D3EE] to-[#10F088] text-black shadow-[0_0_20px_rgba(34,211,238,0.25)] hover:brightness-110 hover:-translate-y-px',
                  )}
                >
                  {saving
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Saving…</>
                    : closeCalc
                      ? <><TrendingUp className="w-3.5 h-3.5" />Close Trade</>
                      : <><TrendingDown className="w-3.5 h-3.5" />Save Notes</>}
                </button>
              </div>

              {/* Destructive delete — muted by default, requires deliberate hover */}
              <button
                type="button"
                onClick={onDelete}
                className="flex items-center justify-center gap-1.5 py-2 rounded-[8px] border border-transparent text-xs font-semibold text-[#FF3B5C]/40 hover:text-[#FF3B5C]/80 hover:bg-[#FF3B5C]/[0.05] hover:border-[#FF3B5C]/15 transition-all"
              >
                <Trash2 className="w-3 h-3" />
                Delete this trade
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

// ── ScreenshotSection ─────────────────────────────────────────────────────────
// Shown inside EditModal: view existing screenshot OR upload a new one.

function ScreenshotSection({ trade }: { trade: Trade }) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview,       setPreview]       = useState<string | null>(trade.screenshot_url ?? null);
  const [uploading,     setUploading]     = useState(false);
  const [uploadedUrl,   setUploadedUrl]   = useState<string | null>(trade.screenshot_url ?? null);
  const [isDragging,    setIsDragging]    = useState(false);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/') || !user) return;
    if (preview && !trade.screenshot_url) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
    setUploadedUrl(null);
    setUploading(true);
    try {
      const ext  = file.name.split('.').pop() ?? 'jpg';
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: storageErr } = await supabase.storage
        .from('journal-images')
        .upload(path, file, { cacheControl: '3600', upsert: false });
      if (storageErr) { toast({ title: 'Upload failed', body: storageErr.message, variant: 'error' }); return; }
      const { data: urlData } = supabase.storage.from('journal-images').getPublicUrl(path);
      const url = urlData.publicUrl;
      setUploadedUrl(url);
      await supabase.from('trades').update({ screenshot_url: url }).eq('id', trade.id);
    } finally {
      setUploading(false);
    }
  };

  return (
    <section>
      <div className="flex items-center gap-2 mb-2.5">
        <span className="text-xs uppercase tracking-[0.16em] font-bold text-[var(--text-muted)]">Chart at Entry</span>
        <span className="flex-1 h-px bg-[var(--divider-dim)]" />
        {(preview || uploadedUrl) && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-xs text-[var(--text-faint)] hover:text-[#22D3EE] transition-colors font-semibold"
          >
            Change
          </button>
        )}
      </div>

      {preview ? (
        <div className="relative rounded-[10px] overflow-hidden border border-[var(--border-strong)] bg-[var(--bg-input)]" style={{ aspectRatio: '16/7' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt={`${trade.ticker} chart`} className="w-full h-full object-cover" />
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/80 text-xs text-[#22D3EE]">
                <Loader2 className="w-3 h-3 animate-spin" />
                Uploading…
              </div>
            </div>
          )}
          {!uploading && uploadedUrl && (
            <div className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded bg-[#10F088]/20 text-[9px] font-mono text-[#10F088]">
              <Check className="w-2.5 h-2.5" />
              Saved
            </div>
          )}
        </div>
      ) : (
        <div
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={e => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) void handleFile(f); }}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'cursor-pointer rounded-[10px] border-2 border-dashed px-4 py-5 flex flex-col items-center justify-center gap-2 transition-all select-none',
            isDragging ? 'border-[#22D3EE]/60 bg-[#22D3EE]/[0.07]' : 'border-[var(--border-strong)] bg-[var(--bg-surface)] hover:border-[var(--border-hover)]',
          )}
        >
          <UploadCloud className={cn('w-5 h-5 transition-colors', isDragging ? 'text-[#22D3EE]' : 'text-[var(--text-faint)]')} />
          <p className="text-xs text-[var(--text-muted)]">
            Drop chart or <span className="text-[#22D3EE] font-semibold">click to upload</span>
          </p>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={e => { const f = e.target.files?.[0]; if (f) void handleFile(f); }}
      />
    </section>
  );
}

// ── Small shared UI atoms ──────────────────────────────────────────────────────

const fieldCls =
  'w-full bg-[var(--bg-input)] border border-[var(--border-dim)] rounded-[8px] px-3 py-2.5 font-mono text-[14px] text-[var(--text-primary)] focus:outline-none focus:ring-[3px] transition';

function PreviewGrid({
  items, positive, large = false, accent = 'default',
}: {
  items: { label: string; val: string }[];
  positive: boolean;
  large?: boolean;
  accent?: 'cyan' | 'default';
}) {
  const color =
    accent === 'cyan'     ? 'text-[#22D3EE]' :
    positive              ? 'text-emerald-400' : 'text-red-400';

  const bg =
    accent === 'cyan'     ? 'bg-[#22D3EE]/[0.05] border-[#22D3EE]/20' :
    positive              ? 'bg-[#10F088]/[0.05] border-[#10F088]/20'  : 'bg-[#FF3B5C]/[0.05] border-[#FF3B5C]/20';

  return (
    <div className={cn('grid gap-2 p-3 rounded-[9px] border', bg, `grid-cols-${items.length}`)}>
      {items.map(({ label, val }) => (
        <div key={label} className="text-center">
          <div className="text-[9px] uppercase tracking-wider font-bold text-[var(--text-faint)] mb-0.5">{label}</div>
          <div className={cn('font-mono font-extrabold', large ? 'text-[16px]' : 'text-[13px]', color)}>
            {val}
          </div>
        </div>
      ))}
    </div>
  );
}

function ActionButton({
  disabled, loading, color, icon, label, onClick,
}: {
  disabled: boolean;
  loading: boolean;
  color: 'violet' | 'cyan';
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  const active =
    color === 'violet'
      ? 'bg-[#A78BFA]/20 border border-[#A78BFA]/30 text-[#A78BFA] hover:bg-[#A78BFA]/30 hover:border-[#A78BFA]/50'
      : 'bg-[#22D3EE]/15 border border-[#22D3EE]/25 text-[#22D3EE] hover:bg-[#22D3EE]/25 hover:border-[#22D3EE]/40';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full py-2.5 rounded-[9px] text-xs font-extrabold uppercase tracking-wider transition-all flex items-center justify-center gap-2',
        disabled
          ? 'bg-[var(--bg-elevated)] text-[var(--text-faint)] cursor-not-allowed'
          : active,
      )}
    >
      {loading
        ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Logging…</>
        : <>{icon}{label}</>}
    </button>
  );
}

// ── Page-level supporting components ──────────────────────────────────────────

type SetupGroup = { setup: string; count: number; winRate: number; totalPnL: number; avgR: number };

function SetupBreakdown({ groups }: { groups: SetupGroup[] }) {
  const [open, setOpen] = useState(true);

  if (groups.length === 0) return null;

  const maxAbs = Math.max(...groups.map(g => Math.abs(g.totalPnL)), 1);

  return (
    <div
      className="mb-7 rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden"
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[var(--bg-elevated)] transition-colors"
      >
        <span className="text-[10px] uppercase tracking-[0.18em] font-bold text-[var(--text-muted)]">
          Breakdown by Setup
        </span>
        <ChevronRight className={cn('w-3.5 h-3.5 text-[var(--text-faint)] transition-transform', open && 'rotate-90')} />
      </button>

      {open && (
        <div className="border-t border-[var(--border-subtle)]">
          <div className="grid grid-cols-[1fr_4rem_4rem_5.5rem_4rem] gap-x-4 px-4 py-2 bg-[var(--bg-subtle)]">
            {['Setup', 'Trades', 'Win%', 'Total P&L', 'Avg R'].map(h => (
              <span key={h} className="text-[9px] uppercase tracking-[0.18em] font-bold text-[var(--text-faint)]">{h}</span>
            ))}
          </div>
          <div className="divide-y divide-[var(--divider)]">
            {groups.map(g => {
              const barPct = (Math.abs(g.totalPnL) / maxAbs) * 100;
              const pnlPos = g.totalPnL >= 0;
              const rPos   = g.avgR >= 0;
              return (
                <div key={g.setup} className="grid grid-cols-[1fr_4rem_4rem_5.5rem_4rem] gap-x-4 px-4 py-2.5 items-center">
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="text-xs font-bold text-[var(--text-primary)] truncate">{g.setup}</span>
                    <div className="h-1 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                      <div
                        className={cn('h-full rounded-full', pnlPos ? 'bg-[#10F088]/70' : 'bg-[#FF3B5C]/70')}
                        style={{ width: `${barPct}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-xs font-mono tabular-nums text-[var(--text-secondary)]">{g.count}</span>
                  <span className={cn('text-xs font-mono tabular-nums font-semibold', g.winRate >= 50 ? 'text-emerald-400' : 'text-[var(--text-secondary)]')}>
                    {g.winRate.toFixed(0)}%
                  </span>
                  <span className={cn('text-xs font-mono tabular-nums font-semibold', pnlPos ? 'text-emerald-400' : 'text-red-400')}>
                    {pnlPos ? '+' : ''}{g.totalPnL.toFixed(0)}
                  </span>
                  <span className={cn('text-xs font-mono tabular-nums font-semibold', rPos ? 'text-emerald-400' : 'text-red-400')}>
                    {rPos ? '+' : ''}{g.avgR.toFixed(2)}R
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, accent }: {
  label: string; value: string; accent: 'cyan' | 'green' | 'red' | 'amber';
}) {
  const dots = { cyan: 'bg-[#22D3EE]', green: 'bg-[#10F088]', red: 'bg-[#EF4444]', amber: 'bg-amber-400' };
  const valueColor = value === '—' ? 'text-[var(--text-primary)]'
    : accent === 'green' ? 'text-emerald-400'
    : accent === 'red'   ? 'text-red-400'
    : 'text-[var(--text-primary)]';
  return (
    <div
      className="p-5 rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden"
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <div className="text-[9px] uppercase tracking-[0.18em] font-bold text-[var(--text-muted)] mb-2 opacity-70">{label}</div>
      <div className="flex items-center gap-2">
        <span className={cn('font-mono text-[22px] font-extrabold tracking-tight tabular-nums', valueColor)}>{value}</span>
        {value !== '—' && <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', dots[accent])} />}
      </div>
    </div>
  );
}

function LoadingState({ slow }: { slow?: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3 text-[var(--text-muted)]">
      <div className="flex items-center gap-3">
        <Loader2 className="w-5 h-5 animate-spin text-[#22D3EE]" />
        <span className="text-[13px] font-semibold">Loading trades…</span>
      </div>
      {slow && (
        <p className="text-xs text-[var(--text-faint)]">Taking longer than usual — still trying…</p>
      )}
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
      <div className="px-4 py-3 rounded-[10px] bg-[#FF3B5C]/[0.06] border border-[#FF3B5C]/30 text-[#FF3B5C] text-[13px] max-w-md">
        {message}
      </div>
      <button onClick={onRetry} className="text-xs font-semibold text-[#22D3EE] hover:underline uppercase tracking-wider">
        Retry
      </button>
    </div>
  );
}

function EmptyState({ filter, onAdd }: { filter: StatusFilter | 'filtered'; onAdd: () => void }) {
  const isFiltered = filter === 'filtered';
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="text-[13px] font-semibold text-[var(--text-muted)] mb-2">
        {isFiltered ? 'אין טריידים התואמים את הסינון' : 'No trades logged yet'}
      </div>
      <p className="text-xs text-[var(--text-faint)] mb-6">
        {isFiltered ? 'נסה לשנות את הסינון או נקה אותו.' : 'Log your first trade using the button above.'}
      </p>
      {isFiltered ? (
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-[var(--border-strong)] text-[var(--text-secondary)] font-bold text-xs uppercase tracking-[0.08em] hover:bg-[var(--bg-elevated)] transition"
        >
          <X className="w-3.5 h-3.5" />
          נקה סינון
        </button>
      ) : (
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-br from-[#22D3EE] to-[#10F088] text-black font-bold text-xs uppercase tracking-[0.08em] hover:brightness-110 transition shadow-[0_0_20px_rgba(34,211,238,0.3)]"
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={3} />
          Log First Trade
        </button>
      )}
    </div>
  );
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
