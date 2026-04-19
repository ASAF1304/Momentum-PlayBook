// app/watchlist/page.tsx
//
// Live watchlist: add/remove tickers stored in watchlist_items.
// Clicking a ticker shows a TradingView chart + live EMA/Trend Template snapshot.

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Check, ChevronDown, ChevronUp, Loader2,
  Plus, TrendingDown, TrendingUp, X,
} from 'lucide-react';
import { AppNav } from '@/components/nav/app-nav';
import { GridOverlay } from '@/components/ui/grid-overlay';
import { TradingViewChart } from '@/components/ui/tradingview-chart';
import { supabase, type WatchlistItem } from '@/lib/supabase-client';
import { useAuth } from '@/lib/auth-context';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import type { TickerResponse, TickerErrorResponse } from '@/app/api/ticker/[symbol]/route';

type SnapshotState = TickerResponse | 'loading' | 'error';

export default function WatchlistPage() {
  const { user, loading: authLoading } = useAuth();

  const [items,          setItems]          = useState<WatchlistItem[]>([]);
  const [loadingList,    setLoadingList]    = useState(true);
  const [tickerInput,    setTickerInput]    = useState('');
  const [adding,         setAdding]         = useState(false);
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);
  const [snapshots,      setSnapshots]      = useState<Record<string, SnapshotState>>({});

  // ── Fetch list ─────────────────────────────────────────────────────────────

  const fetchItems = useCallback(async () => {
    if (!user) {
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
  }, [user]);

  useEffect(() => {
    if (!authLoading) void fetchItems();
  }, [fetchItems, authLoading]);

  // ── Add ticker ─────────────────────────────────────────────────────────────

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const sym = tickerInput.trim().toUpperCase();
    if (!sym || !user || adding) return;

    if (items.some(i => i.ticker === sym)) {
      toast({ title: `${sym} already on watchlist`, variant: 'warning' });
      return;
    }

    setAdding(true);
    const { error } = await supabase.from('watchlist_items').insert({
      user_id: user.id,
      ticker: sym,
    });

    if (error) {
      toast({ title: 'Failed to add ticker', body: error.message, variant: 'error' });
    } else {
      setTickerInput('');
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

  const handleExpand = async (ticker: string) => {
    if (expandedTicker === ticker) {
      setExpandedTicker(null);
      return;
    }
    setExpandedTicker(ticker);

    if (snapshots[ticker] && snapshots[ticker] !== 'error') return;

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

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#040507] text-zinc-100">
      <GridOverlay />
      <AppNav />

      <main className="max-w-[1100px] mx-auto px-6 py-10 relative">

        <div className="mb-7">
          <h1 className="text-[20px] font-extrabold tracking-tight mb-1">Watchlist</h1>
          <p className="text-[12px] text-zinc-500">
            Add tickers to track. Click a row to see a live chart, EMA status, and Trend Template.
          </p>
        </div>

        {/* Add form */}
        <form onSubmit={handleAdd} className="flex gap-2.5 mb-7">
          <input
            value={tickerInput}
            onChange={e => setTickerInput(e.target.value.toUpperCase().slice(0, 10))}
            placeholder="TICKER"
            className="flex-1 bg-black/30 border border-white/[0.06] rounded-[10px] px-4 py-3 font-mono text-[18px] font-bold uppercase text-zinc-100 placeholder:text-zinc-700 focus:outline-none focus:border-[#22D3EE] focus:ring-[3px] focus:ring-[#22D3EE]/15 transition"
          />
          <button
            type="submit"
            disabled={adding || !tickerInput.trim()}
            className={cn(
              'flex items-center gap-2 px-5 py-3 rounded-[10px] text-[12px] font-extrabold uppercase tracking-wider transition-all',
              adding || !tickerInput.trim()
                ? 'bg-white/[0.04] text-zinc-600 cursor-not-allowed'
                : 'bg-gradient-to-br from-[#22D3EE] to-[#10F088] text-black shadow-[0_0_20px_rgba(34,211,238,0.25)] hover:brightness-110 hover:-translate-y-px',
            )}
          >
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Add
          </button>
        </form>

        {/* List */}
        {loadingList ? (
          <div className="flex items-center gap-2 py-10 text-zinc-600 text-[13px]">
            <Loader2 className="w-4 h-4 animate-spin text-[#22D3EE]" />
            Loading watchlist…
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-zinc-600 text-[13px]">
            Watchlist is empty. Add a ticker above.
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
  item, expanded, snapshot, onExpand, onRemove,
}: {
  item: WatchlistItem;
  expanded: boolean;
  snapshot: SnapshotState | undefined;
  onExpand: () => void;
  onRemove: () => void;
}) {
  const removeRef = useRef<HTMLButtonElement>(null);

  return (
    <div className={cn(
      'rounded-[12px] border transition-all overflow-hidden',
      expanded
        ? 'border-[#22D3EE]/30 bg-[#22D3EE]/[0.03]'
        : 'border-white/[0.06] bg-white/[0.025] hover:border-white/15',
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
          <span className="text-[10px] text-zinc-600 font-mono">
            added {formatDate(item.added_at)}
          </span>
          <span className="ml-auto">
            {expanded
              ? <ChevronUp className="w-3.5 h-3.5 text-[#22D3EE]" />
              : <ChevronDown className="w-3.5 h-3.5 text-zinc-600" />}
          </span>
        </button>

        <button
          ref={removeRef}
          type="button"
          onClick={onRemove}
          className="w-7 h-7 flex items-center justify-center rounded-md text-zinc-600 hover:text-[#FF3B5C] hover:bg-[#FF3B5C]/[0.08] transition-colors flex-shrink-0"
          aria-label={`Remove ${item.ticker}`}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-white/[0.06]">
          {/* TradingView chart — full bleed, maximum height */}
          <div className="pt-1">
            <TradingViewChart ticker={item.ticker} height={540} />
          </div>

          {/* Snapshot panel */}
          <div className="px-4 pb-4 pt-3">
            {!snapshot || snapshot === 'loading' ? (
              <div className="flex items-center gap-2 py-4 text-zinc-600 text-[12px]">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#22D3EE]" />
                Fetching live data…
              </div>
            ) : snapshot === 'error' ? (
              <div className="py-3 text-[12px] text-[#FF3B5C]">
                Failed to fetch data. Check the ticker or try again.
              </div>
            ) : (
              <TickerSnapshot data={snapshot} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── TickerSnapshot ─────────────────────────────────────────────────────────────

function TickerSnapshot({ data }: { data: TickerResponse }) {
  const isUp = data.price.dayChangePct >= 0;
  const { passed, checks } = data.trendTemplate;

  const emaChecks = [
    { label: 'Price > 20-EMA',  ok: checks.priceAboveEMA20.passed  },
    { label: 'Price > 50-EMA',  ok: checks.priceAboveEMA50.passed  },
    { label: 'Price > 150-EMA', ok: checks.priceAboveEMA150.passed },
    { label: 'Price > 200-EMA', ok: checks.priceAboveEMA200.passed },
    { label: '50 > 150-EMA',    ok: checks.ema50AboveEma150.passed },
    { label: '200-EMA rising',  ok: checks.ema200Uptrending.passed },
  ];

  return (
    <div className="flex flex-col gap-3">
      {/* Price strip */}
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-[24px] font-extrabold tracking-tight">
          ${data.price.last.toFixed(2)}
        </span>
        <span className={cn(
          'font-mono text-[13px] font-semibold flex items-center gap-1',
          isUp ? 'text-[#10F088]' : 'text-[#FF3B5C]',
        )}>
          {isUp ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
          {isUp ? '+' : ''}{data.price.dayChangePct.toFixed(2)}%
        </span>
        <span className="ml-auto text-[10px] font-mono text-zinc-600">
          vol {(data.volume.ratio).toFixed(1)}× avg
        </span>
      </div>

      {/* EMA grid + Trend Template badge */}
      <div className="flex items-start gap-4">
        <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-1.5">
          {emaChecks.map(({ label, ok }) => (
            <div key={label} className="flex items-center gap-1.5 text-[11px]">
              <span className={cn(
                'w-3 h-3 rounded-sm flex items-center justify-center flex-shrink-0',
                ok ? 'bg-[#10F088]/25' : 'bg-[#FF3B5C]/20',
              )}>
                {ok
                  ? <Check className="w-2 h-2 text-[#10F088]" strokeWidth={4} />
                  : <X className="w-2 h-2 text-[#FF3B5C]" strokeWidth={4} />}
              </span>
              <span className={ok ? 'text-zinc-300' : 'text-zinc-600'}>{label}</span>
            </div>
          ))}
        </div>

        <div className={cn(
          'flex flex-col items-center justify-center px-3 py-2.5 rounded-[9px] border min-w-[90px]',
          passed
            ? 'bg-[#10F088]/[0.06] border-[#10F088]/30'
            : 'bg-[#FF3B5C]/[0.06] border-[#FF3B5C]/25',
        )}>
          <span className="text-[9px] uppercase tracking-[0.14em] font-bold text-zinc-600 mb-1">
            Template
          </span>
          <span className={cn(
            'text-[13px] font-extrabold uppercase tracking-wider',
            passed ? 'text-[#10F088]' : 'text-[#FF3B5C]',
          )}>
            {passed ? '✓ Pass' : '✗ Fail'}
          </span>
        </div>
      </div>

      {/* 52W range */}
      <div className="grid grid-cols-4 gap-2 text-[10px] font-mono">
        {[
          { label: '52W High',  val: `$${data.range52w.high.toFixed(2)}` },
          { label: '52W Low',   val: `$${data.range52w.low.toFixed(2)}`  },
          { label: 'From High', val: `${data.range52w.distanceFromHigh.toFixed(1)}%` },
          { label: 'From Low',  val: `+${data.range52w.distanceFromLow.toFixed(1)}%` },
        ].map(({ label, val }) => (
          <div key={label} className="flex flex-col gap-0.5">
            <span className="text-zinc-600 text-[9px] uppercase tracking-wider">{label}</span>
            <span className="text-zinc-300 font-semibold">{val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
