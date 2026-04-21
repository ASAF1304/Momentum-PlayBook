// lib/use-live-prices.ts
//
// React hook that polls /api/live-prices every 60 seconds.
// Pauses when the tab is hidden; resumes + refetches immediately on tab focus.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { LivePrice, LivePricesResponse } from '@/app/api/live-prices/route';

export type { LivePrice };

export interface UseLivePricesResult {
  prices: Record<string, LivePrice>;
  lastUpdated: Date | null;
  refreshing: boolean;
  refresh: () => void;
}

const POLL_INTERVAL_MS = 60_000;

export function useLivePrices(tickers: string[]): UseLivePricesResult {
  const [prices,      setPrices]      = useState<Record<string, LivePrice>>({});
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing,  setRefreshing]  = useState(false);

  const tickersKey  = tickers.join(',');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef    = useRef<AbortController | null>(null);

  const fetchPrices = useCallback(async () => {
    if (tickers.length === 0) return;

    // Cancel any in-flight request before starting a new one
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setRefreshing(true);
    try {
      const res = await globalThis.fetch('/api/live-prices', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ tickers }),
        signal:  controller.signal,
      });
      if (!res.ok) return;
      const data = await res.json() as LivePricesResponse;
      setPrices(data.prices);
      setLastUpdated(new Date(data.fetchedAt));
    } catch {
      // AbortError or network failure — silently skip
    } finally {
      setRefreshing(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickersKey]);

  const startInterval = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      if (document.visibilityState === 'visible') void fetchPrices();
    }, POLL_INTERVAL_MS);
  }, [fetchPrices]);

  useEffect(() => {
    if (tickers.length === 0) return;

    void fetchPrices();
    startInterval();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void fetchPrices();
        startInterval();
      } else {
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      if (intervalRef.current) clearInterval(intervalRef.current);
      abortRef.current?.abort();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickersKey]);

  return { prices, lastUpdated, refreshing, refresh: fetchPrices };
}
