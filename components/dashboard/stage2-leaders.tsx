// components/dashboard/stage2-leaders.tsx
//
// Displays the most recent Stage 2 Leaders scan from the stage2_leaders table.
// Data is populated daily by /api/cron/scan-leaders (FinViz + Minervini filters).

'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react';
import { supabase, type Stage2Leader, type WatchlistItem } from '@/lib/supabase-client';
import { useAuth } from '@/lib/auth-context';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';

interface Stage2LeadersProps {
  onSelectTicker?: (ticker: string) => void;
}

export function Stage2Leaders({ onSelectTicker }: Stage2LeadersProps) {
  const { user } = useAuth();
  const [leaders,    setLeaders]    = useState<Stage2Leader[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [scannedAt,  setScannedAt]  = useState<string | null>(null);
  const [watchlist,  setWatchlist]  = useState<Set<string>>(new Set());
  const [adding,     setAdding]     = useState<Set<string>>(new Set());

  const fetchLeaders = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('stage2_leaders')
      .select('*')
      .order('rank', { ascending: true })
      .limit(20);

    if (!error && data) {
      setLeaders(data as Stage2Leader[]);
      if (data.length > 0) setScannedAt((data[0] as Stage2Leader).scanned_at);
    }
    setLoading(false);
  }, []);

  const fetchWatchlist = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('watchlist_items')
      .select('ticker');
    if (data) setWatchlist(new Set((data as Pick<WatchlistItem, 'ticker'>[]).map(w => w.ticker)));
  }, [user]);

  useEffect(() => {
    void fetchLeaders();
    void fetchWatchlist();
  }, [fetchLeaders, fetchWatchlist]);

  const handleAddToWatchlist = async (ticker: string) => {
    if (!user || adding.has(ticker)) return;

    if (watchlist.has(ticker)) {
      toast({ title: `${ticker} already on watchlist`, variant: 'warning' });
      return;
    }

    setAdding(prev => new Set(prev).add(ticker));
    const { error } = await supabase.from('watchlist_items').insert({ user_id: user.id, ticker });
    if (error) {
      toast({ title: `Failed to add ${ticker}`, body: error.message, variant: 'error' });
    } else {
      setWatchlist(prev => new Set(prev).add(ticker));
      toast({ title: `${ticker} added to watchlist`, variant: 'success' });
    }
    setAdding(prev => { const s = new Set(prev); s.delete(ticker); return s; });
  };

  const formattedScan = scannedAt
    ? new Date(scannedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div
      className="rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface)]"
      style={{ boxShadow: 'var(--shadow-card), var(--inner-highlight)' }}
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-[var(--border-subtle)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-bold tracking-tight text-[var(--text-primary)]">
              Stage 2 Leaders — Today&apos;s Strongest Setups
            </h2>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
              Stocks passing Minervini&apos;s Trend Template · Ranked by relative strength
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <span className="text-[9px] uppercase tracking-[0.16em] font-bold px-2 py-0.5 rounded bg-[#22D3EE]/[0.08] text-[#22D3EE] border border-[#22D3EE]/20">
              Updated daily
            </span>
            <span className="text-[9px] text-[var(--text-faint)]">15-min delayed data</span>
          </div>
        </div>
        {formattedScan && (
          <p className="text-[10px] text-[var(--text-faint)] mt-2 font-mono">
            Last scan: {formattedScan}
          </p>
        )}
      </div>

      {/* Body */}
      <div className="p-3">
        {loading ? (
          <div className="flex items-center gap-2 py-8 px-2 text-[var(--text-faint)] text-[12px]">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#22D3EE]" />
            Loading leaders…
          </div>
        ) : leaders.length === 0 ? (
          <EmptyState onRefresh={fetchLeaders} />
        ) : (
          <div className="flex flex-col gap-1">
            {leaders.map(leader => (
              <LeaderRow
                key={leader.id}
                leader={leader}
                onWatchlist={watchlist.has(leader.ticker)}
                adding={adding.has(leader.ticker)}
                onAdd={() => void handleAddToWatchlist(leader.ticker)}
                onSelect={() => onSelectTicker?.(leader.ticker)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Disclaimer */}
      <div className="px-5 pb-4 pt-1">
        <p className="text-[9px] text-[var(--text-faint)] leading-relaxed">
          Not investment advice. Stocks listed pass Minervini Trend Template criteria at time of scan.
          Always perform your own due diligence. Market data delayed by 15 minutes.
        </p>
      </div>
    </div>
  );
}

// ── LeaderRow ──────────────────────────────────────────────────────────────────

function LeaderRow({
  leader, onWatchlist, adding, onAdd, onSelect,
}: {
  leader: Stage2Leader;
  onWatchlist: boolean;
  adding: boolean;
  onAdd: () => void;
  onSelect: () => void;
}) {
  const isUp = (leader.change_pct ?? 0) >= 0;

  return (
    <div className="flex items-center gap-2 px-2 py-2.5 rounded-[8px] hover:bg-[var(--bg-elevated)] transition-colors group">
      {/* Rank */}
      <span className="w-5 text-[9px] font-mono text-[var(--text-faint)] text-right flex-shrink-0">
        {leader.rank ?? '—'}
      </span>

      {/* Ticker + company — clickable to pre-fill validator */}
      <button
        type="button"
        onClick={onSelect}
        className="flex-1 text-left min-w-0"
      >
        <div className="font-mono text-[14px] font-extrabold tracking-tight text-[var(--text-primary)] group-hover:text-[#22D3EE] transition-colors">
          {leader.ticker}
        </div>
        {leader.company && (
          <div className="text-[10px] text-[var(--text-faint)] truncate">{leader.company}</div>
        )}
      </button>

      {/* Price */}
      <div className="text-right flex-shrink-0 w-16">
        <div className="font-mono text-[12px] font-semibold text-[var(--text-dim)]">
          {leader.price != null ? `$${leader.price.toFixed(2)}` : '—'}
        </div>
        {leader.market_cap && (
          <div className="text-[9px] text-[var(--text-faint)] font-mono">{leader.market_cap}</div>
        )}
      </div>

      {/* Change % */}
      <div className={cn(
        'flex items-center gap-0.5 font-mono text-[11px] font-semibold flex-shrink-0 w-14 justify-end',
        isUp ? 'text-[#10F088]' : 'text-[#FF3B5C]',
      )}>
        {isUp
          ? <TrendingUp className="w-2.5 h-2.5" />
          : <TrendingDown className="w-2.5 h-2.5" />}
        {leader.change_pct != null
          ? `${isUp ? '+' : ''}${leader.change_pct.toFixed(2)}%`
          : '—'}
      </div>

      {/* Add to Watchlist */}
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onAdd(); }}
        disabled={adding || onWatchlist}
        title={onWatchlist ? 'Already on watchlist' : 'Add to watchlist'}
        className={cn(
          'flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-[6px] text-[9px] font-bold uppercase tracking-wider transition-all',
          onWatchlist
            ? 'bg-[#10F088]/10 text-[#10F088] border border-[#10F088]/20 cursor-default'
            : adding
              ? 'bg-[var(--bg-elevated)] text-[var(--text-faint)] cursor-not-allowed'
              : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:bg-[#22D3EE]/10 hover:text-[#22D3EE] border border-transparent hover:border-[#22D3EE]/20',
        )}
      >
        {adding
          ? <Loader2 className="w-2.5 h-2.5 animate-spin" />
          : onWatchlist
            ? '✓ Watching'
            : <><Plus className="w-2.5 h-2.5" />Watch</>}
      </button>
    </div>
  );
}

function EmptyState({ onRefresh }: { onRefresh: () => void }) {
  return (
    <div className="py-10 flex flex-col items-center text-center gap-3">
      <p className="text-[13px] font-semibold text-[var(--text-secondary)]">No leaders yet</p>
      <p className="text-[11px] text-[var(--text-muted)] max-w-[280px]">
        The daily scan runs at 4:15 PM ET on trading days. Check back after market close,
        or trigger the scan manually.
      </p>
      <button
        type="button"
        onClick={onRefresh}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-[var(--border-subtle)] text-[11px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-all"
      >
        <RefreshCw className="w-3 h-3" /> Refresh
      </button>
    </div>
  );
}
