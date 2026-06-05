'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import type { Trade } from '@/lib/supabase-client';
import type { LivePrice } from '@/lib/use-live-prices';

interface Props {
  openTrades: Trade[];
  livePrices: Record<string, LivePrice>;
}

const LS_KEY = 'stop_alerts_acknowledged';

function getAcknowledged(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? new Set<string>(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function saveAcknowledged(set: Set<string>) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify([...set]));
  } catch { /* ignore */ }
}

// Key per trade+stop so re-breaching after a stop move shows again
function alertKey(trade: Trade): string {
  return `${trade.id}:${trade.current_stop ?? trade.initial_stop}`;
}

export function StopAlertBanner({ openTrades, livePrices }: Props) {
  const [acknowledged, setAcknowledged] = useState<Set<string>>(new Set());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setAcknowledged(getAcknowledged());
    setMounted(true);
  }, []);

  const breaches = openTrades.filter(t => {
    const stop = t.current_stop ?? t.initial_stop;
    if (!stop) return false;
    const price = livePrices[t.ticker]?.price;
    if (!price) return false;
    return price < stop;
  });

  const visible = breaches.filter(t => !acknowledged.has(alertKey(t)));

  if (!mounted || visible.length === 0) return null;

  const acknowledge = (trade: Trade) => {
    setAcknowledged(prev => {
      const next = new Set(prev);
      next.add(alertKey(trade));
      saveAcknowledged(next);
      return next;
    });
  };

  const acknowledgeAll = () => {
    setAcknowledged(prev => {
      const next = new Set(prev);
      for (const t of visible) next.add(alertKey(t));
      saveAcknowledged(next);
      return next;
    });
  };

  return (
    <div className="mb-6 flex flex-col gap-2">
      {visible.map(trade => {
        const stop  = trade.current_stop ?? trade.initial_stop ?? 0;
        const price = livePrices[trade.ticker]?.price ?? 0;
        return (
          <div
            key={trade.id}
            className="flex items-start gap-3 rounded-xl border border-[#FF3B5C]/40 bg-[#FF3B5C]/10 px-4 py-3"
          >
            <AlertTriangle className="w-4 h-4 text-[#FF3B5C] mt-0.5 shrink-0" strokeWidth={2.5} />
            <p className="text-[13px] text-[var(--text-primary)] flex-1 leading-relaxed">
              <span className="font-extrabold text-[#FF3B5C]">STOP ALERT:</span>{' '}
              <span className="font-bold font-mono">${trade.ticker}</span> is trading below your stop of{' '}
              <span className="font-bold">${stop.toFixed(2)}</span>. Current price:{' '}
              <span className="font-bold">${price.toFixed(2)}</span>.
            </p>
            <button
              onClick={() => acknowledge(trade)}
              className="shrink-0 text-[11px] font-extrabold uppercase tracking-wider px-3 py-1.5 rounded-lg border border-[#FF3B5C]/50 text-[#FF3B5C] hover:bg-[#FF3B5C]/20 transition-colors"
            >
              Acknowledge
            </button>
          </div>
        );
      })}

      {visible.length > 1 && (
        <button
          onClick={acknowledgeAll}
          className="self-end text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        >
          Acknowledge all
        </button>
      )}
    </div>
  );
}
