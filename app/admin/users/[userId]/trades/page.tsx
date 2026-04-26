// app/admin/users/[userId]/trades/page.tsx
// Admin-only: view all trades for a specific user.
// Uses service-role API (bypasses RLS) — does NOT modify existing /journal.

'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { computeWinRate } from '@/lib/stats/win-rate';
import { cn } from '@/lib/utils';
import type { Trade } from '@/lib/supabase-client';

const OUTCOME_COLOR: Record<string, string> = {
  winner:    'text-[#10F088]',
  loser:     'text-[#FF3B5C]',
  breakeven: 'text-[#FF9F0A]',
};

const STATUS_BADGE: Record<string, string> = {
  open:        'text-[#22D3EE] bg-[#22D3EE]/10',
  closed:      'text-[#10F088] bg-[#10F088]/10',
  stopped_out: 'text-[#FF3B5C] bg-[#FF3B5C]/10',
};

export default function AdminUserTradesPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = use(params);
  const router = useRouter();
  const { profile, loading: authLoading } = useAuth();

  const [trades,  setTrades]  = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [email,   setEmail]   = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!profile?.is_admin) { router.replace('/'); return; }

    Promise.all([
      fetch(`/api/admin/users/${userId}/trades`).then(r => r.json()),
      fetch('/api/admin/users').then(r => r.json()),
    ]).then(([tradeData, userList]) => {
      setTrades(Array.isArray(tradeData) ? tradeData : []);
      const found = (userList as { id: string; email: string }[]).find(u => u.id === userId);
      if (found) setEmail(found.email);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [authLoading, profile, router, userId]);

  const stats = computeWinRate(trades);
  const open  = trades.filter(t => t.status === 'open').length;

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#22D3EE]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] font-[Manrope,ui-sans-serif,system-ui,sans-serif]">
      {/* Header */}
      <div className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-6 py-4">
        <div className="max-w-[1200px] mx-auto flex items-center gap-4">
          <button
            onClick={() => router.push('/admin/users')}
            className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            חזרה
          </button>
          <div>
            <h1 className="text-base font-extrabold text-[var(--text-primary)]">
              יומן מסחר — Admin View
            </h1>
            {email && <p className="text-xs text-[var(--text-faint)]">{email}</p>}
          </div>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-6 py-8 space-y-6">
        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MiniStat label="סה״כ" value={String(trades.length)} />
          <MiniStat label="פתוחים" value={String(open)} />
          <MiniStat
            label="Win Rate"
            value={stats.winRate != null ? `${stats.winRate.toFixed(1)}%` : '—'}
            color={stats.winRate != null ? (stats.winRate >= 50 ? '#10F088' : '#FF3B5C') : undefined}
          />
          <MiniStat
            label="P&L כולל"
            value={`$${stats.totalPnL.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
            color={stats.totalPnL >= 0 ? '#10F088' : '#FF3B5C'}
          />
        </div>

        {/* Trades table */}
        <div className="rounded-xl border border-[var(--border-subtle)] overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg-elevated)] text-[var(--text-secondary)] text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 text-right font-semibold">טיקר</th>
                <th className="px-4 py-3 text-right font-semibold">כניסה</th>
                <th className="px-4 py-3 text-right font-semibold">מחיר כניסה</th>
                <th className="px-4 py-3 text-right font-semibold">יציאה</th>
                <th className="px-4 py-3 text-right font-semibold">מחיר יציאה</th>
                <th className="px-4 py-3 text-right font-semibold">סטטוס</th>
                <th className="px-4 py-3 text-right font-semibold">תוצאה</th>
                <th className="px-4 py-3 text-right font-semibold">P&L</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {trades.map(t => (
                <tr key={t.id} className="bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] transition-colors">
                  <td className="px-4 py-3 font-bold text-[var(--text-primary)] font-mono">
                    <div className="flex items-center gap-1.5">
                      {t.status === 'open'
                        ? <TrendingUp className="w-3.5 h-3.5 text-[#22D3EE]" />
                        : t.outcome === 'winner'
                          ? <TrendingUp className="w-3.5 h-3.5 text-[#10F088]" />
                          : <TrendingDown className="w-3.5 h-3.5 text-[#FF3B5C]" />}
                      {t.ticker}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--text-muted)]">
                    {t.phase1_date ? new Date(t.phase1_date).toLocaleDateString('he-IL') : '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-[var(--text-primary)]">
                    ${t.phase1_price.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--text-muted)]">
                    {t.exit_date ? new Date(t.exit_date).toLocaleDateString('he-IL') : '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-[var(--text-muted)]">
                    {t.exit_price != null ? `$${t.exit_price.toFixed(2)}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      'inline-block px-2 py-0.5 rounded-full text-xs font-semibold',
                      STATUS_BADGE[t.status] ?? '',
                    )}>
                      {t.status}
                    </span>
                  </td>
                  <td className={cn('px-4 py-3 text-xs font-semibold', OUTCOME_COLOR[t.outcome ?? ''] ?? 'text-[var(--text-faint)]')}>
                    {t.outcome ?? '—'}
                  </td>
                  <td className={cn(
                    'px-4 py-3 font-mono text-sm font-bold',
                    t.pnl_dollars != null
                      ? t.pnl_dollars >= 0 ? 'text-[#10F088]' : 'text-[#FF3B5C]'
                      : 'text-[var(--text-faint)]',
                  )}>
                    {t.pnl_dollars != null
                      ? `${t.pnl_dollars >= 0 ? '+' : ''}$${t.pnl_dollars.toFixed(0)}`
                      : '—'}
                  </td>
                </tr>
              ))}

              {trades.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-[var(--text-faint)]">
                    אין טריידים
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 space-y-1">
      <p className="text-[10px] uppercase tracking-[0.15em] font-semibold text-[var(--text-faint)]">{label}</p>
      <p className="text-lg font-extrabold text-[var(--text-primary)]" style={color ? { color } : {}}>
        {value}
      </p>
    </div>
  );
}
