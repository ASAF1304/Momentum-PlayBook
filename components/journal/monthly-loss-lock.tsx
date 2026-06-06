// components/journal/monthly-loss-lock.tsx
//
// Pillar 1 (Method Enforcement): when the user has hit their self-set monthly
// loss limit, new entries are blocked until the next calendar month.
//
// The lock screen is intentionally NOT dismissable — closing it cancels the
// "add trade" action. The user can still open existing trades, close positions
// and review the journal; only NEW entries are gated.

'use client';

import Link from 'next/link';
import { ShieldAlert, X } from 'lucide-react';
import type { Trade } from '@/lib/supabase-client';
import { getSells } from '@/lib/trade-utils';

export function computeCurrentMonthRealizedPnL(trades: Trade[], now = new Date()): number {
  const month = now.getUTCMonth();
  const year  = now.getUTCFullYear();

  const inThisMonth = (iso: string) => {
    const d = new Date(iso);
    return d.getUTCFullYear() === year && d.getUTCMonth() === month;
  };

  let pnl = 0;
  for (const t of trades) {
    if (t.status !== 'open' && t.exit_date && inThisMonth(t.exit_date) && t.pnl_dollars != null) {
      pnl += t.pnl_dollars;
    }
    for (const p of getSells(t)) {
      if (inThisMonth(p.date)) pnl += p.pnl_dollars;
    }
  }
  return pnl;
}

interface MonthlyLossLockProps {
  monthPnL: number;        // negative when losing
  limitUsd: number;        // positive limit (e.g., 5000 = -$5000 cap)
  onClose: () => void;
}

export function MonthlyLossLock({ monthPnL, limitUsd, onClose }: MonthlyLossLockProps) {
  const lossAmount = Math.abs(Math.min(monthPnL, 0));
  const nextMonth = new Date();
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1, 1);
  const nextMonthLabel = nextMonth.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-[var(--modal-overlay)] backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-[460px] rounded-[16px] border border-[#FF3B5C]/40 bg-[var(--bg-modal)] overflow-hidden"
        style={{ boxShadow: '0 0 0 1px rgba(255,59,92,0.18), 0 24px 80px rgba(0,0,0,0.6)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="h-[3px] w-full bg-gradient-to-r from-[#FF3B5C] via-[#FF3B5C] to-[#FF6B81]" />

        <div className="p-7 text-center">
          <div
            className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-5 border"
            style={{ background: '#FF3B5C14', borderColor: '#FF3B5C40' }}
          >
            <ShieldAlert className="w-8 h-8 text-[#FF3B5C]" strokeWidth={2} />
          </div>

          <div className="text-[10px] uppercase tracking-[0.2em] font-extrabold text-[#FF3B5C] mb-1.5">
            Monthly loss limit reached
          </div>
          <h2 className="text-[20px] font-extrabold tracking-tight text-[var(--text-primary)] mb-3">
            New entries paused
          </h2>

          <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed mb-5 max-w-[360px] mx-auto">
            You set a max monthly loss of{' '}
            <span className="font-mono font-bold text-[var(--text-primary)]">${limitUsd.toLocaleString()}</span>.
            This month you&apos;re down{' '}
            <span className="font-mono font-bold text-[#FF3B5C]">−${lossAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>.
            The system will unlock new entries on{' '}
            <span className="font-bold text-[var(--text-primary)]">{nextMonthLabel}</span>.
          </p>

          <div className="rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-4 py-3 mb-5 text-left">
            <div className="text-[10px] uppercase tracking-[0.16em] font-bold text-[var(--text-faint)] mb-1.5">
              What you can still do
            </div>
            <ul className="text-[12px] text-[var(--text-secondary)] space-y-1.5 leading-snug">
              <li>· Manage and exit open positions</li>
              <li>· Review past trades in Playbook</li>
              <li>· Update or tighten existing stops</li>
              <li>· Adjust the limit in Settings</li>
            </ul>
          </div>

          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-[10px] border border-[var(--border-subtle)] text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-all flex items-center justify-center gap-2"
            >
              <X className="w-3 h-3" /> Close
            </button>
            <Link
              href="/settings"
              className="flex-1 py-3 rounded-[10px] bg-gradient-to-br from-[#22D3EE] to-[#10F088] text-black text-xs font-extrabold uppercase tracking-wider hover:brightness-110 hover:-translate-y-px transition-all flex items-center justify-center gap-2"
            >
              Adjust limit
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
