// components/validator/pre-trade-validator.tsx
//
// Pre-Trade Validator — CAN SLIM / Minervini methodology.
//
// Architecture: Context + Provider so ChecklistCard and SizerCard can live in
// separate grid columns while sharing a single piece of state.
//
// Exports:
//   ValidatorProvider  — wraps both cards, holds all state/logic
//   ChecklistCard      — left column: trend template + gates + blockers
//   SizerCard          — right column: ticker + sizer + submit

'use client';

import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react';
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
import { isValidTicker, TICKER_ERROR } from '@/lib/ticker-validation';

// ── Constants ──────────────────────────────────────────────────────────────────

type AutoGateKey = 'above_ath_avwap' | 'near_52wh' | 'above_52wl';
type AllGateKey  = Exclude<GateKey, AutoGateKey> | 'clear_pivot' | 'earnings_safe';

const RESET_AUTO_GATES: Record<AutoGateKey, null> = {
  above_ath_avwap: null, near_52wh: null, above_52wl: null,
};

const STOP_LABEL: Partial<Record<StopType, string>> = {
  below_ema50:            'Violation of 50-Day EMA',
  below_ema20:            'Violation of 20-Day EMA (Trailing)',
  below_swing_low:        'Break below recent Pivot / Handle Low',
  below_pivot_day_low:    'Break below Pivot Day Low (Minervini)',
  below_7_8_pct:          "O'Neil 8% Hard Stop",
  below_base_low:         'Break below Base Low',
  below_last_higher_low:  'Break below Last Higher Low (Stage 2)',
};

interface ManualGate {
  key: AllGateKey;
  label: string;
  sublabel: string;
  icon: typeof Check;
}

const MANUAL_GATES: ManualGate[] = [
  { key: 'vcp_confirmed', label: 'VCP Characteristics (Volume dry-up)',    sublabel: 'Volatility contracts left→right, volume dries up at pivot — no wide-and-loose bars', icon: ShieldCheck },
  { key: 'clear_pivot',   label: 'Clear Breakout Pivot',                   sublabel: 'Well-defined pivot point with tight price action; handle or base shelf is clean', icon: Target },
  { key: 'earnings_safe', label: 'Earnings Date is Safe (Not Imminent)',   sublabel: 'No earnings report within the next 3–4 weeks — never buy before earnings', icon: Calendar },
  { key: 'above_emas',    label: 'Price above 20-EMA, 50-EMA, 200-EMA',   sublabel: 'Institutional support intact — riding all three moving averages', icon: Zap },
  { key: 'rs_above_80',   label: 'IBD RS Rating > 80',                     sublabel: 'Leader, not a laggard — 90+ preferred for A+ setups', icon: Target },
  { key: 'market_uptrend',label: 'Market in confirmed uptrend',            sublabel: 'S&P / Nasdaq above key MAs, no distribution cluster in last 4 weeks', icon: BookOpen },
];

// ── Context ────────────────────────────────────────────────────────────────────

interface ValidatorState {
  ticker: string; setTicker: (v: string) => void;
  entry: string; setEntry: (v: string) => void;
  stop: string; setStop: (v: string) => void;
  amountInvested: string; onAmountChange: (v: string) => void;
  gates: Record<AllGateKey, boolean>;
  toggleGate: (k: AllGateKey) => void;
  onToggleTime: () => void;
  onToggleVolume: () => void;
  autoGates: Record<AutoGateKey, boolean | null>;
  dataQuality: 'ok' | 'insufficient' | null;
  data: TickerResponse | null;
  loading: boolean;
  error: string | null;
  sizing: PositionSizerResult;
  effectiveSizing: PositionSizerResult;
  stopDistPct: number | null;
  stopExceedsMax: boolean;
  exceedsBudget: boolean;
  maxPortfolioRisk: number;
  failedGates: AllGateKey[];
  trendTemplatePassed: boolean;
  allGreen: boolean;
  canSubmit: boolean;
  entryInvalid: boolean;
  tickerInvalid: boolean;
  afterClose: boolean;
  nowDisplay: string;
  mindsetQuote: { text: string; source: string };
  greenLight: { headline: string; body: string };
  handleSubmit: () => void;
  handleResetAmount: () => void;
  accountSize: number;
  maxStopDistancePct: number;
}

const ValidatorCtx = createContext<ValidatorState | null>(null);
const useValidator = () => {
  const ctx = useContext(ValidatorCtx);
  if (!ctx) throw new Error('useValidator must be used within ValidatorProvider');
  return ctx;
};

// ── Provider ───────────────────────────────────────────────────────────────────

interface ValidatorProviderProps {
  children: React.ReactNode;
  accountSize: number;
  maxStopDistancePct?: number;
  maxPortfolioRiskPct?: number;
  initialTicker?: string;
  getNow?: () => Date;
  onSubmit?: (payload: {
    ticker: string; entry: number; stop: number;
    sizing: Extract<PositionSizerResult, { status: 'ok' }>;
    tickerData: TickerResponse;
    amountInvested: number;
    isWhatIf: boolean;
    failedGates: string[];
  }) => void;
}

export function ValidatorProvider({
  children, accountSize, maxStopDistancePct, maxPortfolioRiskPct,
  initialTicker, getNow = () => new Date(), onSubmit,
}: ValidatorProviderProps) {
  const [ticker,         setTicker]         = useState(initialTicker ?? 'NVDA');

  // Sync when parent updates the prefilled ticker (e.g. from Stage 2 Leaders)
  const prevInitialTicker = useRef(initialTicker);
  useEffect(() => {
    if (initialTicker && initialTicker !== prevInitialTicker.current) {
      setTicker(initialTicker);
      prevInitialTicker.current = initialTicker;
    }
  }, [initialTicker]);
  const [entry,          setEntry]          = useState('');
  const [stop,           setStop]           = useState('');
  const [amountInvested, setAmountInvested] = useState('');
  const [gates, setGates] = useState<Record<AllGateKey, boolean>>({
    stage2: true,  // auto-satisfied — covered by Trend Template's 50-EMA > 200-SMA check
    above_emas: false, rs_above_80: false, vcp_confirmed: false,
    market_uptrend: false, clear_pivot: false, earnings_safe: false,
    time_of_day: true, stop_under_10pct: true, volume_spike: false,
  });
  const [autoGates,   setAutoGates]   = useState<Record<AutoGateKey, boolean | null>>(RESET_AUTO_GATES);
  const [dataQuality, setDataQuality] = useState<'ok' | 'insufficient' | null>(null);
  const [data,    setData]    = useState<TickerResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const debounceRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef        = useRef<AbortController | null>(null);
  const amountManualRef = useRef(false);

  const fetchTicker = useCallback(async (sym: string) => {
    if (!/^[A-Z][A-Z0-9.-]{0,9}$/.test(sym)) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true); setError(null);
    setAutoGates(RESET_AUTO_GATES); setDataQuality(null);
    try {
      const res  = await fetch(`/api/ticker/${sym}`, { signal: controller.signal });
      const body = await res.json();
      if (!res.ok) { setError((body as TickerErrorResponse).error); setData(null); setEntry(''); setStop(''); return; }
      const td = body as TickerResponse;
      setData(td);
      try {
        const { recordValidatorSession } = await import('@/components/journal/pre-trade-gate');
        recordValidatorSession(sym, td.trendTemplate.passed);
      } catch { /* gate component not loaded — non-fatal */ }
      setEntry(td.price.last.toFixed(2));
      if (td.stops.recommended) setStop(td.stops.recommended.price.toFixed(2));
      else setStop('');
      const emasOk = td.trendTemplate.checks.priceAboveEMA20.passed &&
        td.trendTemplate.checks.priceAboveEMA50.passed &&
        td.trendTemplate.checks.priceAboveEMA200.passed;
      setGates(g => ({ ...g, above_emas: emasOk, volume_spike: td.volumeCheck.spikeOnBreakout }));
      setAutoGates({
        above_ath_avwap: td.above_ath_avwap,
        near_52wh:  td.distance_from_52wh_pct !== null ? td.distance_from_52wh_pct >= -25 : null,
        above_52wl: td.distance_from_52wl_pct !== null ? td.distance_from_52wl_pct >= 30  : null,
      });
      setDataQuality(td.data_quality);
    } catch (err) {
      if ((err as { name?: string }).name === 'AbortError') return;
      setError('Network error. Try again in a moment.'); setData(null);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (ticker.length < 1) return;
    debounceRef.current = setTimeout(() => void fetchTicker(ticker), 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [ticker, fetchTicker]);

  useEffect(() => {
    amountManualRef.current = false;
    setAutoGates(RESET_AUTO_GATES);
    setDataQuality(null);
  }, [ticker]);

  const sizing = useMemo<PositionSizerResult>(() =>
    calculatePosition({ accountSize, entryPrice: parseFloat(entry), stopPrice: parseFloat(stop), maxStopDistancePct, maxPortfolioRiskPct }),
    [accountSize, entry, stop, maxStopDistancePct, maxPortfolioRiskPct],
  );

  useEffect(() => {
    if (sizing.status === 'ok' && !amountManualRef.current)
      setAmountInvested(sizing.totalNotional.toFixed(2));
  }, [sizing]);

  useEffect(() => { setGates(g => ({ ...g, stop_under_10pct: sizing.status === 'ok' })); }, [sizing.status]);

  const effectiveSizing = useMemo<PositionSizerResult>(() => {
    if (sizing.status !== 'ok') return sizing;
    const amount = parseFloat(amountInvested);
    const ep = parseFloat(entry), sp = parseFloat(stop);
    if (!Number.isFinite(amount) || amount <= 0) return sizing;
    const totalShares = Math.floor(amount / ep);
    if (totalShares < 1) return sizing;
    const phase1Shares = Math.floor(totalShares * 0.5);
    const phase2Shares = totalShares - phase1Shares;
    const riskPerShare = ep - sp;
    const dollarRisk = Math.round(totalShares * riskPerShare * 100) / 100;
    const portfolioRiskPct = Math.round((dollarRisk / accountSize) * 10000) / 10000;
    return {
      ...sizing, totalShares, phase1Shares, phase2Shares,
      phase1Notional: Math.round(phase1Shares * ep * 100) / 100,
      phase2Notional: Math.round(phase2Shares * ep * 100) / 100,
      totalNotional: Math.round(amount * 100) / 100,
      dollarRisk, portfolioRiskPct,
    };
  }, [sizing, amountInvested, entry, stop, accountSize]);

  const now = getNow();
  const afterClose = now.getHours() >= 20;
  useEffect(() => { setGates(g => ({ ...g, time_of_day: afterClose })); }, [afterClose]);

  const stopDistPct      = sizing.status === 'ok' ? Math.abs(sizing.stopDistancePct) : null;
  const effectiveMaxStop = maxStopDistancePct ?? 10;
  const stopExceedsMax   = stopDistPct !== null && stopDistPct > effectiveMaxStop;
  const maxPortfolioRisk = maxPortfolioRiskPct ?? 2.5;
  const exceedsBudget = effectiveSizing.status === 'ok' && sizing.status === 'ok' &&
    effectiveSizing.portfolioRiskPct > maxPortfolioRisk &&
    Math.abs(effectiveSizing.totalNotional - sizing.totalNotional) > 1;

  const failedGates        = (Object.keys(gates) as AllGateKey[]).filter(k => !gates[k]);
  const trendTemplatePassed = !!data && data.trendTemplate.passed;
  const allGreen            = trendTemplatePassed && sizing.status === 'ok';
  const entryInvalid        = useMemo(() => {
    if (entry === '') return false;
    const v = parseFloat(entry);
    return !Number.isFinite(v) || v <= 0;
  }, [entry]);
  const tickerInvalid       = ticker.length > 0 && !isValidTicker(ticker);
  const canSubmit           = !!data && sizing.status === 'ok' && !entryInvalid && !tickerInvalid;

  const quoteSeed    = now.getDate();
  const mindsetQuote = useMemo(() => getMindsetQuote(quoteSeed), [quoteSeed]);
  const greenLight   = useMemo(() => getGreenLightMessage(quoteSeed), [quoteSeed]);
  const nowDisplay   = now.toTimeString().slice(0, 5);

  const handleSubmit = () => {
    if (!canSubmit || sizing.status !== 'ok' || effectiveSizing.status !== 'ok' || !data) return;
    onSubmit?.({
      ticker: ticker.toUpperCase(), entry: parseFloat(entry), stop: parseFloat(stop),
      sizing: effectiveSizing as Extract<PositionSizerResult, { status: 'ok' }>,
      tickerData: data,
      amountInvested: parseFloat(amountInvested) || sizing.totalNotional,
      isWhatIf: !allGreen,
      failedGates: failedGates as string[],
    });
  };

  const handleResetAmount = () => {
    amountManualRef.current = false;
    if (sizing.status === 'ok') setAmountInvested(sizing.totalNotional.toFixed(2));
  };

  const onAmountChange = (v: string) => { amountManualRef.current = true; setAmountInvested(v); };
  const toggleGate = (k: AllGateKey) => setGates(g => ({ ...g, [k]: !g[k] }));
  const onToggleTime   = () => setGates(g => ({ ...g, time_of_day:  !g.time_of_day  }));
  const onToggleVolume = () => setGates(g => ({ ...g, volume_spike: !g.volume_spike }));

  return (
    <ValidatorCtx.Provider value={{
      ticker, setTicker, entry, setEntry, stop, setStop,
      amountInvested, onAmountChange, gates, toggleGate, onToggleTime, onToggleVolume,
      autoGates, dataQuality,
      data, loading, error, sizing, effectiveSizing,
      stopDistPct, stopExceedsMax, exceedsBudget, maxPortfolioRisk,
      failedGates, trendTemplatePassed, allGreen, canSubmit,
      afterClose, nowDisplay, mindsetQuote, greenLight,
      handleSubmit, handleResetAmount, accountSize, entryInvalid, tickerInvalid,
      maxStopDistancePct: effectiveMaxStop,
    }}>
      {children}
    </ValidatorCtx.Provider>
  );
}

// ── ChecklistCard ──────────────────────────────────────────────────────────────

export function ChecklistCard({ className }: { className?: string }) {
  const {
    data, gates, toggleGate, trendTemplatePassed, allGreen,
    afterClose, nowDisplay, mindsetQuote, greenLight,
    onToggleTime, onToggleVolume, autoGates, dataQuality,
  } = useValidator();

  const [insufficientDismissed, setInsufficientDismissed] = useState(false);

  const allOptionalGreen = MANUAL_GATES.every(g => gates[g.key]);

  return (
    <div
      className={cn(
        'rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 flex flex-col gap-4',
        className,
      )}
      style={{ boxShadow: 'var(--shadow-card), var(--inner-highlight)' }}
    >
      {/* Card header */}
      <div>
        <h2 className="text-[15px] font-bold tracking-tight text-[var(--text-primary)] mb-0.5">
          Pre-Trade Checklist
        </h2>
        <p className="text-xs text-[var(--text-muted)] leading-[1.55]">
          Trend Template is the only hard gate. Optional checks below are quality enhancers.
        </p>
      </div>

      {/* Trend Template — most prominent */}
      {data && <EMAPanel data={data} />}

      {/* Status banners */}
      {data && !trendTemplatePassed && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-[10px] bg-red-500/10 border border-red-500/30">
          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-red-500 uppercase tracking-wider leading-tight">
              BLOCKED — Fails Trend Template
            </p>
            <p className="text-xs text-red-500/70 mt-0.5 leading-snug">
              One or more structural conditions not met — will be logged as a non-system trade.
            </p>
          </div>
        </div>
      )}
      {data && trendTemplatePassed && allGreen && allOptionalGreen && (
        <div className="p-4 rounded-[10px] border border-[#10F088]/40 bg-[#10F088]/[0.06] animate-validator-glow">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-[#10F088]/25 border border-[#10F088]/50 flex items-center justify-center flex-shrink-0 mt-0.5 animate-shimmer-glow">
              <Check className="w-4 h-4 text-[#10F088]" strokeWidth={3.5} />
            </div>
            <div>
              <h3 className="text-[13px] font-bold text-[#10F088] mb-0.5 uppercase tracking-wider">
                PASS — High Conviction Setup · {greenLight.headline}
              </h3>
              <p className="text-xs text-[var(--text-muted)] leading-[1.55]">{greenLight.body}</p>
            </div>
          </div>
        </div>
      )}
      {data && trendTemplatePassed && allGreen && !allOptionalGreen && (
        <div className="p-4 rounded-[10px] border border-amber-400/30 bg-amber-400/[0.04]">
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-full bg-amber-400/15 border border-amber-400/30 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Check className="w-3.5 h-3.5 text-amber-400" strokeWidth={3} />
            </div>
            <div>
              <h3 className="text-[13px] font-bold text-amber-500 mb-0.5 uppercase tracking-wider">
                PASS — Consider Optional Checks
              </h3>
              <p className="text-xs text-[var(--text-muted)] leading-[1.55]">
                Trend Template clear. Review the optional quality gates below for higher conviction.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Auto-computed Minervini gates */}
      {data && (
        <div className="animate-[fade-in_300ms_ease_both]">
          <SectionLabel text="Auto-Computed Checks" aside="from live market data" />
          {dataQuality === 'insufficient' && !insufficientDismissed && (
            <div className="mt-2 flex items-start gap-2 px-3 py-2 rounded-[8px] bg-amber-500/[0.07] border border-amber-500/25 text-xs text-amber-600">
              <Info className="w-3.5 h-3.5 flex-shrink-0 mt-px text-amber-500" />
              <span className="flex-1">Insufficient price history for precise 52W / AVWAP calculations — needs 1+ year of data.</span>
              <button type="button" onClick={() => setInsufficientDismissed(true)} className="ml-1 flex-shrink-0 opacity-60 hover:opacity-100">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <div className="flex flex-col gap-1.5 mt-2">
            <AutoComputedGateRow
              gateKey="above_ath_avwap"
              value={autoGates.above_ath_avwap}
              label="Price above ATH-anchored AVWAP"
              helperLine={data.ath_avwap != null ? (() => {
                const diff = ((data.price.last - data.ath_avwap!) / data.ath_avwap!) * 100;
                return (
                  <>
                    Price{' '}
                    <span className="tabular-nums">${data.price.last.toFixed(2)}</span>
                    {' '}vs ATH AVWAP{' '}
                    <span className="tabular-nums">${data.ath_avwap!.toFixed(2)}</span>
                    {' '}(<PctSpan value={diff} />)
                  </>
                );
              })() : undefined}
              lowConfidence={data.ath_avwap_low_confidence}
            />
            <AutoComputedGateRow
              gateKey="near_52wh"
              value={autoGates.near_52wh}
              label="Within 25% of 52-week high"
              helperLine={data.distance_from_52wh_pct !== null
                ? <>Distance from 52W high: <PctSpan value={data.distance_from_52wh_pct} /></>
                : undefined}
            />
            <AutoComputedGateRow
              gateKey="above_52wl"
              value={autoGates.above_52wl}
              label="At least 30% above 52-week low"
              helperLine={data.distance_from_52wl_pct !== null
                ? <>Distance from 52W low: <PctSpan value={data.distance_from_52wl_pct} /></>
                : undefined}
            />
          </div>
        </div>
      )}

      {/* Optional quality gates */}
      <div>
        <SectionLabel text="Optional Quality Checks" aside="quality enhancers, not blockers" />
        <div className="flex flex-col gap-1.5 mt-2">
          {MANUAL_GATES.map(gate => {
            const Icon    = gate.icon;
            const checked = gates[gate.key];
            return (
              <button
                key={gate.key}
                type="button"
                role="checkbox"
                aria-checked={checked}
                onClick={() => toggleGate(gate.key)}
                className={cn(
                  'flex items-start gap-3 px-3 py-2.5 border rounded-[9px] text-left transition-all',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22D3EE]/50',
                  checked
                    ? 'bg-[#10F088]/[0.05] border-[#10F088]/25'
                    : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] hover:border-[var(--border-hover)]',
                )}
              >
                <span className={cn(
                  'w-[17px] h-[17px] rounded-[4px] border flex items-center justify-center flex-shrink-0 mt-px transition-all',
                  checked ? 'bg-[#10F088] border-[#10F088]' : 'border-[var(--border-hover)]',
                )}>
                  {checked && <Check className="w-2.5 h-2.5 text-black" strokeWidth={3.5} />}
                </span>
                <Icon className={cn(
                  'w-3.5 h-3.5 flex-shrink-0 mt-[3px]',
                  checked ? 'text-[#10F088]' : 'text-[var(--text-faint)]',
                )} />
                <div className="flex-1 min-w-0">
                  <div className={cn('text-xs font-semibold leading-tight',
                    checked ? 'text-[var(--text-dim)]' : 'text-[var(--text-secondary)]',
                  )}>
                    {gate.label}
                  </div>
                  <div className="text-xs text-[var(--text-faint)] leading-snug mt-0.5">{gate.sublabel}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Auto gates */}
      {data && (
        <div>
          <SectionLabel text="Auto gates" aside="click to override" />
          <div className="flex flex-col gap-1.5 mt-2">
            <AutoGateRow
              checked={gates.time_of_day}
              icon={Clock}
              label={gates.time_of_day ? 'Timing: at or after close' : `Timing: ${nowDisplay} — before 20:00`}
              sublabel={!gates.time_of_day ? 'Professionals act in the final hour.' : undefined}
              overridden={gates.time_of_day !== afterClose}
              onClick={onToggleTime}
            />
            <AutoGateRow
              checked={gates.volume_spike}
              icon={gates.volume_spike ? TrendingUp : TrendingDown}
              label={`Volume: ${data.volumeCheck.detail}`}
              overridden={false}
              onClick={onToggleVolume}
            />
          </div>
        </div>
      )}

      {/* Wisdom quote — only when no data */}
      {!data && (
        <div className="mt-auto px-1 opacity-40 hover:opacity-60 transition-opacity duration-500 select-none">
          <div className="flex items-start gap-2">
            <BookOpen className="w-3 h-3 text-violet-400 flex-shrink-0 mt-[3px]" />
            <div>
              <p className="text-xs text-[var(--text-muted)] italic leading-relaxed">"{mindsetQuote.text}"</p>
              <p className="text-[9px] text-violet-400 font-semibold tracking-wider uppercase mt-0.5">— {mindsetQuote.source}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── SizerCard ──────────────────────────────────────────────────────────────────

export function SizerCard({ className }: { className?: string }) {
  const {
    entry, setEntry, stop, setStop,
    amountInvested, onAmountChange, handleResetAmount,
    data, error,
    sizing, effectiveSizing, stopExceedsMax, stopDistPct,
    exceedsBudget, maxPortfolioRisk, maxStopDistancePct,
    canSubmit, allGreen, handleSubmit, accountSize, entryInvalid,
  } = useValidator();

  const autoAmount = sizing.status === 'ok' ? sizing.totalNotional : null;
  const invested   = parseFloat(amountInvested);
  const isCustomAmount = autoAmount !== null && Number.isFinite(invested) && Math.abs(invested - autoAmount) > 1;

  return (
    <div
      className={cn(
        'rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 flex flex-col gap-4',
        className,
      )}
      style={{ boxShadow: 'var(--shadow-card), var(--inner-highlight)' }}
    >
      {/* Card header */}
      <div>
        <h2 className="text-[15px] font-bold tracking-tight text-[var(--text-primary)] mb-0.5">
          Position Sizer
        </h2>
        <p className="text-xs text-[var(--text-muted)] leading-[1.55]">
          Stop loss capped at {maxStopDistancePct}%. Enter account size in Settings.
        </p>
      </div>

      {error && (
        <div className="px-3 py-2 rounded-[8px] bg-red-500/[0.06] border border-red-500/25 flex items-center gap-2 text-xs text-red-500">
          <X className="w-3.5 h-3.5 flex-shrink-0" /><span>{error}</span>
        </div>
      )}

      {data && <LiveSnapshot data={data} />}

      {/* Sizer group */}
      <div className="rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/40 p-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <SectionLabel text="Entry & Stop" />
          <span className="font-mono text-xs text-[var(--text-faint)]">
            acc ${accountSize.toLocaleString()}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <PriceField label="Entry" accent="cyan" value={entry} onChange={setEntry} hasError={entryInvalid} />
          <PriceField label="Stop"  accent="red"  value={stop}  onChange={setStop}  />
        </div>

        {entryInvalid && (
          <p className="text-[11px] text-[#FF3B5C] -mt-2">Entry price must be a positive number.</p>
        )}

        {stopExceedsMax && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-[8px] bg-red-500/10 border border-red-500/35 text-red-500">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span className="text-xs font-bold uppercase tracking-wider">
              Stop exceeds {maxStopDistancePct}% cap ({stopDistPct?.toFixed(2)}%)
            </span>
          </div>
        )}

        {data && data.stops.candidates.length > 0 && (
          <StopCandidatesPanel
            stops={data.stops.candidates}
            selected={parseFloat(stop)}
            onSelect={price => setStop(price.toFixed(2))}
            maxStopPct={maxStopDistancePct}
          />
        )}

        {data && <SizerOutput sizing={effectiveSizing} />}

        {data && exceedsBudget && effectiveSizing.status === 'ok' && sizing.status === 'ok' && (
          <div className="flex items-start gap-2 px-3 py-2 rounded-[8px] bg-amber-500/[0.07] border border-amber-500/25 text-xs text-amber-600">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
            <span>
              ${effectiveSizing.totalNotional.toLocaleString()} exceeds your {maxPortfolioRisk}% budget
              — auto: ${sizing.totalNotional.toLocaleString()}
            </span>
          </div>
        )}
      </div>

      {/* Amount Invested */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <SectionLabel text="Amount Invested" />
          {sizing.status === 'ok' && isCustomAmount && (
            <button type="button" onClick={handleResetAmount} className="text-xs font-mono text-[#22D3EE] hover:underline">
              Reset to auto (${autoAmount!.toLocaleString()})
            </button>
          )}
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
          {sizing.status !== 'ok' ? (
            <div className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-[8px] px-3 py-2.5 font-mono text-[14px] font-semibold text-[var(--text-faint)]">
              —
            </div>
          ) : (
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] font-mono text-[14px]">$</span>
              <input
                inputMode="decimal"
                value={amountInvested}
                onChange={e => onAmountChange(e.target.value)}
                placeholder="0.00"
                className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-[8px] pl-7 pr-3 py-2.5 font-mono text-[14px] font-semibold text-[var(--text-primary)] focus:outline-none focus:border-[#22D3EE] focus:ring-[2px] focus:ring-[#22D3EE]/15 transition"
              />
            </div>
          )}
          <MaxLossChip sizing={effectiveSizing} invested={invested} />
        </div>
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className={cn(
          'w-full py-[14px] rounded-[10px] text-[13px] font-bold uppercase tracking-[0.06em] transition-all mt-auto',
          !canSubmit
            ? 'bg-[var(--bg-subtle)] text-[var(--text-faint)] cursor-not-allowed'
            : allGreen
              ? 'btn-cta-success'
              : 'btn-cta-whatif',
        )}
      >
        {!data ? 'Enter a ticker to begin'
          : allGreen ? 'Validate & Log Phase 1'
          : 'Log as Non-System Trade ↗'}
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Private sub-components
// ══════════════════════════════════════════════════════════════════════════════

function PctSpan({ value }: { value: number }) {
  const sign    = value >= 0 ? '+' : '';
  const colorCn = value < 0 ? 'text-red-400' : 'text-emerald-400';
  return (
    <span className={cn('tabular-nums font-semibold', colorCn)}>
      {sign}{value.toFixed(1)}%
    </span>
  );
}

function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex">
      <span tabIndex={0} aria-label={text} className="cursor-help">
        <Info className="w-3 h-3 text-amber-400 flex-shrink-0" />
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-max max-w-[200px] px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-xs text-zinc-200 leading-snug opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150 z-50 whitespace-normal"
      >
        {text}
      </span>
    </span>
  );
}

function AutoComputedGateRow({
  gateKey, value, label, helperLine, lowConfidence,
}: {
  gateKey: AutoGateKey;
  value: boolean | null;
  label: string;
  helperLine?: ReactNode;
  lowConfidence?: boolean;
}) {
  const state = value === null ? 'insufficient' : value ? 'pass' : 'fail';
  return (
    <div
      data-testid={`gate-${gateKey}`}
      data-state={state}
      className={cn(
        'flex items-start gap-3 px-3 py-2.5 border rounded-[9px]',
        state === 'pass' ? 'bg-[#10F088]/[0.04] border-[#10F088]/20'
          : state === 'fail' ? 'bg-red-500/[0.04] border-red-500/20'
          : 'bg-[var(--bg-surface)] border-[var(--border-subtle)]',
      )}
    >
      <span className={cn(
        'w-[17px] h-[17px] rounded-[4px] border flex items-center justify-center flex-shrink-0 mt-px',
        state === 'pass' ? 'bg-[#10F088] border-[#10F088]'
          : state === 'fail' ? 'bg-red-500/20 border-red-500/40'
          : 'border-[var(--border-hover)]',
      )}>
        {state === 'pass' && <Check className="w-2.5 h-2.5 text-black" strokeWidth={3.5} />}
        {state === 'fail' && <X className="w-2.5 h-2.5 text-red-500" strokeWidth={3.5} />}
      </span>
      <div className="flex-1 min-w-0">
        <div className={cn(
          'text-xs font-semibold leading-tight flex items-center gap-1.5',
          state === 'pass' ? 'text-[var(--text-dim)]'
            : state === 'fail' ? 'text-[var(--text-secondary)]'
            : 'text-[var(--text-faint)]',
        )}>
          {label}
          {lowConfidence && (
            <InfoTooltip text="Low confidence — fewer than 20 bars since ATH" />
          )}
        </div>
        {helperLine && (
          <div className="text-xs font-semibold text-zinc-200 leading-snug mt-1">
            {helperLine}
          </div>
        )}
        {state === 'insufficient' && !helperLine && (
          <div className="text-xs text-[var(--text-faint)] leading-snug mt-0.5">Needs 1+ year of price history</div>
        )}
      </div>
    </div>
  );
}

function SectionLabel({ text, aside }: { text: string; aside?: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs uppercase tracking-[0.18em] font-semibold text-[var(--text-muted)] opacity-70">
        {text}
      </span>
      {aside && (
        <>
          <span className="flex-1 h-px bg-[var(--divider)]" />
          <span className="text-[9px] text-[var(--text-faint)] uppercase tracking-[0.12em]">{aside}</span>
        </>
      )}
    </div>
  );
}

function AutoGateRow({
  checked, icon: Icon, label, sublabel, overridden, onClick,
}: {
  checked: boolean; icon: typeof Clock; label: string;
  sublabel?: string; overridden: boolean; onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className={cn(
      'flex items-center gap-3 px-3 py-2 rounded-[9px] border text-xs w-full text-left transition-all',
      checked
        ? 'bg-[#10F088]/[0.04] border-[#10F088]/20 text-[#10F088]'
        : 'bg-amber-500/[0.05] border-amber-500/20 text-amber-500',
    )}>
      <span className={cn(
        'w-[15px] h-[15px] rounded-[4px] border flex items-center justify-center flex-shrink-0',
        checked ? 'bg-[#10F088] border-[#10F088]' : 'border-amber-400/50',
      )}>
        {checked && <Check className="w-2 h-2 text-black" strokeWidth={3.5} />}
      </span>
      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
      <div className="flex-1">
        <span className="font-semibold">{label}</span>
        {overridden && <span className="ml-1.5 opacity-50 text-[9px]">(manual)</span>}
        {sublabel && <span className="block text-xs opacity-70 italic">{sublabel}</span>}
      </div>
    </button>
  );
}

function EMAPanel({ data }: { data: TickerResponse }) {
  const { passed, checks } = data.trendTemplate;
  const items = [
    { k: 'Price > 20-EMA',    c: checks.priceAboveEMA20   },
    { k: 'Price > 50-EMA',    c: checks.priceAboveEMA50   },
    { k: 'Price > 150-EMA',   c: checks.priceAboveEMA150  },
    { k: 'Price > 200-EMA',   c: checks.priceAboveEMA200  },
    { k: '50-EMA > 150-EMA',  c: checks.ema50AboveEma150  },
    { k: '150-EMA > 200-EMA', c: checks.ema150AboveEma200 },
    { k: '50-EMA > 200-SMA',  c: checks.ema50AboveSma200  },
    { k: '200-EMA rising',    c: checks.ema200Uptrending  },
    { k: 'Within 25% of hi',  c: checks.closeTo52wHigh    },
    { k: '30%+ above low',    c: checks.farFrom52wLow     },
  ];
  return (
    <div className={cn(
      'rounded-[10px] border overflow-hidden',
      passed ? 'border-[#10F088]/30 bg-[#10F088]/[0.04]' : 'border-red-500/25 bg-red-500/[0.03]',
    )}>
      <div className={cn('flex items-center justify-between px-4 py-2.5 border-b',
        passed ? 'border-[#10F088]/15' : 'border-red-500/12',
      )}>
        <div>
          <p className="text-[9px] uppercase tracking-[0.18em] font-semibold text-[var(--text-muted)] opacity-70 mb-px">
            Trend Template — Minervini
          </p>
          <p className="text-xs font-semibold text-[var(--text-secondary)]">
            {passed ? 'All structural conditions met' : 'One or more conditions failed'}
          </p>
        </div>
        <div className={cn(
          'flex flex-col items-center px-3 py-1.5 rounded-[8px] border min-w-[60px]',
          passed ? 'bg-[#10F088]/15 border-[#10F088]/35' : 'bg-red-500/10 border-red-500/30',
        )}>
          <span className={cn('text-[16px] font-extrabold', passed ? 'text-[#10F088]' : 'text-red-500')}>
            {passed ? '✓' : '✗'}
          </span>
          <span className={cn('text-[8px] font-bold uppercase tracking-widest', passed ? 'text-[#10F088]' : 'text-red-500')}>
            {passed ? 'PASS' : 'FAIL'}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 px-4 py-3">
        {items.map(({ k, c }) => (
          <div key={k} className="flex items-center gap-1.5 text-xs">
            <span className={cn('w-2.5 h-2.5 rounded-sm flex items-center justify-center flex-shrink-0',
              c.passed ? 'bg-[#10F088]/20' : 'bg-red-500/15',
            )}>
              {c.passed
                ? <Check className="w-1.5 h-1.5 text-[#10F088]" strokeWidth={4} />
                : <X     className="w-1.5 h-1.5 text-red-500"   strokeWidth={4} />}
            </span>
            <span className={c.passed ? 'text-[var(--text-dim)]' : 'text-[var(--text-muted)]'}>{k}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BlockersPanel({ gates, failedGates, stopExceedsMax, stopDistPct, maxStopPct }: {
  gates: Record<AllGateKey, boolean>;
  failedGates: AllGateKey[];
  stopExceedsMax: boolean;
  stopDistPct: number | null;
  maxStopPct: number;
}) {
  const isGateKey = (k: AllGateKey): k is Exclude<GateKey, AutoGateKey> => k in GATE_FAILURES;
  const manualFailed = MANUAL_GATES.filter(g => !gates[g.key]);
  const autoReasons: string[] = [
    ...(!gates.time_of_day      ? ['Entry timing: before 20:00 — professionals act in the final hour.'] : []),
    ...(!gates.volume_spike     ? ['No breakout volume spike — confirm volume before entry.'] : []),
    ...(!gates.stop_under_10pct ? ['Stop distance exceeds your max setting — tighten the stop.'] : []),
  ];
  const total = manualFailed.length + autoReasons.length + (stopExceedsMax ? 1 : 0);
  if (total === 0) return null;
  return (
    <div className="p-4 rounded-[10px] border border-red-500/25 bg-red-500/[0.04]">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
        <span className="text-xs font-bold text-red-500 uppercase tracking-wider">
          {total} blocker{total !== 1 ? 's' : ''} to resolve
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {stopExceedsMax && (
          <BlockerItem label="Stop too wide"
            detail={`${stopDistPct?.toFixed(2)}% — exceeds ${maxStopPct}% hard cap.`} critical />
        )}
        {manualFailed.map(gate => (
          <BlockerItem key={gate.key} label={gate.label}
            detail={isGateKey(gate.key) ? GATE_FAILURES[gate.key].why : gate.sublabel} />
        ))}
        {autoReasons.map(reason => (
          <BlockerItem key={reason} label="" detail={reason} />
        ))}
      </div>
    </div>
  );
}

function BlockerItem({ label, detail, critical }: { label: string; detail: string; critical?: boolean }) {
  return (
    <div className="flex items-start gap-2">
      <span className={cn('w-1 h-1 rounded-full mt-[6px] flex-shrink-0', critical ? 'bg-red-500' : 'bg-red-500/40')} />
      <div className="min-w-0 text-xs leading-snug text-[var(--text-dim)]">
        {label && <span className={cn('font-semibold mr-1', critical ? 'text-red-500' : 'text-[var(--text-muted)]')}>{label} —</span>}
        {detail}
      </div>
    </div>
  );
}

function LiveSnapshot({ data }: { data: TickerResponse }) {
  const isUp = data.price.dayChangePct >= 0;
  return (
    <div className="p-3 rounded-[10px] bg-[var(--bg-elevated)]/50 border border-[var(--border-subtle)]">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="font-mono text-[20px] font-bold tracking-tight text-[var(--text-primary)]">
          ${data.price.last.toFixed(2)}
        </span>
        <span className={cn('font-mono text-xs font-semibold flex items-center gap-1',
          isUp ? 'text-[#10F088]' : 'text-red-500',
        )}>
          {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {isUp ? '+' : ''}{data.price.dayChangePct.toFixed(2)}%
        </span>
      </div>
      <div className="grid grid-cols-4 gap-x-3 text-xs font-mono text-[var(--text-muted)]">
        <div><span className="text-[var(--text-faint)]">52W hi</span> <span className="text-[var(--text-dim)]">${data.range52w.high.toFixed(0)}</span></div>
        <div><span className="text-[var(--text-faint)]">52W lo</span> <span className="text-[var(--text-dim)]">${data.range52w.low.toFixed(0)}</span></div>
        <div><span className="text-[var(--text-faint)]">-hi</span> <span className="text-[var(--text-dim)]">{data.range52w.distanceFromHigh.toFixed(1)}%</span></div>
        <div><span className="text-[var(--text-faint)]">+lo</span> <span className="text-[var(--text-dim)]">+{data.range52w.distanceFromLow.toFixed(1)}%</span></div>
      </div>
    </div>
  );
}

function StopCandidatesPanel({ stops, selected, onSelect, maxStopPct }: {
  stops: StopCandidate[]; selected: number; onSelect: (p: number) => void; maxStopPct: number;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Info className="w-3 h-3 text-[var(--text-faint)]" />
        <span className="text-[9px] uppercase tracking-[0.14em] font-semibold text-[var(--text-faint)]">Stop candidates</span>
        <span className="text-[9px] text-[var(--text-faint)] opacity-60">· click to use</span>
      </div>
      <div className="flex flex-col gap-1">
        {stops.map(c => {
          const isSelected  = Math.abs(c.price - selected) < 0.01;
          const exceeds8Pct = Math.abs(c.distancePct) > maxStopPct;
          const label       = STOP_LABEL[c.type] ?? c.label;
          const isGrayed    = !c.valid || exceeds8Pct;
          return (
            <button key={c.type} type="button" onClick={() => onSelect(c.price)}
              className={cn(
                'flex items-center justify-between px-3 py-2 rounded-lg border text-left transition-all',
                isSelected && !isGrayed  && 'border-[#22D3EE]/35 bg-[#22D3EE]/[0.05]',
                !isSelected && !isGrayed && 'border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--border-hover)]',
                isGrayed && !isSelected  && 'border-red-500/15 bg-red-500/[0.02] opacity-55 hover:opacity-75',
                isGrayed && isSelected   && 'border-red-500/35 bg-red-500/[0.05]',
              )}
            >
              <div className="flex flex-col gap-px">
                <span className={cn('text-xs font-semibold',
                  isSelected ? 'text-[#22D3EE]' : isGrayed ? 'text-[var(--text-muted)]' : 'text-[var(--text-dim)]',
                )}>{label}</span>
                {exceeds8Pct && <span className="text-[9px] text-red-500">exceeds max — click to override</span>}
                {!exceeds8Pct && c.notes && <span className="text-[9px] text-[var(--text-faint)]">{c.notes}</span>}
              </div>
              <div className="flex flex-col items-end gap-px">
                <span className={cn('font-mono text-xs font-bold', isGrayed ? 'text-red-500' : 'text-[var(--text-primary)]')}>
                  ${c.price.toFixed(2)}
                </span>
                <span className={cn('font-mono text-[9px]', isGrayed ? 'text-red-500/70' : 'text-[var(--text-faint)]')}>
                  {c.distancePct.toFixed(2)}%{exceeds8Pct && ' · exceeds cap'}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PriceField({ label, accent, value, onChange, hasError }: {
  label: string; accent: 'cyan' | 'red'; value: string; onChange: (s: string) => void; hasError?: boolean;
}) {
  const palette = accent === 'cyan'
    ? { ring: 'focus:border-[#22D3EE] focus:ring-[#22D3EE]/15', text: 'text-[var(--text-primary)]' }
    : { ring: 'focus:border-red-500/60 focus:ring-red-500/10',   text: 'text-red-500' };
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs uppercase tracking-[0.14em] font-semibold text-[var(--text-muted)] opacity-70">{label}</label>
      <input inputMode="decimal" value={value} onChange={e => onChange(e.target.value)}
        className={cn(
          'bg-[var(--bg-input)] border rounded-[8px] px-3 py-2.5 font-mono text-[14px] font-semibold transition focus:outline-none focus:ring-[2px]',
          hasError
            ? 'border-[#FF3B5C] focus:border-[#FF3B5C] focus:ring-[#FF3B5C]/15 text-[#FF3B5C]'
            : cn('border-[var(--border-subtle)]', palette.ring, palette.text),
        )}
      />
    </div>
  );
}

function SizerOutput({ sizing }: { sizing: PositionSizerResult }) {
  if (sizing.status === 'rejected') {
    return (
      <div className="bg-red-500/[0.05] border border-red-500/25 text-red-500 px-3 py-2.5 rounded-[8px] text-xs font-medium flex items-center gap-2">
        <X className="w-3.5 h-3.5 flex-shrink-0" /><span>{sizing.message}</span>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2.5">
      <SizerRow k="Stop distance"     v={`${sizing.stopDistancePct.toFixed(2)}%`}    vClass="text-red-500" />
      <SizerRow k={`Risk · ${sizing.portfolioRiskPct.toFixed(2)}% of acc`} v={`$${sizing.dollarRisk.toFixed(0)}`} />
      <SizerRow k="Risk per share"    v={`$${sizing.riskPerShare.toFixed(2)}`} />
      <div className="pt-2.5 border-t border-dashed border-[var(--border-strong)] flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">Full position</span>
        <span className="font-mono text-[28px] font-extrabold tracking-tight text-[#22D3EE] tabular-nums">
          {sizing.totalShares}
        </span>
      </div>
      <SizerRow k="Phase 1 · breakout"
        v={`${sizing.phase1Shares} sh · $${sizing.phase1Notional.toLocaleString()}`}
        vClass="text-[#22D3EE]" />
      <SizerRow k="Phase 2 · retest"
        v={`${sizing.phase2Shares} sh · pending`}
        vClass="text-[var(--text-secondary)]" />
    </div>
  );
}

function SizerRow({ k, v, vClass }: { k: string; v: string; vClass?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs uppercase tracking-wider font-semibold text-[var(--text-faint)]">{k}</span>
      <span className={cn('font-mono text-[13px] font-semibold tabular-nums text-[var(--text-primary)]', vClass)}>{v}</span>
    </div>
  );
}

function MaxLossChip({ sizing, invested }: { sizing: PositionSizerResult; invested: number }) {
  const stopPct = sizing.status === 'ok' ? Math.abs(sizing.stopDistancePct) : null;
  const maxLoss = stopPct !== null && Number.isFinite(invested) && invested > 0
    ? invested * (stopPct / 100) : null;
  return (
    <div className="flex flex-col items-center justify-center px-3 py-2 rounded-[8px] border border-red-500/20 bg-red-500/[0.04] min-w-[90px]">
      <span className="text-[8px] uppercase tracking-[0.14em] font-bold text-[var(--text-faint)] mb-0.5">Max loss</span>
      <span className="font-mono text-[13px] font-bold text-red-500 tabular-nums">
        {maxLoss !== null ? `−$${maxLoss.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}
      </span>
    </div>
  );
}

// ── TickerSearchBar ────────────────────────────────────────────────────────────
// Standalone ticker input designed to sit at the very top of the dashboard.
// Renders prominently on both mobile and desktop so the trader can search any
// stock without scrolling. Wired to the same ValidatorProvider context that
// ChecklistCard and SizerCard read from — single source of truth.

export function TickerSearchBar({ className }: { className?: string }) {
  const { ticker, setTicker, data, loading, tickerInvalid } = useValidator();
  const [touched, setTouched] = useState(false);

  const up = data && data.price.dayChangePct >= 0;
  const changeColor = up ? '#10F088' : '#FF3B5C';

  return (
    <div
      className={cn(
        'rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden',
        className,
      )}
      style={{ boxShadow: 'var(--shadow-card), var(--inner-highlight)' }}
    >
      {/* Top row — input */}
      <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <div className="flex-shrink-0">
          <div className="text-[9.5px] uppercase tracking-[0.2em] font-extrabold text-[#22D3EE] mb-0.5">
            Validator
          </div>
          <div className="text-[12.5px] sm:text-[13px] text-[var(--text-muted)] leading-snug">
            Run the Trend Template on any ticker
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="relative">
            <input
              value={ticker}
              onChange={e => {
                setTouched(false);
                setTicker(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5));
              }}
              onBlur={() => setTouched(true)}
              placeholder="TICKER"
              className={cn(
                'w-full bg-[var(--bg-input)] border rounded-[10px] px-4 py-3 sm:py-3.5 pr-12 font-mono text-[22px] sm:text-[24px] font-bold tracking-tight uppercase text-[var(--text-primary)] focus:outline-none focus:ring-[3px] transition placeholder:text-[var(--text-faint)]',
                touched && tickerInvalid
                  ? 'border-[#FF3B5C] focus:border-[#FF3B5C] focus:ring-[#FF3B5C]/15'
                  : 'border-[var(--border-subtle)] focus:border-[#22D3EE] focus:ring-[#22D3EE]/15',
              )}
            />
            {loading && (
              <Loader2 className="absolute top-1/2 right-3.5 -translate-y-1/2 w-4 h-4 animate-spin text-[#22D3EE]" />
            )}
          </div>
          {touched && tickerInvalid && (
            <p className="text-[11px] text-[#FF3B5C] mt-1.5">{TICKER_ERROR}</p>
          )}
        </div>
      </div>

      {/* Bottom row — beautiful live quote panel */}
      {data && (
        <div
          className="border-t border-[var(--border-subtle)] px-4 sm:px-5 py-3.5"
          style={{ background: `linear-gradient(90deg, ${changeColor}06 0%, transparent 60%)` }}
        >
          <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
            {/* Main price block */}
            <div className="flex items-baseline gap-2.5">
              <span className="font-mono text-[var(--text-faint)] text-[14px] sm:text-[15px] font-bold">$</span>
              <span
                className="font-mono text-[28px] sm:text-[36px] font-extrabold tracking-tight tabular-nums leading-none"
                style={{ color: 'var(--text-primary)' }}
              >
                {data.price.last.toFixed(2)}
              </span>
              <div className="flex items-center gap-1 ml-1">
                {up
                  ? <TrendingUp   className="w-3.5 h-3.5" style={{ color: changeColor }} strokeWidth={2.5} />
                  : <TrendingDown className="w-3.5 h-3.5" style={{ color: changeColor }} strokeWidth={2.5} />}
                <span
                  className="font-mono text-[14px] sm:text-[16px] font-extrabold tabular-nums leading-none"
                  style={{ color: changeColor }}
                >
                  {up ? '+' : ''}{data.price.dayChangePct.toFixed(2)}%
                </span>
              </div>
            </div>

            {/* Divider */}
            <div className="hidden sm:block w-px h-9 bg-[var(--border-subtle)]" />

            {/* Stat tiles */}
            <div className="flex items-center gap-3 sm:gap-4 flex-wrap text-[11px] sm:text-[12px]">
              <StatTileSm label="Prev close" value={`$${data.price.previousClose.toFixed(2)}`} />
              {data.range52w && (
                <>
                  <StatTileSm
                    label="52W high"
                    value={`$${data.range52w.high.toFixed(2)}`}
                    sub={`${data.range52w.distanceFromHigh.toFixed(1)}%`}
                    subColor={data.range52w.distanceFromHigh >= -25 ? '#10F088' : '#FF3B5C'}
                  />
                  <StatTileSm
                    label="52W low"
                    value={`$${data.range52w.low.toFixed(2)}`}
                  />
                </>
              )}
              {data.volume && (
                <StatTileSm
                  label="Vol vs 50d"
                  value={`${data.volume.ratio.toFixed(2)}×`}
                  subColor={data.volume.ratio >= 1.5 ? '#10F088' : data.volume.ratio < 0.7 ? '#FF3B5C' : undefined}
                />
              )}
            </div>

            {/* Trend Template badge — far right */}
            <div className="ml-auto flex-shrink-0">
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-extrabold uppercase tracking-[0.16em] border',
                  data.trendTemplate.passed
                    ? 'bg-[#10F088]/15 text-[#10F088] border-[#10F088]/30'
                    : 'bg-[#FF3B5C]/15 text-[#FF3B5C] border-[#FF3B5C]/30',
                )}
              >
                {data.trendTemplate.passed
                  ? <><Check className="w-3 h-3" strokeWidth={3.5} />Trend Template</>
                  : <><X className="w-3 h-3" strokeWidth={3.5} />Fails Template</>}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatTileSm({ label, value, sub, subColor }: {
  label: string;
  value: string;
  sub?: string;
  subColor?: string;
}) {
  return (
    <div className="flex flex-col leading-tight">
      <span className="text-[8.5px] uppercase tracking-[0.16em] font-bold text-[var(--text-faint)]">
        {label}
      </span>
      <span className="font-mono font-bold text-[12.5px] sm:text-[13px] text-[var(--text-secondary)] tabular-nums">
        {value}
        {sub && (
          <span
            className="ml-1 text-[10.5px] font-bold"
            style={{ color: subColor ?? 'var(--text-faint)' }}
          >
            {sub}
          </span>
        )}
      </span>
    </div>
  );
}

