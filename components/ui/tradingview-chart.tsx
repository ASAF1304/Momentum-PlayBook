'use client';

import { useEffect, useRef } from 'react';

interface TradingViewChartProps {
  ticker: string;
  height?: number;
}

export function TradingViewChart({ ticker, height = 380 }: TradingViewChartProps) {
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
      theme: 'dark',
      style: '1',
      locale: 'en',
      toolbar_bg: '#040507',
      backgroundColor: 'rgba(4,5,7,0)',
      gridColor: 'rgba(255,255,255,0.03)',
      enable_publishing: false,
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: false,
      calendar: false,
      hide_volume: false,
      studies: ['STD;EMA', 'STD;EMA', 'STD;EMA'],
      support_host: 'https://www.tradingview.com',
    });

    container.appendChild(script);

    return () => { container.innerHTML = ''; };
  }, [ticker, height]);

  return (
    <div
      ref={containerRef}
      className="tradingview-widget-container w-full rounded-[8px] overflow-hidden"
      style={{ height }}
    />
  );
}
