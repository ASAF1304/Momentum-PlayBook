'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Maximize2, X } from 'lucide-react';

interface TradingViewChartProps {
  ticker: string;
  height?: number;
}

// Study definitions — tested IDs for the TradingView Advanced Chart embed widget
const STUDIES = [
  {
    id: 'MAExp@tv-basicstudies',
    inputs: { length: 20, source: 'close' },
    overrides: { 'Plot.color': '#3B82F6', 'Plot.linewidth': 2 },
  },
  {
    id: 'MAExp@tv-basicstudies',
    inputs: { length: 50, source: 'close' },
    overrides: { 'Plot.color': '#22C55E', 'Plot.linewidth': 2 },
  },
  {
    id: 'MASimple@tv-basicstudies',
    inputs: { length: 200, source: 'close' },
    overrides: { 'Plot.color': '#EF4444', 'Plot.linewidth': 2 },
  },
  // Daily-reset VWAP (amber). True Anchored VWAP requires clicking an anchor
  // point in the drawing toolbar — use the "Anchored VWAP" tool on the left bar.
  {
    id: 'VWAP@tv-basicstudies',
    overrides: { 'VWAP.color': '#F59E0B', 'VWAP.linewidth': 2 },
  },
  // Anchored VWAP as a study — widget may or may not honor the anchor;
  // if it renders it will anchor to the start of the visible range.
  {
    id: 'AnchoredVWAP@tv-basicstudies',
    overrides: { 'Plot.color': '#F59E0B', 'Plot.linewidth': 2 },
  },
  // Volume MA overlaid on the volume pane
  {
    id: 'Volume MA@tv-basicstudies',
    inputs: { length: 20 },
    overrides: { 'Plot.color': '#EF4444', 'Plot.linewidth': 2 },
  },
];

// Drawing tools to whitelist — the side toolbar (hide_side_toolbar:false) already
// shows all drawing tools by default in the free widget. This `drawings_access`
// config is a Charting Library option; the embed widget may ignore it silently.
const DRAWINGS_ACCESS = {
  type: 'white' as const,
  tools: [
    { name: 'Trend Line' },
    { name: 'Rectangle' },
    { name: 'Horizontal Line' },
    { name: 'Horizontal Ray' },
    { name: 'Arrow' },
    { name: 'Text' },
    { name: 'Anchored VWAP' },
    { name: 'VWAP' },
    { name: 'Fib Retracement' },
  ],
};

const LEGEND = [
  { label: 'EMA 20',   color: '#3B82F6' },
  { label: 'EMA 50',   color: '#22C55E' },
  { label: 'SMA 200',  color: '#EF4444' },
  { label: 'VWAP',     color: '#F59E0B' },
  { label: 'AVWAP',    color: '#F59E0B' },
  { label: 'Vol MA',   color: '#EF4444' },
];

function ChartLegend() {
  return (
    <div className="flex items-center gap-4 px-3 py-1.5 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]">
      {LEGEND.map(({ label, color }) => (
        <div key={label} className="flex items-center gap-1.5">
          <span
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: color }}
          />
          <span className="font-mono text-xs text-[var(--text-faint)]">{label}</span>
        </div>
      ))}
    </div>
  );
}

function ChartWidget({
  ticker, height, theme,
}: {
  ticker: string;
  height: number;
  theme: 'dark' | 'light';
}) {
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
      studies: STUDIES,
      drawings_access: DRAWINGS_ACCESS,
      // enabled_features / disabled_features are Charting Library options;
      // the free embed widget may ignore them — listed here for completeness.
      enabled_features: [
        'use_localstorage_for_settings',
        'side_toolbar_in_fullscreen_mode',
        'header_fullscreen_button',
        'study_templates',
        'drawing_templates',
      ],
      disabled_features: [
        'header_compare',
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
          <ChartLegend />
          <div className="flex-1 overflow-hidden">
            <ChartWidget ticker={ticker} height={window.innerHeight - 80} theme={theme} />
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <div className="w-full flex flex-col">
      <ChartLegend />
      <div className="relative w-full" style={{ height }}>
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
      </div>
      {modal}
    </div>
  );
}
