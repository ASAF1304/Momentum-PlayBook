// components/validator/pre-trade-validator.tsx
//
// Pre-Trade Validator — CAN SLIM / Minervini strict methodology.
// Layout: Left = Trend Template + Gates + Blockers | Right = Ticker + Sizer + Submit.
// Hard rules:
//   • Stop loss NEVER > 8% (absolute cap).
//   • Stage 2 + VCP both required — failing either triggers REJECTED banner.
//   • Trend Template must pass before the trade is allowed.

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, BookOpen, Calendar, Check, Clock, Info,
  Loader2, ShieldCheck, Target, TrendingDown, TrendingUp, X, Zap,
} from 'lucide-react';
import { calculatePosition, type PositionSizerResult } from '@/lib/position-sizer';
import type { TickerResponse, TickerErrorResponse } from '@/app/api/ticker/[symbol]/route';
import type { StopCandidate, StopType } from '@/lib/stop-calculator';
import {
  GATE_FAILURES, getMindsetQuote, getGreenLightMessage, type GateKey,
} from '@/lib/mindset-engine';
import { cn } from '@/lib/utils';

// ── Stop distance hard cap (CAN SLIM / Minervini absolute rule) ────────────────
const MAX_STOP_PCT = 8;

// ── Gate keys: core GateKey + the 2 new CAN SLIM-specific gates ───────────────
type AllGateKey = GateKey | 'clear_pivot' | 'earnings_safe';

// ── Stop label mapping: API types → user-facing CAN SLIM labels ───────────────
const STOP_LABEL: Partial<Record<StopType, string>> = {
  below_ema50:            'Violation of 50-Day EMA',
  below_ema20:            'Violation of 20-Day EMA (Trailing)',
  below_swing_low:        'Break below recent Pivot / Handle Low',
  below_pivot_day_low:    'Break below Pivot Day Low (Minervini)',
  below_7_8_pct:          "O'Neil 8% Hard Stop",
  below_base_low:         'Break below Base Low',
  below_last_higher_low:  'Break below Last Higher Low (Stage 2)',
};

// ── Checklist gates ────────────────────────────────────────────────────────────
interface ManualGate {
  key: AllGateKey;
  label: string;
  sublabel: string;
  icon: typeof Check;
  isCritical?: boolean;
}

const MANUAL_GATES: ManualGate[] = [
  {
    key:        'stage2',
    label:      'Price > 50 SMA & 200 SMA',
    sublabel:   '50 SMA above 200 SMA; price in Stage 2 uptrend — not basing, not topping',
    icon:       TrendingUp,
    isCritical: true,
  },
  {
    key:        'vcp_confirmed',
    label:      'VCP Characteristics (Volume dry-up on right)',
    sublabel:   'Volatility contracts left→right, volume dries up at pivot — no wide-and-loose bars',
    icon:       ShieldCheck,
    isCritical: true,
  },
  {
    key:        'clear_pivot',
    label:      'Clear Breakout Pivot',
    sublabel:   'Well-defined pivot point with tight price action; handle or base shelf is clean',
    icon:       Target,
  },
  {
    key:        'earnings_safe',
    label:      'Earnings Date is Safe (Not Imminent)',
    sublabel:   'No earnings report within the next 3–4 weeks — never buy before earnings',
    icon:       Calendar,
  },
  {
    key:        'above_emas',
    label:      'Price above 20-EMA, 50-EMA, 200-EMA',
    sublabel:   'Institutional support intact — riding all three moving averages',
    icon:       Zap,
  },
  {
    key:        'rs_above_80',
    label:      'IBD RS Rating > 80',
    sublabel:   'Leader, not a laggard — 90+ preferred for A+ setups',
    icon:       Target,
  },
  {
    key:        'market_uptrend',
    label:      'Market in confirmed uptrend',
    sublabel:   'S&P / Nasdaq above key MAs, no distribution cluster in last 4 weeks',
    icon:       BookOpen,
  },
];

// ── Component ──────────────────────────────────────────────────────────────────

interface PreTradeValidatorProps {
  accountSize: number;
  maxStopDistancePct?: number;
  maxPortfolioRiskPct?: number;
  getNow?: () => Date;
  onSubmit?: (payload: {
    ticker: string;
    entry: number;
    stop: number;
    sizing: Extract<PositionSizerResult, { status: 'ok' }>;
    tickerData: TickerResponse;
    amountInvested: number;
    isWhatIf: boolean;
  }) => void;
}

export function PreTradeValidator({
  accountSize,
  maxStopDistancePct,
  maxPortfolioRiskPct,
  getNow = () => new Date(),
  onSubmit,
}: PreTradeValidatorProps) {
  const [ticker, setTicker] = useState('NVDA');
  const [entry,  setEntry]  = useState<string>('');
  const [stop,   setStop]   = useState<string>('');
  const [amountInvested, setAmountInvested] = useState<string>('');

  const [gates, setGates] = useState<Record<AllGateKey, boolean>>({
    stage2:           false,
    above_emas:       false,
    rs_above_80:      false,
    vcp_confirmed:    false,
    market_uptrend:   false,
    clear_pivot:      false,
    earnings_safe:    false,
    time_of_day:      true,
    stop_under_10pct: true,
    volume_spike:     false,
  });

  const [data,    setData]    = useState<TickerResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef    = useRef<AbortController | null>(null);

  const fetchTicker = useCallback(async (sym: string) => {
    if (!/^[A-Z][A-Z0-9.-]{0,9}$/.test(sym)) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(`/api/ticker/${sym}`, { signal: controller.signal });
      const body = await res.json();
      if (!res.ok) {
        setError((body as TickerErrorResponse).error);
        setData(null);
        return;
      }
      const td = body as TickerResponse;
      setData(td);
      setEntry(td.price.last.toFixed(2));
      if (td.stops.recommended) setStop(td.stops.recommended.price.toFixed(2));
      else setStop('');
      const emasOk =
        td.trendTemplate.checks.priceAboveEMA20.passed &&
        td.trendTemplate.checks.priceAboveEMA50.passed &&
        td.trendTemplate.checks.priceAboveEMA200.passed;
      setGates(g => ({ ...g, above_emas: emasOk, volume_spike: td.volumeCheck.spikeOnBreakout }));
    } catch (err) {
      if ((err as { name?: string }).name === 'AbortError') return;
      setError('Network error. Try again in a moment.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (ticker.length < 1) return;
    debounceRef.current = setTimeout(() => void fetchTicker(ticker), 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [ticker, fetchTicker]);

  const sizing = useMemo<PositionSizerResult>(() =>
    calculatePosition({
      accountSize,
      entryPrice: parseFloat(entry),
      stopPrice:  parseFloat(stop),
      maxStopDistancePct,
      maxPortfolioRiskPct,
    }),
  [accountSize, entry, stop, maxStopDistancePct, maxPortfolioRiskPct]);

  useEffect(() => {
    setGates(g => ({ ...g, stop_under_10pct: sizing.status === 'ok' }));
  }, [sizing.status]);

  const now        = getNow();
  const afterClose = now.getHours() >= 20;
  useEffect(() => {
    setGates(g => ({ ...g, time_of_day: afterClose }));
  }, [afterClose]);

  const stopDistPct    = sizing.status === 'ok' ? Math.abs(sizing.stopDistancePct) : null;
  const stopExceedsMax = stopDistPct !== null && stopDistPct > MAX_STOP_PCT;

  const failedGates  = (Object.keys(gates) as AllGateKey[]).filter(k => !gates[k]);
  const criticalFail = !gates.stage2 || !gates.vcp_confirmed;
  const allGreen     = failedGates.length === 0 && !!data && sizing.status === 'ok' && !stopExceedsMax;
  // canSubmit: minimum data present to log anything (regular or what-if)
  const canSubmit    = !!data && sizing.status === 'ok';

  const quoteSeed    = now.getDate();
  const mindsetQuote = useMemo(() => getMindsetQuote(quoteSeed), [quoteSeed]);
  const greenLight   = useMemo(() => getGreenLightMessage(quoteSeed), [quoteSeed]);

  const handleSubmit = () => {
    if (!canSubmit || sizing.status !== 'ok' || !data) return;
    onSubmit?.({
      ticker: ticker.toUpperCase(),
      entry:  parseFloat(entry),
      stop:   parseFloat(stop),
      sizing,
      tickerData: data,
      amountInvested: parseFloat(amountInvested) || sizing.totalNotional,
      isWhatIf: !allGreen,
    });
  };

  const nowDisplay = now.toTimeString().slice(0, 5);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

      {/* ══════════════ LEFT: Trend Template + Checklist + Feedback ══════════════ */}
      <div className="flex flex-col gap-5">

        <div>
          <h2 className="text-[17px] font-bold tracking-tight mb-1">Pre-Trade Checklist</h2>
          <p className="text-[12px] text-[var(--text-muted)] leading-relaxed">
            Every gate must be green. Failing Stage 2 or VCP rejects the trade outright.
          </p>
        </div>

        {/* ── Trend Template — most prominent item on left col ─────────── */}
        {data && <EMAPanel data={data} />}

        {/* ── REJECTED banner (Stage 2 / VCP critical failure) ─────────── */}
        {data && criticalFail && (
          <div className="flex items-center gap-3 px-4 py-3.5 rounded-[10px] bg-[#FF3B5C]/10 border-2 border-[#FF3B5C]/50">
            <AlertTriangle className="w-5 h-5 text-[#FF3B5C] flex-shrink-0" />
            <div>
              <p className="text-[13px] font-extrabold text-[#FF3B5C] uppercase tracking-wider leading-tight">
                REJECTED: Fails Stage 2 / VCP Criteria
              </p>
              <p className="text-[11px] text-[#FF3B5C]/70 mt-0.5">
                {!gates.stage2 && !gates.vcp_confirmed
                  ? 'Price not in Stage 2 and VCP not confirmed.'
                  : !gates.stage2
                    ? 'Stock not in a Stage 2 uptrend — wait for proper base.'
                    : 'VCP structure not confirmed — wait for volume dry-up at pivot.'}
              </p>
            </div>
          </div>
        )}

        {/* ── 7-gate checklist ─────────────────────────────────────────── */}
        <div>
          <div className="flex items-center gap-1.5 mb-2 text-[10px] uppercase tracking-[0.14em] font-bold text-[var(--text-muted)]">
            <span>CAN SLIM Gates</span>
            <span className="flex-1 h-px bg-[var(--divider)]" />
            <span className="text-[var(--text-faint)]">click to toggle</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {MANUAL_GATES.map(gate => {
              const Icon    = gate.icon;
              const checked = gates[gate.key];
              return (
                <button
                  key={gate.key}
                  type="button"
                  onClick={() => setGates(g => ({ ...g, [gate.key]: !g[gate.key] }))}
                  className={cn(
                    'flex items-start gap-3 px-3 py-[10px] border rounded-[9px] text-left transition-all',
                    checked
                      ? 'bg-[#10F088]/[0.04] border-[#10F088]/30'
                      : gate.isCritical
                        ? 'bg-[#FF3B5C]/[0.03] border-[#FF3B5C]/20 hover:border-[#FF3B5C]/35'
                        : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] hover:border-[var(--border-hover)]',
                  )}
                >
                  <span className={cn(
                    'w-[18px] h-[18px] rounded-[5px] border-[1.5px] flex items-center justify-center flex-shrink-0 mt-0.5 transition-all',
                    checked
                      ? 'bg-[#10F088] border-[#10F088] shadow-[0_0_10px_rgba(16,240,136,0.5)]'
                      : gate.isCritical ? 'border-[#FF3B5C]/40' : 'border-[var(--border-hover)]',
                  )}>
                    {checked && <Check className="w-2.5 h-2.5 text-black" strokeWidth={3.5} />}
                  </span>
                  <Icon className={cn(
                    'w-3.5 h-3.5 flex-shrink-0 mt-1',
                    checked ? 'text-[#10F088]' : gate.isCritical ? 'text-[#FF3B5C]/50' : 'text-[var(--text-faint)]',
                  )} />
                  <div className="flex-1 min-w-0">
                    <div className={cn(
                      'text-[12px] font-semibold',
                      gate.isCritical && !checked ? 'text-[#FF3B5C]/80' : '',
                    )}>
                      {gate.label}
                    </div>
                    <div className="text-[10px] text-[var(--text-muted)] leading-snug">{gate.sublabel}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Auto gates ───────────────────────────────────────────────── */}
        {data && (
          <AutoGatesPanel
            timeGate={gates.time_of_day}
            afterClose={afterClose}
            nowDisplay={nowDisplay}
            volumeGate={gates.volume_spike}
            volumeDetail={data.volumeCheck.detail}
            onToggleTime={()  => setGates(g => ({ ...g, time_of_day:  !g.time_of_day  }))}
            onToggleVolume={() => setGates(g => ({ ...g, volume_spike: !g.volume_spike }))}
          />
        )}

        {/* ── Blockers — plain technical facts, no quotes ───────────────── */}
        {data && !allGreen && (
          <BlockersPanel
            gates={gates}
            failedGates={failedGates}
            stopExceedsMax={stopExceedsMax}
            stopDistPct={stopDistPct}
          />
        )}

        {/* ── Green light ───────────────────────────────────────────────── */}
        {data && allGreen && (
          <div className="p-4 rounded-[12px] border border-[#10F088]/40 bg-gradient-to-br from-[#10F088]/[0.08] to-[#22D3EE]/[0.04] shadow-[0_0_32px_rgba(16,240,136,0.15)]">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-[#10F088]/20 border border-[#10F088]/50 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-[0_0_14px_rgba(16,240,136,0.4)]">
                <Check className="w-4 h-4 text-[#10F088]" strokeWidth={3} />
              </div>
              <div className="flex-1">
                <h3 className="text-[14px] font-extrabold tracking-tight text-[#10F088] [text-shadow:0_0_12px_rgba(16,240,136,0.45)] mb-1 uppercase">
                  Green Light · {greenLight.headline}
                </h3>
                <p className="text-[12px] text-[var(--text-dim)] leading-relaxed">{greenLight.body}</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Wisdom — subtle footer quote, separate from blockers ──────── */}
        {!data && (
          <div className="p-4 rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
            <div className="flex items-start gap-3">
              <BookOpen className="w-4 h-4 text-[var(--text-faint)] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[12px] text-[var(--text-muted)] italic leading-relaxed mb-1">"{mindsetQuote.text}"</p>
                <p className="text-[10px] text-[#A78BFA] font-semibold tracking-wide uppercase">— {mindsetQuote.source}</p>
              </div>
            </div>
          </div>
        )}
        {data && <WisdomPanel quote={mindsetQuote} />}

      </div>

      {/* ══════════════ RIGHT: Calculator & Sizing ══════════════ */}
      <div className="flex flex-col gap-5">

        <div>
          <h2 className="text-[17px] font-bold tracking-tight mb-1">Calculator & Position Sizing</h2>
          <p className="text-[12px] text-[var(--text-muted)] leading-relaxed">
            Enter the ticker to load live data. Stop loss capped at {MAX_STOP_PCT}%.
          </p>
        </div>

        {/* Ticker input */}
        <div className="relative">
          <input
            value={ticker}
            onChange={e => setTicker(e.target.value.toUpperCase().slice(0, 10))}
            placeholder="TICKER"
            className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-[10px] px-4 py-[14px] font-mono text-[22px] font-bold tracking-tight uppercase text-[var(--text-primary)] focus:outline-none focus:border-[#22D3EE] focus:ring-[3px] focus:ring-[#22D3EE]/15 transition"
          />
          <span className="absolute top-2 right-3 text-[9px] text-[var(--text-faint)] tracking-[0.18em] font-bold flex items-center gap-1.5">
            {loading && <Loader2 className="w-3 h-3 animate-spin text-[#22D3EE]" />}
            TICKER
          </span>
        </div>

        {error && (
          <div className="px-3.5 py-2.5 rounded-[9px] bg-[#FF3B5C]/[0.06] border border-[#FF3B5C]/30 flex items-center gap-2 text-[12px] text-[#FF3B5C] font-medium">
            <X className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {data && <LiveSnapshot data={data} />}

        {/* ── Grouped card: Entry / Stop + Candidates + Sizer output ──── */}
        <div className="rounded-[14px] border border-[var(--border-strong)] bg-[var(--bg-surface)] p-4 flex flex-col gap-4">

          <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
            <span className="text-[10px] uppercase tracking-[0.18em] font-bold text-[var(--text-muted)]">Position Sizer</span>
            <span className="font-mono text-[10px] text-[var(--text-faint)]">ACC · ${accountSize.toLocaleString()}</span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <PriceField label="Entry · Breakout" accent="cyan" value={entry} onChange={setEntry} />
            <PriceField label="Technical Stop"   accent="red"  value={stop}  onChange={setStop} />
          </div>

          {stopExceedsMax && (
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-[9px] bg-[#FF3B5C]/10 border-2 border-[#FF3B5C]/50 text-[#FF3B5C]">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span className="text-[12px] font-extrabold uppercase tracking-wider">
                Max Stop Loss Exceeded ({stopDistPct?.toFixed(2)}% &gt; {MAX_STOP_PCT}% limit)
              </span>
            </div>
          )}

          {/* Stop candidates — visually grouped with the sizer */}
          {data && data.stops.candidates.length > 0 && (
            <StopCandidatesPanel
              stops={data.stops.candidates}
              selected={parseFloat(stop)}
              onSelect={price => setStop(price.toFixed(2))}
            />
          )}

          <SizerOutput sizing={sizing} />
        </div>

        <RiskPreview
          amountInvested={amountInvested}
          onAmountChange={setAmountInvested}
          sizing={sizing}
        />

        {/* Submit — green when all gates pass, amber for what-if, grey when no data */}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={cn(
            'w-full py-[14px] rounded-[10px] text-[13px] font-extrabold uppercase tracking-[0.05em] transition-all',
            !canSubmit
              ? 'bg-[var(--bg-subtle)] text-[var(--text-faint)] cursor-not-allowed'
              : allGreen
                ? 'bg-gradient-to-br from-[#22D3EE] to-[#10F088] text-black shadow-[0_0_24px_rgba(34,211,238,0.4)] hover:brightness-110 hover:-translate-y-[1px] animate-validator-glow'
                : 'bg-amber-500/90 text-black hover:bg-amber-400 hover:-translate-y-[1px]',
          )}
        >
          {!data ? 'Enter a ticker to begin'
            : allGreen ? 'Validate & Log Phase 1'
            : 'Log as Non-System Trade ↗'}
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Subcomponents
// ══════════════════════════════════════════════════════════════════════════════

function LiveSnapshot({ data }: { data: TickerResponse }) {
  const isUp = data.price.dayChangePct >= 0;
  return (
    <div className="p-3.5 rounded-[10px] bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
      <div className="flex items-baseline justify-between mb-2">
        <span className="font-mono text-[22px] font-bold tracking-tight">
          ${data.price.last.toFixed(2)}
        </span>
        <span className={cn(
          'font-mono text-[12px] font-semibold flex items-center gap-1',
          isUp ? 'text-[#10F088]' : 'text-[#FF3B5C]',
        )}>
          {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {isUp ? '+' : ''}{data.price.dayChangePct.toFixed(2)}%
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] font-mono text-[var(--text-muted)]">
        <div className="flex justify-between"><span>52W High</span><span className="text-[var(--text-dim)]">${data.range52w.high.toFixed(2)}</span></div>
        <div className="flex justify-between"><span>52W Low</span><span className="text-[var(--text-dim)]">${data.range52w.low.toFixed(2)}</span></div>
        <div className="flex justify-between"><span>From high</span><span className="text-[var(--text-dim)]">{data.range52w.distanceFromHigh.toFixed(1)}%</span></div>
        <div className="flex justify-between"><span>From low</span><span className="text-[var(--text-dim)]">+{data.range52w.distanceFromLow.toFixed(1)}%</span></div>
      </div>
    </div>
  );
}

// EMAPanel is the anchor of the left col — made deliberately prominent.
function EMAPanel({ data }: { data: TickerResponse }) {
  const { passed, checks } = data.trendTemplate;
  const items = [
    { k: 'Price > 20-EMA',       c: checks.priceAboveEMA20   },
    { k: 'Price > 50-EMA',       c: checks.priceAboveEMA50   },
    { k: 'Price > 150-EMA',      c: checks.priceAboveEMA150  },
    { k: 'Price > 200-EMA',      c: checks.priceAboveEMA200  },
    { k: '50-EMA > 150-EMA',     c: checks.ema50AboveEma150  },
    { k: '150-EMA > 200-EMA',    c: checks.ema150AboveEma200 },
    { k: '200-EMA rising (4mo)', c: checks.ema200Uptrending  },
    { k: 'Within 25% of 52W hi', c: checks.closeTo52wHigh    },
    { k: '30%+ above 52W low',   c: checks.farFrom52wLow     },
  ];
  return (
    <div className={cn(
      'rounded-[12px] border-2 overflow-hidden',
      passed
        ? 'border-[#10F088]/40 bg-[#10F088]/[0.04] shadow-[0_0_28px_rgba(16,240,136,0.1)]'
        : 'border-[#FF3B5C]/30 bg-[#FF3B5C]/[0.04]',
    )}>
      {/* Header — large PASS/FAIL badge */}
      <div className={cn(
        'flex items-center justify-between px-4 py-3 border-b',
        passed ? 'border-[#10F088]/20' : 'border-[#FF3B5C]/15',
      )}>
        <div>
          <p className="text-[9px] uppercase tracking-[0.18em] font-bold text-[var(--text-muted)] mb-0.5">
            Trend Template — Minervini
          </p>
          <p className="text-[12px] font-semibold text-[var(--text-secondary)]">
            {passed ? 'All structural conditions met' : 'One or more conditions failed'}
          </p>
        </div>
        <div className={cn(
          'flex flex-col items-center justify-center px-4 py-2 rounded-[10px] border min-w-[72px]',
          passed
            ? 'bg-[#10F088]/15 border-[#10F088]/40 shadow-[0_0_16px_rgba(16,240,136,0.3)]'
            : 'bg-[#FF3B5C]/10 border-[#FF3B5C]/35',
        )}>
          <span className={cn(
            'text-[18px] font-extrabold tracking-tight leading-none',
            passed ? 'text-[#10F088]' : 'text-[#FF3B5C]',
          )}>
            {passed ? '✓' : '✗'}
          </span>
          <span className={cn(
            'text-[9px] font-extrabold uppercase tracking-widest mt-0.5',
            passed ? 'text-[#10F088]' : 'text-[#FF3B5C]',
          )}>
            {passed ? 'PASS' : 'FAIL'}
          </span>
        </div>
      </div>
      {/* Check grid */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 px-4 py-3">
        {items.map(({ k, c }) => (
          <div key={k} className="flex items-center gap-2 text-[11px]">
            <span className={cn(
              'w-3 h-3 rounded-sm flex items-center justify-center flex-shrink-0',
              c.passed ? 'bg-[#10F088]/25' : 'bg-[#FF3B5C]/20',
            )}>
              {c.passed
                ? <Check className="w-2 h-2 text-[#10F088]" strokeWidth={4} />
                : <X     className="w-2 h-2 text-[#FF3B5C]" strokeWidth={4} />}
            </span>
            <span className={c.passed ? 'text-[var(--text-dim)]' : 'text-[var(--text-muted)]'}>{k}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AutoGatesPanel({
  timeGate, afterClose, nowDisplay,
  volumeGate, volumeDetail,
  onToggleTime, onToggleVolume,
}: {
  timeGate: boolean; afterClose: boolean; nowDisplay: string;
  volumeGate: boolean; volumeDetail: string;
  onToggleTime: () => void; onToggleVolume: () => void;
}) {
  const timeOverridden   = timeGate !== afterClose;
  const volAutoVal       = volumeDetail.toLowerCase().includes('spike') || volumeDetail.toLowerCase().includes('above');
  const volumeOverridden = volumeGate !== volAutoVal;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 mb-1 text-[10px] uppercase tracking-[0.14em] font-bold text-[var(--text-muted)]">
        <span>Auto gates</span>
        <span className="flex-1 h-px bg-[var(--divider)]" />
        <span className="text-[var(--text-faint)]">click to override</span>
      </div>

      <button type="button" onClick={onToggleTime} className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-[9px] border text-[11px] w-full text-left transition-all',
        timeGate
          ? 'bg-[#10F088]/[0.04] border-[#10F088]/25 text-[#10F088]'
          : 'bg-amber-500/[0.06] border-amber-500/25 text-amber-400',
      )}>
        <span className={cn(
          'w-[16px] h-[16px] rounded-[4px] border flex items-center justify-center flex-shrink-0 transition-all',
          timeGate ? 'bg-[#10F088] border-[#10F088] shadow-[0_0_8px_rgba(16,240,136,0.4)]' : 'border-amber-400/50',
        )}>
          {timeGate && <Check className="w-2 h-2 text-black" strokeWidth={3.5} />}
        </span>
        <Clock className="w-3.5 h-3.5 flex-shrink-0" />
        <div className="flex-1">
          <strong className="block text-[11px] font-bold">
            {timeGate ? 'Timing: pros at the close' : `Timing: ${nowDisplay} local`}
            {timeOverridden && <span className="ml-2 text-[9px] font-normal opacity-60">(manual)</span>}
          </strong>
          {!timeGate && <span className="italic opacity-85 text-[10px]">Before 20:00 — consider waiting for the final hour.</span>}
        </div>
      </button>

      <button type="button" onClick={onToggleVolume} className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-[9px] border text-[11px] w-full text-left transition-all',
        volumeGate
          ? 'bg-[#10F088]/[0.04] border-[#10F088]/25 text-[#10F088]'
          : 'bg-[#FF3B5C]/[0.04] border-[#FF3B5C]/25 text-[#FF3B5C]',
      )}>
        <span className={cn(
          'w-[16px] h-[16px] rounded-[4px] border flex items-center justify-center flex-shrink-0 transition-all',
          volumeGate ? 'bg-[#10F088] border-[#10F088] shadow-[0_0_8px_rgba(16,240,136,0.4)]' : 'border-[#FF3B5C]/50',
        )}>
          {volumeGate && <Check className="w-2 h-2 text-black" strokeWidth={3.5} />}
        </span>
        {volumeGate ? <TrendingUp className="w-3.5 h-3.5 flex-shrink-0" /> : <TrendingDown className="w-3.5 h-3.5 flex-shrink-0" />}
        <div className="flex-1">
          <strong className="block text-[11px] font-bold">
            Volume: {volumeDetail}
            {volumeOverridden && <span className="ml-2 text-[9px] font-normal opacity-60">(manual)</span>}
          </strong>
        </div>
      </button>
    </div>
  );
}

// ── BlockersPanel — plain technical failure reasons, no quotes ─────────────────

function BlockersPanel({
  gates, failedGates, stopExceedsMax, stopDistPct,
}: {
  gates: Record<AllGateKey, boolean>;
  failedGates: AllGateKey[];
  stopExceedsMax: boolean;
  stopDistPct: number | null;
}) {
  const isGateKey = (k: AllGateKey): k is GateKey => k in GATE_FAILURES;

  const manualFailed  = MANUAL_GATES.filter(g => !gates[g.key]);
  const autoReasons: string[] = [
    ...(!gates.time_of_day      ? ['Entry timing: before 20:00 — professionals act in the final hour.']      : []),
    ...(!gates.volume_spike     ? ['No breakout volume spike — confirm volume confirmation before entry.']    : []),
    ...(!gates.stop_under_10pct ? ['Stop distance exceeds your max setting — tighten the stop to continue.'] : []),
  ];

  const total = manualFailed.length + autoReasons.length + (stopExceedsMax ? 1 : 0);
  if (total === 0) return null;

  return (
    <div className="p-4 rounded-[12px] border-2 border-[#FF3B5C]/35 bg-[#FF3B5C]/[0.04]">
      <div className="flex items-center gap-2 mb-3.5">
        <AlertTriangle className="w-4 h-4 text-[#FF3B5C] flex-shrink-0" />
        <h3 className="text-[12px] font-extrabold text-[#FF3B5C] uppercase tracking-[0.1em]">
          Blockers — {total} to resolve
        </h3>
      </div>
      <div className="flex flex-col gap-2.5">
        {stopExceedsMax && (
          <BlockerItem
            label="Stop too wide"
            detail={`${stopDistPct?.toFixed(2)}% from entry — exceeds the ${MAX_STOP_PCT}% hard cap. Choose a tighter stop or wait for a tighter base.`}
            critical
          />
        )}
        {manualFailed.map(gate => (
          <BlockerItem
            key={gate.key}
            label={gate.label}
            detail={isGateKey(gate.key) ? GATE_FAILURES[gate.key].why : gate.sublabel}
            critical={gate.isCritical}
          />
        ))}
        {autoReasons.map(reason => (
          <BlockerItem key={reason} label="" detail={reason} />
        ))}
      </div>
    </div>
  );
}

function BlockerItem({ label, detail, critical }: {
  label: string;
  detail: string;
  critical?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className={cn(
        'w-1.5 h-1.5 rounded-full mt-[5px] flex-shrink-0',
        critical ? 'bg-[#FF3B5C]' : 'bg-[#FF3B5C]/50',
      )} />
      <div className="min-w-0">
        {label && (
          <span className={cn(
            'text-[10px] font-bold uppercase tracking-wider mr-1',
            critical ? 'text-[#FF3B5C]' : 'text-[var(--text-muted)]',
          )}>
            {label} —
          </span>
        )}
        <span className="text-[12px] text-[var(--text-dim)] leading-snug">{detail}</span>
      </div>
    </div>
  );
}

// ── WisdomPanel — subtle rotating quote, footer-style ─────────────────────────

function WisdomPanel({ quote }: { quote: { text: string; source: string } }) {
  return (
    <div className="px-1 py-1.5 opacity-35 hover:opacity-65 transition-opacity duration-500 select-none">
      <div className="flex items-start gap-2">
        <BookOpen className="w-3 h-3 text-[#A78BFA] flex-shrink-0 mt-[3px]" />
        <div>
          <p className="text-[11px] text-[var(--text-muted)] italic leading-relaxed">"{quote.text}"</p>
          <p className="text-[9px] text-[#A78BFA] font-semibold tracking-wide uppercase mt-0.5">
            — {quote.source}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── StopCandidatesPanel ────────────────────────────────────────────────────────

function StopCandidatesPanel({
  stops, selected, onSelect,
}: {
  stops: StopCandidate[];
  selected: number;
  onSelect: (price: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2 text-[10px] uppercase tracking-[0.14em] font-bold text-[var(--text-muted)]">
        <Info className="w-3 h-3" />
        <span>Stop candidates</span>
        <span className="text-[var(--text-faint)] font-mono normal-case tracking-normal">click to use</span>
      </div>
      <div className="flex flex-col gap-1">
        {stops.map(c => {
          const isSelected  = Math.abs(c.price - selected) < 0.01;
          const exceeds8Pct = Math.abs(c.distancePct) > MAX_STOP_PCT;
          const label       = STOP_LABEL[c.type] ?? c.label;
          const isGrayed    = !c.valid || exceeds8Pct;

          return (
            <button
              key={c.type}
              type="button"
              onClick={() => onSelect(c.price)}
              className={cn(
                'flex items-center justify-between px-3 py-2 rounded-lg border text-left transition-all',
                isSelected && !isGrayed  && 'border-[#22D3EE]/40 bg-[#22D3EE]/[0.06]',
                !isSelected && !isGrayed && 'border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--border-hover)]',
                isGrayed && !isSelected  && 'border-[#FF3B5C]/20 bg-[#FF3B5C]/[0.03] opacity-60 hover:opacity-80',
                isGrayed && isSelected   && 'border-[#FF3B5C]/40 bg-[#FF3B5C]/[0.06]',
              )}
            >
              <div className="flex flex-col gap-0.5">
                <span className={cn(
                  'text-[12px] font-semibold',
                  isSelected ? 'text-[#22D3EE]' : isGrayed ? 'text-[var(--text-muted)]' : 'text-[var(--text-dim)]',
                )}>
                  {label}
                </span>
                {exceeds8Pct && (
                  <span className="text-[10px] text-[#FF3B5C] font-semibold">
                    exceeds max — click to override
                  </span>
                )}
                {!exceeds8Pct && c.notes && (
                  <span className="text-[10px] text-[var(--text-faint)]">{c.notes}</span>
                )}
              </div>
              <div className="flex flex-col items-end gap-0.5">
                <span className={cn(
                  'font-mono text-[13px] font-bold',
                  isGrayed ? 'text-[#FF3B5C]' : 'text-[var(--text-primary)]',
                )}>
                  ${c.price.toFixed(2)}
                </span>
                <span className={cn(
                  'font-mono text-[10px]',
                  isGrayed ? 'text-[#FF3B5C]' : 'text-[var(--text-muted)]',
                )}>
                  {c.distancePct.toFixed(2)}%
                  {exceeds8Pct && ' · exceeds 8% cap'}
                  {!exceeds8Pct && !c.valid && ' · exceeds 10% cap'}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PriceField({
  label, accent, value, onChange,
}: { label: string; accent: 'cyan' | 'red'; value: string; onChange: (s: string) => void }) {
  const palette = accent === 'cyan'
    ? { label: 'text-[#22D3EE]', ring: 'focus:border-[#22D3EE] focus:ring-[#22D3EE]/15', text: 'text-[var(--text-primary)]' }
    : { label: 'text-[#FF3B5C]', ring: 'focus:border-[#FF3B5C] focus:ring-[#FF3B5C]/15', text: 'text-[#FF3B5C]' };
  return (
    <div className="flex flex-col gap-1.5">
      <label className={cn('text-[10px] uppercase tracking-[0.14em] font-semibold', palette.label)}>
        {label}
      </label>
      <input
        inputMode="decimal"
        value={value}
        onChange={e => onChange(e.target.value)}
        className={cn(
          'bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-[8px] px-3 py-2.5 font-mono text-[15px] font-semibold transition focus:outline-none focus:ring-[3px]',
          palette.ring, palette.text,
        )}
      />
    </div>
  );
}

function SizerOutput({ sizing }: { sizing: PositionSizerResult }) {
  if (sizing.status === 'rejected') {
    return (
      <div className="bg-[#FF3B5C]/[0.06] border border-[#FF3B5C]/30 text-[#FF3B5C] px-3.5 py-2.5 rounded-[9px] text-[12px] font-semibold flex items-center gap-2">
        <X className="w-3.5 h-3.5 flex-shrink-0" />
        <span>{sizing.message}</span>
      </div>
    );
  }
  return (
    <div className="bg-gradient-to-br from-[#22D3EE]/[0.04] to-[#10F088]/[0.04] border border-[#22D3EE]/20 rounded-[12px] p-4 flex flex-col gap-3">
      <Row k="Stop distance"      v={`${sizing.stopDistancePct.toFixed(2)}%`} vClass="text-[#FF3B5C]" />
      <Row k="Risk budget · 2.5%" v={`$${sizing.dollarRisk.toFixed(2)}`} />
      <Row k="Risk per share"     v={`$${sizing.riskPerShare.toFixed(2)}`} />
      <div className="pt-2.5 border-t border-dashed border-[var(--border-strong)] flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider">Full position · shares</span>
        <span className="font-mono text-[26px] font-extrabold tracking-tight text-[#22D3EE] [text-shadow:0_0_20px_rgba(34,211,238,0.4)]">
          {sizing.totalShares}
        </span>
      </div>
      <Row k="Phase 1 · breakout 50%"
           v={`${sizing.phase1Shares} shares · $${sizing.phase1Notional.toLocaleString()}`}
           vClass="text-[#22D3EE]" />
      <Row k="Phase 2 · retest + bounce 50%"
           v={`${sizing.phase2Shares} shares · pending`}
           vClass="text-[#22D3EE]" />
    </div>
  );
}

function Row({ k, v, vClass }: { k: string; v: string; vClass?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] uppercase tracking-wider font-semibold text-[var(--text-muted)]">{k}</span>
      <span className={cn('font-mono text-[14px] font-bold text-[var(--text-primary)]', vClass)}>{v}</span>
    </div>
  );
}

function RiskPreview({
  amountInvested, onAmountChange, sizing,
}: {
  amountInvested: string;
  onAmountChange: (v: string) => void;
  sizing: PositionSizerResult;
}) {
  const stopPct   = sizing.status === 'ok' ? Math.abs(sizing.stopDistancePct) : null;
  const suggested = sizing.status === 'ok' ? sizing.totalNotional : null;
  const invested  = parseFloat(amountInvested);
  const maxLoss   = stopPct !== null && Number.isFinite(invested) && invested > 0
    ? invested * (stopPct / 100) : null;

  return (
    <div className="p-4 rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] uppercase tracking-[0.14em] font-bold text-[var(--text-secondary)]">Risk Preview</span>
        {suggested !== null && (
          <button
            type="button"
            onClick={() => onAmountChange(suggested.toFixed(2))}
            className="text-[10px] font-mono text-[#22D3EE] hover:underline"
          >
            use ${suggested.toLocaleString()}
          </button>
        )}
      </div>
      <div className="flex flex-col gap-1.5 mb-3">
        <label className="text-[10px] uppercase tracking-[0.14em] font-semibold text-[var(--text-muted)]">Amount Invested ($)</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] font-mono text-[14px]">$</span>
          <input
            inputMode="decimal"
            value={amountInvested}
            onChange={e => onAmountChange(e.target.value)}
            placeholder="0.00"
            className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-[8px] pl-7 pr-3 py-2.5 font-mono text-[15px] font-semibold text-[var(--text-primary)] focus:outline-none focus:border-[#22D3EE] focus:ring-[3px] focus:ring-[#22D3EE]/15 transition"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col items-center justify-center px-3 py-2.5 rounded-[9px] border border-[#FF3B5C]/20 bg-[#FF3B5C]/[0.04]">
          <span className="text-[9px] uppercase tracking-[0.14em] font-bold text-[var(--text-faint)] mb-0.5">Max Loss at Stop</span>
          <span className="font-mono text-[16px] font-extrabold text-[#FF3B5C]">
            {stopPct !== null ? `−${stopPct.toFixed(2)}%` : '—'}
          </span>
        </div>
        <div className="flex flex-col items-center justify-center px-3 py-2.5 rounded-[9px] border border-[#FF3B5C]/20 bg-[#FF3B5C]/[0.04]">
          <span className="text-[9px] uppercase tracking-[0.14em] font-bold text-[var(--text-faint)] mb-0.5">Max Loss ($)</span>
          <span className="font-mono text-[22px] font-extrabold text-[#FF3B5C] [text-shadow:0_0_18px_rgba(255,59,92,0.4)]">
            {maxLoss !== null ? `−$${maxLoss.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}
          </span>
        </div>
      </div>
    </div>
  );
}
