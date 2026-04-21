'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Maximize2, X } from 'lucide-react';

interface TradingViewChartProps {
  ticker: string;
  height?: number;
}

function ChartWidget({ ticker, height, theme }: { ticker: string; height: number; theme: 'dark' | 'light' }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = '';

    const widgetDiv = document.createElement('div');
    widgetDiv.className = 'tradingview-widget-container__widget';
    widgetDiv.style.height = `${height}px`;
    container.appendChild(widgetDiv);

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.async = true;
    script.textContent = JSON.stringify({
      autosize: true,
      symbol: ticker,
      interval: 'D',
      timezone: 'Etc/UTC',
      theme,
      style: '1',
      locale: 'en',
      enable_publishing: false,
      hide_top_toolbar: false,
      hide_side_toolbar: false,
      hide_legend: false,
      allow_symbol_change: true,
      save_image: false,
      calendar: false,
      hide_volume: false,
      studies: [
        { id: 'STD;MA', inputs: { length: 50, source: 'close' } },
        { id: 'STD;MA', inputs: { length: 200, source: 'close' } },
      ],
      support_host: 'https://www.tradingview.com',
    });

    container.appendChild(script);

    return () => { container.innerHTML = ''; };
  }, [ticker, height, theme]);

  return (
    <div
      ref={containerRef}
      className="tradingview-widget-container w-full"
      style={{ height }}
    />
  );
}

export function TradingViewChart({ ticker, height = 500 }: TradingViewChartProps) {
  const [fullscreen, setFullscreen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    setMounted(true);
    const isDark =
      document.documentElement.getAttribute('data-theme') === 'dark' ||
      document.documentElement.classList.contains('dark') ||
      window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(isDark ? 'dark' : 'light');
  }, []);

  const modal = mounted && fullscreen
    ? createPortal(
        <div className="fixed inset-0 z-[9999] flex flex-col bg-[var(--bg-primary)]">
          <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-subtle)]">
            <span className="font-mono text-[14px] font-bold text-[var(--text-primary)]">{ticker}</span>
            <button
              onClick={() => setFullscreen(false)}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <ChartWidget ticker={ticker} height={window.innerHeight - 48} theme={theme} />
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <div className="relative w-full rounded-[8px] overflow-hidden" style={{ height }}>
      <ChartWidget ticker={ticker} height={height} theme={theme} />
      {mounted && (
        <button
          onClick={() => setFullscreen(true)}
          title="Expand chart"
          className="absolute top-2 right-2 z-10 w-7 h-7 flex items-center justify-center rounded-md bg-[var(--bg-surface)]/80 border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors backdrop-blur-sm"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      )}
      {modal}
    </div>
  );
}
