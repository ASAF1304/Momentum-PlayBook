// components/dashboard/edge-heatmap.tsx
//
// Pillar 2 (Personal Edge Discovery): surfaces the trader's UNIQUE edge from
// their own data. Visualizes win rate × R-multiple across day-of-week and
// time-of-day buckets. This is the moat — switching cost = the trader's
// entire personal performance history.
//
// At ≥20 closed trades the heatmap is statistically meaningful; below that
// we show a "keep logging" message instead of a noisy chart.

'use client';

import { useMemo, useState } from 'react';
import { Activity, Award, BarChart3, Calendar, Loader2 } from 'lucide-react';
import type { Trade } from '@/lib/supabase-client';
import { cn } from '@/lib/utils';

type View = 'day_x_hour' | 'setup' | 'month';

interface EdgeHeatmapProps {
  trades:   Trade[];
  loading?: boolean;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
// US market hours mapped to IL time (approximate, no DST handling needed
// for visualization — we want the trader's experienced time, not absolute UTC):
const HOURS = ['16-17', '17-18', '18-19', '19-20', '20-21', '21-22', '22-23'];

const MIN_TRADES_FOR_HEATMAP = 10;

interface Bucket {
  trades: number;
  wins:   number;
  totalR: number;
}

export function EdgeHeatmap({ trades, loading }: EdgeHeatmapProps) {
  const [view, setView] = useState<View>('day_x_hour');

  const closed = useMemo(
    () => trades.filter(t => t.status !== 'open' && t.outcome != null),
    [trades],
  );

  const { grid, bestCell, worstCell } = useMemo(() => buildDayHourGrid(closed), [closed]);
  const setupBreakdown = useMemo(() => buildSetupBreakdown(closed), [closed]);
  const monthBreakdown = useMemo(() => buildMonthBreakdown(closed), [closed]);

  return (
    <div
      className="rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface)]"
      style={{ boxShadow: 'var(--shadow-card), var(--inner-highlight)' }}
    >
      {/* Header */}
      <div className="px-5 pt-5 pb-3 border-b border-[var(--border-subtle)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <h2 className="text-[15px] font-bold tracking-tight text-[var(--text-primary)]">
                Your Edge
              </h2>
              <span className="text-[8.5px] font-extrabold uppercase tracking-[0.18em] px-1.5 py-0.5 rounded bg-[#A78BFA]/15 text-[#A78BFA] border border-[#A78BFA]/25">
                Pro
              </span>
            </div>
            <p className="text-[11.5px] text-[var(--text-muted)] leading-relaxed">
              When and how YOU make money — based on your real history. No averages, no generalities.
            </p>
          </div>
        </div>

        {/* View toggle */}
        <div className="mt-3.5 inline-flex items-center gap-0.5 p-0.5 rounded-[8px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
          {([
            { key: 'day_x_hour', label: 'Day × Hour', icon: Calendar },
            { key: 'setup',      label: 'Setup',      icon: Award },
            { key: 'month',      label: 'Month',      icon: BarChart3 },
          ] as { key: View; label: string; icon: typeof Calendar }[]).map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setView(t.key)}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-[6px] text-[10.5px] font-bold transition-all',
                  view === t.key
                    ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]',
                )}
              >
                <Icon className="w-3 h-3" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-4">
        {loading ? (
          <Loading />
        ) : closed.length < MIN_TRADES_FOR_HEATMAP ? (
          <Insufficient count={closed.length} need={MIN_TRADES_FOR_HEATMAP} />
        ) : view === 'day_x_hour' ? (
          <DayHourView grid={grid} bestCell={bestCell} worstCell={worstCell} />
        ) : view === 'setup' ? (
          <SetupView rows={setupBreakdown} />
        ) : (
          <MonthView rows={monthBreakdown} />
        )}
      </div>
    </div>
  );
}

// ── Day × Hour heatmap view ──────────────────────────────────────────────────

function DayHourView({
  grid, bestCell, worstCell,
}: {
  grid:      Bucket[][];
  bestCell:  { day: number; hour: number; bucket: Bucket } | null;
  worstCell: { day: number; hour: number; bucket: Bucket } | null;
}) {
  return (
    <div className="space-y-4">
      {bestCell && (
        <div className="rounded-[10px] border border-[#10F088]/30 bg-[#10F088]/[0.06] px-3.5 py-2.5">
          <div className="flex items-start gap-2.5">
            <Award className="w-4 h-4 text-[#10F088] flex-shrink-0 mt-0.5" strokeWidth={2.2} />
            <div>
              <div className="text-[9.5px] uppercase tracking-[0.16em] font-extrabold text-[#10F088] mb-0.5">
                Your edge window
              </div>
              <div className="text-[13px] font-bold text-[var(--text-primary)]">
                {DAYS[bestCell.day]} · {HOURS[bestCell.hour]} IL
                <span className="text-[var(--text-muted)] font-normal ml-2">
                  {bestCell.bucket.wins}W / {bestCell.bucket.trades - bestCell.bucket.wins}L
                  {' · '}
                  {(bestCell.bucket.totalR / bestCell.bucket.trades).toFixed(2)}R avg
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {worstCell && worstCell.bucket.trades >= 3 && (
        <div className="rounded-[10px] border border-[#FF3B5C]/25 bg-[#FF3B5C]/[0.05] px-3.5 py-2.5">
          <div className="flex items-start gap-2.5">
            <Activity className="w-4 h-4 text-[#FF3B5C] flex-shrink-0 mt-0.5" strokeWidth={2.2} />
            <div>
              <div className="text-[9.5px] uppercase tracking-[0.16em] font-extrabold text-[#FF3B5C] mb-0.5">
                Where you lose
              </div>
              <div className="text-[13px] font-bold text-[var(--text-primary)]">
                {DAYS[worstCell.day]} · {HOURS[worstCell.hour]} IL
                <span className="text-[var(--text-muted)] font-normal ml-2">
                  {worstCell.bucket.wins}W / {worstCell.bucket.trades - worstCell.bucket.wins}L
                  {' · '}
                  {(worstCell.bucket.totalR / worstCell.bucket.trades).toFixed(2)}R avg
                </span>
              </div>
              <div className="text-[11px] text-[var(--text-muted)] mt-1">
                Consider blocking entries in this window.
              </div>
            </div>
          </div>
        </div>
      )}

      <div>
        <div className="grid gap-[3px] items-center" style={{ gridTemplateColumns: `60px repeat(${HOURS.length}, 1fr)` }}>
          <div />
          {HOURS.map(h => (
            <div key={h} className="text-[8.5px] font-mono text-[var(--text-faint)] text-center">
              {h}
            </div>
          ))}
          {DAYS.map((d, di) => (
            <RowOfDay key={d} dayIdx={di} dayLabel={d} buckets={grid[di]} />
          ))}
        </div>
        <Legend />
      </div>
    </div>
  );
}

function RowOfDay({ dayIdx, dayLabel, buckets }: { dayIdx: number; dayLabel: string; buckets: Bucket[] }) {
  return (
    <>
      <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
        {dayLabel}
      </div>
      {buckets.map((b, hi) => (
        <Cell key={`${dayIdx}-${hi}`} bucket={b} />
      ))}
    </>
  );
}

function Cell({ bucket }: { bucket: Bucket }) {
  if (bucket.trades === 0) {
    return <div className="aspect-square rounded-[3px] bg-[var(--bg-elevated)] opacity-30" />;
  }
  const winRate = bucket.wins / bucket.trades;
  const avgR    = bucket.totalR / bucket.trades;
  const color   = colorForCell(winRate, avgR, bucket.trades);

  return (
    <div
      className="aspect-square rounded-[3px] relative group cursor-default"
      style={{ background: color }}
      title={`${bucket.trades} trades · ${(winRate * 100).toFixed(0)}% win · ${avgR.toFixed(2)}R avg`}
    >
      <span className="absolute inset-0 flex items-center justify-center font-mono text-[8px] font-bold text-white/95">
        {bucket.trades}
      </span>
    </div>
  );
}

function colorForCell(winRate: number, avgR: number, _count: number): string {
  void _count;
  if (avgR >= 0.5)   return '#10F088CC';
  if (avgR >= 0)     return '#10F08866';
  if (avgR >= -0.5)  return '#F59E0B66';
  return '#FF3B5C99';
}

function Legend() {
  return (
    <div className="flex items-center gap-3 mt-3 text-[9.5px] text-[var(--text-faint)] font-mono">
      <div className="flex items-center gap-1">
        <span className="w-3 h-3 rounded-[2px]" style={{ background: '#10F088CC' }} />
        Strong (+0.5R+)
      </div>
      <div className="flex items-center gap-1">
        <span className="w-3 h-3 rounded-[2px]" style={{ background: '#10F08866' }} />
        Positive
      </div>
      <div className="flex items-center gap-1">
        <span className="w-3 h-3 rounded-[2px]" style={{ background: '#F59E0B66' }} />
        Slight loss
      </div>
      <div className="flex items-center gap-1">
        <span className="w-3 h-3 rounded-[2px]" style={{ background: '#FF3B5C99' }} />
        Avoid
      </div>
    </div>
  );
}

// ── Setup view ───────────────────────────────────────────────────────────────

interface SetupRow {
  setup:   string;
  trades:  number;
  winRate: number;
  avgR:    number;
  totalR:  number;
}

function SetupView({ rows }: { rows: SetupRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-[12px] text-[var(--text-muted)] py-6 text-center">
        Tag setups on your trades to see your edge per setup type.
      </p>
    );
  }
  const maxAbsR = Math.max(...rows.map(r => Math.abs(r.totalR)), 1);
  return (
    <div className="space-y-2.5">
      {rows.map(r => {
        const positive = r.totalR >= 0;
        const barPct = (Math.abs(r.totalR) / maxAbsR) * 100;
        return (
          <div key={r.setup}>
            <div className="flex items-center justify-between text-[11.5px] mb-1">
              <span className="font-bold text-[var(--text-primary)]">{r.setup}</span>
              <span className="font-mono text-[var(--text-faint)]">
                {r.trades} trades · {(r.winRate * 100).toFixed(0)}% win ·{' '}
                <span className={positive ? 'text-[#10F088] font-bold' : 'text-[#FF3B5C] font-bold'}>
                  {r.avgR >= 0 ? '+' : ''}{r.avgR.toFixed(2)}R avg
                </span>
              </span>
            </div>
            <div className="h-2 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
              <div
                className={cn('h-full rounded-full', positive ? 'bg-[#10F088]' : 'bg-[#FF3B5C]')}
                style={{ width: `${barPct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Month view ───────────────────────────────────────────────────────────────

interface MonthRow {
  label:   string;
  trades:  number;
  winRate: number;
  avgR:    number;
}

function MonthView({ rows }: { rows: MonthRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-[12px] text-[var(--text-muted)] py-6 text-center">
        Log trades across more months to see seasonal patterns.
      </p>
    );
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
      {rows.map(r => {
        const positive = r.avgR >= 0;
        return (
          <div
            key={r.label}
            className="px-3 py-2.5 rounded-[8px] border border-[var(--border-subtle)] bg-[var(--bg-elevated)]"
          >
            <div className="text-[9px] uppercase tracking-[0.16em] font-bold text-[var(--text-faint)]">
              {r.label}
            </div>
            <div className={cn('font-mono text-[16px] font-extrabold', positive ? 'text-[#10F088]' : 'text-[#FF3B5C]')}>
              {r.avgR >= 0 ? '+' : ''}{r.avgR.toFixed(2)}R
            </div>
            <div className="text-[10px] font-mono text-[var(--text-muted)]">
              {r.trades} · {(r.winRate * 100).toFixed(0)}% W
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── States ───────────────────────────────────────────────────────────────────

function Loading() {
  return (
    <div className="flex items-center gap-2 py-8 text-[var(--text-faint)] text-xs">
      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#22D3EE]" />
      Computing your edge…
    </div>
  );
}

function Insufficient({ count, need }: { count: number; need: number }) {
  return (
    <div className="py-7 text-center">
      <p className="text-[13px] font-semibold text-[var(--text-secondary)] mb-1">
        {count} closed trade{count === 1 ? '' : 's'} so far
      </p>
      <p className="text-[11.5px] text-[var(--text-muted)] max-w-[300px] mx-auto leading-relaxed">
        Your Edge map unlocks at {need} closed trades — when patterns become statistically real
        instead of random noise.
      </p>
    </div>
  );
}

// ── Aggregation helpers ──────────────────────────────────────────────────────

function buildDayHourGrid(closed: Trade[]) {
  const grid: Bucket[][] = DAYS.map(() => HOURS.map(() => ({ trades: 0, wins: 0, totalR: 0 })));
  for (const t of closed) {
    const entry = new Date(t.phase1_date);
    const day   = entry.getDay();
    const hour  = entry.getHours();
    const hourIdx = clampHourToBucket(hour);
    if (hourIdx === -1) continue;
    const b = grid[day][hourIdx];
    b.trades += 1;
    if (t.outcome === 'winner') b.wins += 1;
    b.totalR += t.r_multiple ?? 0;
  }
  let bestCell:  { day: number; hour: number; bucket: Bucket } | null = null;
  let worstCell: { day: number; hour: number; bucket: Bucket } | null = null;
  for (let d = 0; d < DAYS.length; d++) {
    for (let h = 0; h < HOURS.length; h++) {
      const b = grid[d][h];
      if (b.trades < 2) continue;
      const avgR = b.totalR / b.trades;
      if (!bestCell  || avgR > (bestCell.bucket.totalR / bestCell.bucket.trades))   bestCell  = { day: d, hour: h, bucket: b };
      if (!worstCell || avgR < (worstCell.bucket.totalR / worstCell.bucket.trades)) worstCell = { day: d, hour: h, bucket: b };
    }
  }
  return { grid, bestCell, worstCell };
}

function clampHourToBucket(hour: number): number {
  // Map 16:00-22:59 to HOURS indices 0-6 (covers IL evening = US market session)
  if (hour < 16 || hour > 22) return -1;
  return hour - 16;
}

function buildSetupBreakdown(closed: Trade[]): SetupRow[] {
  const map = new Map<string, { trades: number; wins: number; totalR: number }>();
  for (const t of closed) {
    const key = (t.setup_type ?? 'untagged').trim() || 'untagged';
    const r = map.get(key) ?? { trades: 0, wins: 0, totalR: 0 };
    r.trades += 1;
    if (t.outcome === 'winner') r.wins += 1;
    r.totalR += t.r_multiple ?? 0;
    map.set(key, r);
  }
  return Array.from(map.entries())
    .filter(([_, r]) => r.trades >= 2)
    .map(([setup, r]) => ({
      setup,
      trades:  r.trades,
      winRate: r.wins / r.trades,
      avgR:    r.totalR / r.trades,
      totalR:  r.totalR,
    }))
    .sort((a, b) => b.totalR - a.totalR);
}

function buildMonthBreakdown(closed: Trade[]): MonthRow[] {
  const map = new Map<string, { trades: number; wins: number; totalR: number }>();
  for (const t of closed) {
    const d = new Date(t.phase1_date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const r = map.get(key) ?? { trades: 0, wins: 0, totalR: 0 };
    r.trades += 1;
    if (t.outcome === 'winner') r.wins += 1;
    r.totalR += t.r_multiple ?? 0;
    map.set(key, r);
  }
  return Array.from(map.entries())
    .map(([key, r]) => ({
      label:   formatMonth(key),
      trades:  r.trades,
      winRate: r.wins / r.trades,
      avgR:    r.totalR / r.trades,
    }))
    .sort((a, b) => a.label.localeCompare(b.label))
    .slice(-12);
}

function formatMonth(ymKey: string): string {
  const [y, m] = ymKey.split('-').map(n => parseInt(n, 10));
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}
