// components/dashboard/market-regime-banner.tsx
//
// Detects the broad market regime via SPY's position vs. EMAs.
// Pillar 1 (Method Enforcement): the trader sees the market stage every time they
// open the app. In Stage 3-4 the banner explicitly recommends defensive sizing.
//
// Stage 2 (uptrend):    price > EMA50 > EMA200, EMA200 rising, near 52w high
// Stage 3 (rolling top): below EMA50 but above EMA200 — caution
// Stage 4 (downtrend):   below EMA200 OR EMA200 not rising — DEFEND MODE

'use client';

import { useEffect, useState } from 'react';
import { Activity, AlertTriangle, ShieldAlert, TrendingUp } from 'lucide-react';
import type { TickerResponse } from '@/app/api/ticker/[symbol]/route';

type Regime = 'stage2' | 'stage3' | 'stage4' | 'loading' | 'unavailable';

interface RegimeInfo {
  regime: Regime;
  price?: number;
  ema50?: number;
  ema200?: number;
  ema200Up?: boolean;
}

const CACHE_KEY = 'mp_spy_regime_v1';
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function classifyRegime(data: TickerResponse): RegimeInfo {
  const price    = data.price.last;
  const ema50    = data.movingAverages.ema50;
  const ema200   = data.movingAverages.ema200;
  const ema200Up = data.trendTemplate.checks.ema200Uptrending.passed;

  if (price < ema200 || !ema200Up) {
    return { regime: 'stage4', price, ema50, ema200, ema200Up };
  }
  if (price < ema50) {
    return { regime: 'stage3', price, ema50, ema200, ema200Up };
  }
  return { regime: 'stage2', price, ema50, ema200, ema200Up };
}

export function MarketRegimeBanner() {
  const [info, setInfo] = useState<RegimeInfo>({ regime: 'loading' });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const cachedRaw = typeof window !== 'undefined' ? localStorage.getItem(CACHE_KEY) : null;
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw) as { at: number; info: RegimeInfo };
          if (Date.now() - cached.at < CACHE_TTL_MS) {
            setInfo(cached.info);
            return;
          }
        }

        const res = await fetch('/api/ticker/SPY');
        if (!res.ok) {
          if (!cancelled) setInfo({ regime: 'unavailable' });
          return;
        }
        const data = (await res.json()) as TickerResponse;
        const next = classifyRegime(data);
        if (cancelled) return;
        setInfo(next);
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), info: next }));
        } catch { /* ignore quota */ }
      } catch {
        if (!cancelled) setInfo({ regime: 'unavailable' });
      }
    };

    void load();
    return () => { cancelled = true; };
  }, []);

  if (info.regime === 'loading' || info.regime === 'unavailable') return null;

  const cfg = (() => {
    switch (info.regime) {
      case 'stage2':
        return {
          tone:        '#10F088',
          icon:        TrendingUp,
          label:       'STAGE 2',
          headline:    'Market in confirmed uptrend',
          detail:      'SPY trading above 50EMA and 200EMA. Full-size positions allowed by system rules.',
          actionLabel: 'OFFENSE',
        };
      case 'stage3':
        return {
          tone:        '#F59E0B',
          icon:        Activity,
          label:       'STAGE 3 CAUTION',
          headline:    'SPY below 50EMA — rolling top warning',
          detail:      'Reduce new position size. Tighten stops on open trades. Wait for SPY to reclaim 50EMA before re-loading.',
          actionLabel: 'CAUTION',
        };
      case 'stage4':
        return {
          tone:        '#FF3B5C',
          icon:        ShieldAlert,
          label:       'DEFEND MODE',
          headline:    'SPY below 200EMA — market in Stage 4',
          detail:      'Stage 4 markets destroy momentum traders. System recommends pausing new entries and tightening all stops.',
          actionLabel: 'DEFEND',
        };
    }
  })();

  const Icon = cfg.icon;

  return (
    <div
      className="max-w-[1440px] mx-auto px-4 sm:px-6 pt-4"
      role="status"
      aria-live="polite"
    >
      <div
        className="flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3 rounded-[12px] border relative overflow-hidden"
        style={{
          background:   `${cfg.tone}0F`,
          borderColor:  `${cfg.tone}40`,
          boxShadow:    `0 0 0 1px ${cfg.tone}1A, 0 6px 24px rgba(0,0,0,0.18)`,
        }}
      >
        <div
          className="absolute inset-y-0 left-0 w-[3px]"
          style={{ background: cfg.tone }}
        />

        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border"
          style={{ background: `${cfg.tone}1F`, borderColor: `${cfg.tone}55` }}
        >
          <Icon className="w-5 h-5" style={{ color: cfg.tone }} strokeWidth={2.2} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span
              className="text-[9.5px] font-extrabold uppercase tracking-[0.18em]"
              style={{ color: cfg.tone }}
            >
              {cfg.label}
            </span>
            <span className="text-[9.5px] font-mono text-[var(--text-faint)]">·</span>
            <span className="text-[11px] sm:text-[12px] font-bold text-[var(--text-primary)]">
              {cfg.headline}
            </span>
          </div>
          <p className="text-[11.5px] sm:text-[12.5px] text-[var(--text-muted)] leading-snug line-clamp-2">
            {cfg.detail}
          </p>
        </div>

        {info.price != null && info.ema50 != null && info.ema200 != null && (
          <div className="hidden md:flex flex-col items-end gap-0.5 flex-shrink-0 font-mono text-[10.5px]">
            <div className="flex items-center gap-1.5">
              <span className="uppercase text-[var(--text-faint)] tracking-wider">SPY</span>
              <span className="font-bold text-[var(--text-primary)]">${info.price.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
              <span>50EMA ${info.ema50.toFixed(2)}</span>
              <span style={{ color: cfg.tone }}>•</span>
              <span>200EMA ${info.ema200.toFixed(2)}</span>
            </div>
          </div>
        )}

        <span
          className="hidden sm:flex flex-shrink-0 items-center gap-1 px-2.5 py-1 rounded-md text-[9px] font-extrabold uppercase tracking-[0.16em]"
          style={{ background: `${cfg.tone}1F`, color: cfg.tone, border: `1px solid ${cfg.tone}40` }}
        >
          {info.regime === 'stage4' && <AlertTriangle className="w-2.5 h-2.5" strokeWidth={3} />}
          {cfg.actionLabel}
        </span>
      </div>
    </div>
  );
}
