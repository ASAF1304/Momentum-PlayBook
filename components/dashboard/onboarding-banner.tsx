// components/dashboard/onboarding-banner.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { X, BookOpen, Upload } from 'lucide-react';

const STORAGE_KEY = 'onboarding_dismissed';

interface OnboardingBannerProps {
  onAddTrade: () => void;
}

export function OnboardingBanner({ onAddTrade }: OnboardingBannerProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(STORAGE_KEY);
      if (!dismissed) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  const dismiss = () => {
    try { localStorage.setItem(STORAGE_KEY, 'true'); } catch {}
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="mb-5 relative rounded-[14px] border border-[#22D3EE]/25 overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, rgba(34,211,238,0.06) 0%, rgba(16,240,136,0.04) 100%)',
        boxShadow: '0 0 0 1px rgba(34,211,238,0.1) inset',
      }}
    >
      {/* Dismiss */}
      <button
        type="button"
        onClick={dismiss}
        className="absolute top-3 right-3 p-1 rounded-md text-[var(--text-faint)] hover:text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      <div className="px-5 pt-5 pb-4">
        {/* Headline */}
        <div className="mb-1 flex items-center gap-2">
          <span className="text-[15px] font-extrabold tracking-tight text-[var(--text-primary)]">
            Welcome to Momentum Playbook
          </span>
          <span className="text-[9px] uppercase tracking-[0.18em] font-bold px-2 py-0.5 rounded-full bg-[#22D3EE]/15 text-[#22D3EE]">
            New
          </span>
        </div>
        <p className="text-xs text-[var(--text-muted)] mb-4 leading-relaxed max-w-[520px]">
          Start tracking your Stage 2 trades. Import your broker history in seconds, or log your first trade manually using the Minervini checklist.
        </p>

        {/* CTAs */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/journal?import=1"
            className="flex items-center gap-2 px-4 py-2 rounded-[9px] text-xs font-bold bg-gradient-to-r from-[#22D3EE] to-[#10F088] text-black hover:brightness-110 transition-all"
          >
            <Upload className="w-3.5 h-3.5" />
            Import from Broker
          </Link>
          <button
            type="button"
            onClick={() => { dismiss(); onAddTrade(); }}
            className="flex items-center gap-2 px-4 py-2 rounded-[9px] text-xs font-bold border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-all"
          >
            <BookOpen className="w-3.5 h-3.5" />
            Add First Trade
          </button>
        </div>
      </div>
    </div>
  );
}
