// app/watchlist/page.tsx
//
// Live watchlist: add/remove tickers stored in watchlist_items.
// Clicking a ticker shows a TradingView chart + live EMA/Trend Template snapshot.

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle, BookmarkPlus, Check, ChevronDown, ChevronUp, Loader2,
  Plus, RefreshCw, TrendingDown, TrendingUp, X,
} from 'lucide-react';
import { AppNav } from '@/components/nav/app-nav';
import { GridOverlay } from '@/components/ui/grid-overlay';
import { TradingViewChart } from '@/components/ui/tradingview-chart';
import { supabase, type WatchlistItem } from '@/lib/supabase-client';
import { useAuth } from '@/lib/auth-context';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import type { TickerResponse, TickerErrorResponse } from '@/app/api/ticker/[symbol]/route';
import { isValidTicker, TICKER_ERROR } from '@/lib/ticker-validation';

type SnapshotState = TickerResponse | 'loading' | 'error';

export default function WatchlistPage() {
  const { user, loading: authLoading } = useAuth();

  const [items,          setItems]          = useState<WatchlistItem[]>([]);
  const [loadingList,    setLoadingList]    = useState(true);
  const [tickerInput,    setTickerInput]    = useState('');
  const [tickerError,    setTickerError]    = useState<string | null>(null);
  const [adding,         setAdding]         = useState(false);
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);
  const [snapshots,      setSnapshots]      = useState<Record<string, SnapshotState>>({});

  // ── Fetch list ─────────────────────────────────────────────────────────────

  const userId = user?.id;

  const fetchItems = useCallback(async () => {
    if (!userId) {
      setLoadingList(false);
      return;
    }
    setLoadingList(true);
    const { data, error } = await supabase
      .from('watchlist_items')
      .select('*')
      .order('added_at', { ascending: false });
    if (!error) setItems((data as WatchlistItem[]) ?? []);
    setLoadingList(false);
  }, [userId]);

  useEffect(() => {
    if (!authLoading) void fetchItems();
  }, [fetchItems, authLoading]);

  // ── Add ticker ─────────────────────────────────────────────────────────────

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const sym = tickerInput.trim().toUpperCase();
    if (!sym || !user || adding) return;

    if (!isValidTicker(sym)) {
      setTickerError(TICKER_ERROR);
      return;
    }

    if (items.some(i => i.ticker === sym)) {
      toast({ title: `${sym} already on watchlist`, variant: 'warning' });
      return;
    }

    setAdding(true);
    setTickerError(null);

    try {
      const res = await fetch(`/api/ticker/${sym}`);
      if (!res.ok) {
        setTickerError('Ticker not found. Please enter a valid US stock symbol.');
        setAdding(false);
        return;
      }
    } catch {
      toast({ title: 'Could not validate ticker', body: 'Check your connection and try again.', variant: 'warning' });
      setAdding(false);
      return;
    }

    const { error } = await supabase.from('watchlist_items').insert({
      user_id: user.id,
      ticker: sym,
    });

    if (error) {
      toast({ title: 'Failed to add ticker', body: error.message, variant: 'error' });
    } else {
      setTickerInput('');
      setTickerError(null);
      await fetchItems();
      toast({ title: `${sym} added to watchlist`, variant: 'success' });
    }
    setAdding(false);
  };

  // ── Remove ticker ──────────────────────────────────────────────────────────

  const handleRemove = async (item: WatchlistItem) => {
    const { error } = await supabase
      .from('watchlist_items')
      .delete()
      .eq('id', item.id);

    if (error) {
      toast({ title: 'Failed to remove ticker', variant: 'error' });
    } else {
      setItems(prev => prev.filter(i => i.id !== item.id));
      if (expandedTicker === item.ticker) setExpandedTicker(null);
    }
  };

  // ── Expand / fetch snapshot ────────────────────────────────────────────────

  const fetchSnapshot = async (ticker: string) => {
    setSnapshots(prev => ({ ...prev, [ticker]: 'loading' }));
    try {
      const res  = await fetch(`/api/ticker/${ticker}`);
      const body = await res.json();
      if (!res.ok) {
        const err = body as TickerErrorResponse;
        toast({ title: `${ticker}: ${err.error}`, variant: 'error' });
        setSnapshots(prev => ({ ...prev, [ticker]: 'error' }));
      } else {
        setSnapshots(prev => ({ ...prev, [ticker]: body as TickerResponse }));
      }
    } catch {
      setSnapshots(prev => ({ ...prev, [ticker]: 'error' }));
    }
  };

  const handleExpand = async (ticker: string) => {
    if (expandedTicker === ticker) {
      setExpandedTicker(null);
      return;
    }
    setExpandedTicker(ticker);
    if (snapshots[ticker] && snapshots[ticker] !== 'error') return;
    void fetchSnapshot(ticker);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <GridOverlay />
      <AppNav />

      <main className="max-w-[1100px] mx-auto px-4 sm:px-6 py-10 relative">

        <div className="mb-7">
          <h1 className="text-[20px] font-extrabold tracking-tight mb-1">Watchlist</h1>
          <p className="text-xs text-[var(--text-muted)]">
            Add tickers to track. Click a row to see a live chart, EMA status, and Trend Template.
          </p>
        </div>

        {/* Add form */}
        <div className="flex flex-col gap-1.5 mb-7">
          <form onSubmit={handleAdd} className="flex gap-2.5">
            <input
              value={tickerInput}
              onChange={e => {
                setTickerInput(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5));
                if (tickerError) setTickerError(null);
              }}
              onBlur={() => {
                const sym = tickerInput.trim();
                if (sym && !isValidTicker(sym)) setTickerError(TICKER_ERROR);
              }}
              placeholder="TICKER"
              className={cn(
                'flex-1 min-w-0 bg-[var(--bg-input)] border rounded-[10px] px-4 py-3 font-mono text-[18px] font-bold uppercase text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:ring-[3px] transition',
                tickerError
                  ? 'border-[#FF3B5C] focus:border-[#FF3B5C] focus:ring-[#FF3B5C]/15'
                  : 'border-[var(--border-subtle)] focus:border-[#22D3EE] focus:ring-[#22D3EE]/15',
              )}
            />
            <button
              type="submit"
              disabled={adding || !tickerInput.trim() || !!tickerError}
              className={cn(
                'flex items-center gap-2 px-5 py-3 rounded-[10px] text-xs font-extrabold uppercase tracking-wider transition-all',
                adding || !tickerInput.trim() || !!tickerError
                  ? 'bg-[var(--bg-elevated)] text-[var(--text-faint)] cursor-not-allowed'
                  : 'bg-gradient-to-br from-[#22D3EE] to-[#10F088] text-black shadow-[0_0_20px_rgba(34,211,238,0.25)] hover:brightness-110 hover:-translate-y-px',
              )}
            >
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add
            </button>
          </form>
          {tickerError && (
            <p className="text-xs text-[#FF3B5C] flex items-center gap-1.5 px-1">
              <X className="w-3 h-3 flex-shrink-0" />{tickerError}
            </p>
          )}
        </div>

        {/* List */}
        {loadingList ? (
          <div className="flex items-center gap-2 py-10 text-[var(--text-faint)] text-[13px]">
            <Loader2 className="w-4 h-4 animate-spin text-[#22D3EE]" />
            Loading watchlist…
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center rounded-[14px] border border-dashed border-[var(--border-hover)] bg-[var(--bg-surface)]">
            <div className="w-12 h-12 rounded-full border-2 border-dashed border-[var(--border-hover)] flex items-center justify-center mb-4">
              <BookmarkPlus className="w-5 h-5 text-[var(--text-faint)]" />
            </div>
            <p className="text-[15px] font-bold text-[var(--text-secondary)] mb-1">Watchlist is empty</p>
            <p className="text-xs text-[var(--text-muted)] max-w-[220px]">
              Add a ticker above to track it with a live chart and Trend Template snapshot.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {items.map(item => (
              <WatchlistRow
                key={item.id}
                item={item}
                expanded={expandedTicker === item.ticker}
                snapshot={snapshots[item.ticker]}
                onExpand={() => void handleExpand(item.ticker)}
                onRemove={() => void handleRemove(item)}
                onRetry={() => void fetchSnapshot(item.ticker)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

// ── WatchlistRow ───────────────────────────────────────────────────────────────

function WatchlistRow({
  item, expanded, snapshot, onExpand, onRemove, onRetry,
}: {
  item: WatchlistItem;
  expanded: boolean;
  snapshot: SnapshotState | undefined;
  onExpand: () => void;
  onRemove: () => void;
  onRetry: () => void;
}) {
  const removeRef = useRef<HTMLButtonElement>(null);
  const [chartH] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < 640 ? 300 : 500,
  );

  return (
    <div className={cn(
      'rounded-[12px] border transition-all overflow-hidden',
      expanded
        ? 'border-[#22D3EE]/30 bg-[#22D3EE]/[0.03]'
        : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--border-hover)]',
    )}>
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3.5">
        <button
          type="button"
          onClick={e => {
            if (removeRef.current?.contains(e.target as Node)) return;
            onExpand();
          }}
          className="flex-1 flex items-center gap-3 text-left"
        >
          <span className="font-mono text-[18px] font-extrabold tracking-tight">{item.ticker}</span>
          <span className="text-xs text-[var(--text-faint)] font-mono">
            added {formatDate(item.added_at)}
          </span>
          <span className="ml-auto">
            {expanded
              ? <ChevronUp className="w-3.5 h-3.5 text-[#22D3EE]" />
              : <ChevronDown className="w-3.5 h-3.5 text-[var(--text-faint)]" />}
          </span>
        </button>

        <button
          ref={removeRef}
          type="button"
          onClick={onRemove}
          className="w-10 h-10 flex items-center justify-center rounded-md text-[var(--text-faint)] hover:text-[#FF3B5C] hover:bg-[#FF3B5C]/[0.08] transition-colors flex-shrink-0"
          aria-label={`Remove ${item.ticker}`}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-[var(--border-subtle)]">
          <div className="flex flex-col lg:flex-row gap-0">
            {/* Chart */}
            <div className="flex-[7] min-w-0">
              <TradingViewChart ticker={item.ticker} height={chartH} />
            </div>

            {/* Validator panel */}
            <div className="flex-[3] min-w-0 border-t lg:border-t-0 lg:border-l border-[var(--border-subtle)] px-4 py-4 overflow-y-auto" style={{ maxHeight: 'min(500px, 60vh)' }}>
              {!snapshot || snapshot === 'loading' ? (
                <div className="flex items-center gap-2 py-6 text-[var(--text-faint)] text-xs">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#22D3EE]" />
                  Fetching live data…
                </div>
              ) : snapshot === 'error' ? (
                <div className="py-3 flex flex-col gap-2">
                  <p className="text-xs text-[#FF3B5C] flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    Could not load chart data for {item.ticker}
                  </p>
                  <button
                    type="button"
                    onClick={onRetry}
                    className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)] hover:text-[#22D3EE] transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Retry
                  </button>
                </div>
              ) : (
                <TickerSnapshot data={snapshot} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── TickerSnapshot ─────────────────────────────────────────────────────────────

function TickerSnapshot({ data }: { data: TickerResponse }) {
  const [showDetails, setShowDetails] = useState(false);
  const isUp = data.price.dayChangePct >= 0;
  const { passed, checks } = data.trendTemplate;

  const emaChecks = [
    { label: 'Price > 20-EMA',   ok: checks.priceAboveEMA20.passed   },
    { label: 'Price > 50-EMA',   ok: checks.priceAboveEMA50.passed   },
    { label: 'Price > 150-EMA',  ok: checks.priceAboveEMA150.passed  },
    { label: 'Price > 200-EMA',  ok: checks.priceAboveEMA200.passed  },
    { label: '50 > 150-EMA',     ok: checks.ema50AboveEma150.passed  },
    { label: '200-EMA rising',   ok: checks.ema200Uptrending.passed  },
    { label: '150 > 200-EMA',    ok: checks.ema150AboveEma200.passed },
    { label: '50-EMA > 200-SMA', ok: checks.ema50AboveSma200.passed  },
    { label: 'Within 25% of hi', ok: checks.closeTo52wHigh.passed    },
    { label: '30%+ above low',   ok: checks.farFrom52wLow.passed     },
  ];

  const passCount = emaChecks.filter(c => c.ok).length;

  return (
    <div className="flex flex-col gap-4">
      {/* Price */}
      <div className="flex flex-col gap-1">
        <span className="font-mono text-[22px] font-extrabold tracking-tight text-[var(--text-primary)]">
          ${data.price.last.toFixed(2)}
        </span>
        <div className="flex items-center gap-2">
          <span className={cn(
            'font-mono text-xs font-semibold flex items-center gap-1',
            isUp ? 'text-[#10F088]' : 'text-[#FF3B5C]',
          )}>
            {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {isUp ? '+' : ''}{data.price.dayChangePct.toFixed(2)}%
          </span>
          <span className="text-xs font-mono text-[var(--text-faint)]">
            vol {data.volume.ratio.toFixed(1)}× avg
          </span>
        </div>
      </div>

      {/* Trend Template — prominent */}
      <div className={cn(
        'flex items-center justify-between px-3 py-3 rounded-[10px] border',
        passed
          ? 'bg-[#10F088]/[0.06] border-[#10F088]/30'
          : 'bg-[#FF3B5C]/[0.06] border-[#FF3B5C]/25',
      )}>
        <div>
          <div className="text-[9px] uppercase tracking-[0.14em] font-bold text-[var(--text-faint)] mb-0.5">
            Trend Template
          </div>
          <div className={cn(
            'text-[16px] font-extrabold uppercase tracking-wider',
            passed ? 'text-[#10F088]' : 'text-[#FF3B5C]',
          )}>
            {passed ? '✓ Pass' : '✗ Fail'}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[9px] uppercase tracking-[0.14em] font-bold text-[var(--text-faint)] mb-0.5">
            Checks
          </div>
          <div className="font-mono text-[14px] font-bold text-[var(--text-dim)]">
            {passCount}/10
          </div>
        </div>
      </div>

      {/* 52W range + ATH AVWAP */}
      <div className="grid grid-cols-2 gap-2 text-xs font-mono">
        {[
          { label: '52W High',  val: `$${data.range52w.high.toFixed(2)}` },
          { label: '52W Low',   val: `$${data.range52w.low.toFixed(2)}`  },
          { label: 'From High', val: `${data.range52w.distanceFromHigh.toFixed(1)}%` },
          { label: 'From Low',  val: `+${data.range52w.distanceFromLow.toFixed(1)}%` },
          ...(data.ath_avwap != null ? [
            { label: 'ATH AVWAP', val: `$${data.ath_avwap.toFixed(2)}` },
            {
              label: 'vs AVWAP',
              val: (() => {
                const pct = ((data.price.last - data.ath_avwap!) / data.ath_avwap!) * 100;
                return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
              })(),
            },
          ] : []),
        ].map(({ label, val }) => (
          <div key={label} className="flex flex-col gap-0.5 p-2 rounded-[6px] bg-[var(--bg-elevated)]">
            <span className="text-[var(--text-faint)] text-[8px] uppercase tracking-wider">{label}</span>
            <span className="text-[var(--text-dim)] font-semibold text-xs">{val}</span>
          </div>
        ))}
      </div>

      {/* Collapsible: all 10 Trend Template checks */}
      <div>
        <button
          type="button"
          onClick={() => setShowDetails(v => !v)}
          className="flex items-center gap-1.5 text-xs text-[var(--text-faint)] hover:text-[var(--text-secondary)] transition-colors uppercase tracking-wider font-semibold"
        >
          {showDetails
            ? <ChevronUp className="w-3 h-3" />
            : <ChevronDown className="w-3 h-3" />}
          {showDetails ? 'Hide details' : `All 10 checks (${passCount}/10)`}
        </button>

        {showDetails && (
          <div className="mt-2 flex flex-col gap-1.5">
            {emaChecks.map(({ label, ok }) => (
              <div key={label} className="flex items-center gap-2 text-xs">
                <span className={cn(
                  'w-3.5 h-3.5 rounded-sm flex items-center justify-center flex-shrink-0',
                  ok ? 'bg-[#10F088]/25' : 'bg-[#FF3B5C]/20',
                )}>
                  {ok
                    ? <Check className="w-2 h-2 text-[#10F088]" strokeWidth={4} />
                    : <X className="w-2 h-2 text-[#FF3B5C]" strokeWidth={4} />}
                </span>
                <span className={ok ? 'text-[var(--text-dim)]' : 'text-[var(--text-faint)]'}>{label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
