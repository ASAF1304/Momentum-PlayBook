// app/admin/users/page.tsx
// Admin panel: list all users with full action suite.

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Gift, RotateCcw, CalendarPlus, Search, Loader2, TrendingUp, ShieldAlert,
  Mail, Ban, CheckCircle, BarChart2, X, ExternalLink,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';

interface AdminUser {
  id:           string;
  email:        string;
  display_name: string | null;
  is_admin:     boolean;
  created_at:   string;
  sub: {
    status:             string;
    trial_ends_at:      string | null;
    current_period_end: string | null;
    paddle_customer_id: string | null;
  } | null;
}

interface UserStats {
  totalTrades:     number;
  openTrades:      number;
  closedTrades:    number;
  winRate:         number | null;
  totalPnl:        number;
  avgPositionSize: number | null;
  signupDate:      string | null;
  lastSignIn:      string | null;
}

const STATUS_COLOR: Record<string, string> = {
  active:        'text-[#10F088] bg-[#10F088]/10',
  trialing:      'text-[#22D3EE] bg-[#22D3EE]/10',
  grace:         'text-[#22D3EE] bg-[#22D3EE]/10',
  comp:          'text-[#10F088] bg-[#10F088]/10',
  past_due:      'text-[#FF9F0A] bg-[#FF9F0A]/10',
  paused:        'text-[#FF9F0A] bg-[#FF9F0A]/10',
  cancelled:     'text-[#FF3B5C] bg-[#FF3B5C]/10',
  expired_grace: 'text-[#FF3B5C] bg-[#FF3B5C]/10',
  blocked:       'text-white bg-[#FF3B5C]/80',
};

export default function AdminUsersPage() {
  const { profile, loading: authLoading } = useAuth();
  const router  = useRouter();
  const [users,   setUsers]   = useState<AdminUser[]>([]);
  const [query,   setQuery]   = useState('');
  const [loading, setLoading] = useState(true);
  const [acting,  setActing]  = useState<string | null>(null);

  // Stats modal state
  const [statsUser,  setStatsUser]  = useState<AdminUser | null>(null);
  const [stats,      setStats]      = useState<UserStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Extend dialog state
  const [extendUser, setExtendUser] = useState<AdminUser | null>(null);
  const [extendDays, setExtendDays] = useState('14');
  const [extendLoading, setExtendLoading] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!profile?.is_admin) { router.replace('/'); return; }
    loadUsers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, profile]);

  async function loadUsers() {
    setLoading(true);
    const data = await fetch('/api/admin/users').then(r => r.json()).catch(() => []);
    setUsers(data);
    setLoading(false);
  }

  const filtered = users.filter(u =>
    !query ||
    u.email.toLowerCase().includes(query.toLowerCase()) ||
    (u.display_name ?? '').toLowerCase().includes(query.toLowerCase()),
  );

  async function doAction(userId: string, action: 'comp' | 'extend' | 'revoke') {
    const key = `${userId}:${action}`;
    setActing(key);
    try {
      await fetch(`/api/admin/users/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      await loadUsers();
    } finally {
      setActing(null);
    }
  }

  async function doBlock(user: AdminUser) {
    const isBlocked = user.sub?.status === 'blocked';
    const key = `${user.id}:block`;
    setActing(key);
    try {
      await fetch(`/api/admin/users/${user.id}/block`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isBlocked ? { unblock: true } : {}),
      });
      await loadUsers();
    } finally {
      setActing(null);
    }
  }

  async function doExtend() {
    if (!extendUser) return;
    const days = parseInt(extendDays, 10);
    if (!Number.isFinite(days) || days < 1) return;
    setExtendLoading(true);
    try {
      await fetch(`/api/admin/users/${extendUser.id}/extend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days }),
      });
      await loadUsers();
      setExtendUser(null);
    } finally {
      setExtendLoading(false);
    }
  }

  async function openStats(user: AdminUser) {
    setStatsUser(user);
    setStats(null);
    setStatsLoading(true);
    const data = await fetch(`/api/admin/users/${user.id}/stats`).then(r => r.json()).catch(() => null);
    setStats(data);
    setStatsLoading(false);
  }

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
        <div className="max-w-[1300px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#22D3EE] to-[#10F088] flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-black" strokeWidth={3.5} />
            </div>
            <div>
              <h1 className="text-base font-extrabold text-[var(--text-primary)]">Admin Panel</h1>
              <p className="text-xs text-[var(--text-faint)]">ניהול משתמשים</p>
            </div>
          </div>
          <button
            onClick={() => router.push('/')}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
          >
            ← חזרה לאפליקציה
          </button>
        </div>
      </div>

      <div className="max-w-[1300px] mx-auto px-6 py-8 space-y-6">
        {/* Search */}
        <div className="relative max-w-[380px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-faint)]" />
          <input
            type="text"
            placeholder="חיפוש לפי אימייל / שם..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[#22D3EE]/50"
          />
        </div>

        <p className="text-xs text-[var(--text-faint)]">{filtered.length} משתמשים</p>

        {/* Table */}
        <div className="rounded-xl border border-[var(--border-subtle)] overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg-elevated)] text-[var(--text-secondary)] text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">משתמש</th>
                <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">סטטוס</th>
                <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">תפוגה</th>
                <th className="px-4 py-3 text-right font-semibold whitespace-nowrap">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {filtered.map(user => {
                const sub    = user.sub;
                const status = sub?.status ?? '—';
                const expiry = sub?.trial_ends_at ?? sub?.current_period_end;
                const isBlocked = status === 'blocked';

                return (
                  <tr key={user.id} className={cn(
                    'bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] transition-colors',
                    isBlocked && 'opacity-60',
                  )}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {user.is_admin && <ShieldAlert className="w-3.5 h-3.5 text-[#FF9F0A] shrink-0" />}
                        <div>
                          <p className="font-semibold text-[var(--text-primary)]">
                            {user.display_name ?? user.email}
                          </p>
                          <p className="text-xs text-[var(--text-faint)]">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'inline-block px-2 py-0.5 rounded-full text-xs font-semibold',
                        STATUS_COLOR[status] ?? 'text-[var(--text-muted)] bg-[var(--bg-elevated)]',
                      )}>
                        {status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--text-muted)]">
                      {expiry ? new Date(expiry).toLocaleDateString('he-IL') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Stats */}
                        <ActionBtn
                          icon={<BarChart2 className="w-3.5 h-3.5" />}
                          label="סטטס"
                          onClick={() => openStats(user)}
                        />
                        {/* View trades */}
                        <ActionBtn
                          icon={<TrendingUp className="w-3.5 h-3.5" />}
                          label="טריידים"
                          onClick={() => router.push(`/admin/users/${user.id}/trades`)}
                        />
                        {/* Email */}
                        <ActionBtn
                          icon={<Mail className="w-3.5 h-3.5" />}
                          label="מייל"
                          onClick={() => window.open(
                            `mailto:${user.email}?subject=Momentum%20Playbook%20%E2%80%94%20`,
                            '_blank',
                          )}
                        />
                        {/* Block / Unblock */}
                        <ActionBtn
                          icon={isBlocked
                            ? <CheckCircle className="w-3.5 h-3.5" />
                            : <Ban className="w-3.5 h-3.5" />}
                          label={isBlocked ? 'בטל חסימה' : 'חסום'}
                          loading={acting === `${user.id}:block`}
                          variant={isBlocked ? 'success' : 'danger'}
                          onClick={() => doBlock(user)}
                        />
                        {/* Custom extend */}
                        <ActionBtn
                          icon={<CalendarPlus className="w-3.5 h-3.5" />}
                          label="הארך"
                          loading={acting === `${user.id}:extend`}
                          onClick={() => { setExtendUser(user); setExtendDays('14'); }}
                        />
                        {/* Comp */}
                        <ActionBtn
                          icon={<Gift className="w-3.5 h-3.5" />}
                          label="Comp"
                          disabled={status === 'comp'}
                          loading={acting === `${user.id}:comp`}
                          onClick={() => doAction(user.id, 'comp')}
                        />
                        {/* Revoke comp */}
                        {status === 'comp' && (
                          <ActionBtn
                            icon={<RotateCcw className="w-3.5 h-3.5" />}
                            label="Revoke"
                            loading={acting === `${user.id}:revoke`}
                            onClick={() => doAction(user.id, 'revoke')}
                          />
                        )}
                        {/* Paddle customer link */}
                        {sub?.paddle_customer_id && (
                          <a
                            href={`https://vendors.paddle.com/customers/${sub.paddle_customer_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold border border-[var(--border-strong)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] transition-all"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Paddle
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-[var(--text-faint)]">
                    אין משתמשים
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Stats modal ─────────────────────────────────────────── */}
      {statsUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setStatsUser(null)}
        >
          <div
            className="w-full max-w-[480px] rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-surface)] shadow-2xl p-6 space-y-5"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-extrabold text-[var(--text-primary)]">
                  {statsUser.display_name ?? statsUser.email}
                </h2>
                <p className="text-xs text-[var(--text-faint)]">{statsUser.email}</p>
              </div>
              <button
                onClick={() => setStatsUser(null)}
                className="text-[var(--text-faint)] hover:text-[var(--text-primary)] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {statsLoading && (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-[#22D3EE]" />
              </div>
            )}

            {!statsLoading && stats && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <StatCard label="סה״כ טריידים"   value={String(stats.totalTrades)} />
                  <StatCard label="פתוחים"          value={String(stats.openTrades)} />
                  <StatCard label="סגורים"          value={String(stats.closedTrades)} />
                  <StatCard
                    label="Win Rate"
                    value={stats.winRate != null ? `${stats.winRate.toFixed(1)}%` : '—'}
                    color={stats.winRate != null
                      ? stats.winRate >= 50 ? '#10F088' : '#FF3B5C'
                      : undefined}
                  />
                  <StatCard
                    label="P&L כולל"
                    value={`$${stats.totalPnl.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
                    color={stats.totalPnl >= 0 ? '#10F088' : '#FF3B5C'}
                  />
                  <StatCard
                    label="גודל פוז׳ ממוצע"
                    value={stats.avgPositionSize != null
                      ? `$${stats.avgPositionSize.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                      : '—'}
                  />
                </div>

                <div className="pt-3 border-t border-[var(--border-subtle)] space-y-2 text-xs text-[var(--text-muted)]">
                  <div className="flex justify-between">
                    <span>הצטרף</span>
                    <span>{stats.signupDate ? new Date(stats.signupDate).toLocaleDateString('he-IL') : '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>כניסה אחרונה</span>
                    <span>{stats.lastSignIn ? new Date(stats.lastSignIn).toLocaleDateString('he-IL') : '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>סטטוס מנוי</span>
                    <span className={cn(
                      'font-semibold',
                      STATUS_COLOR[statsUser.sub?.status ?? '']?.split(' ')[0],
                    )}>
                      {statsUser.sub?.status ?? '—'}
                    </span>
                  </div>
                  {(statsUser.sub?.trial_ends_at || statsUser.sub?.current_period_end) && (
                    <div className="flex justify-between">
                      <span>תפוגה</span>
                      <span>
                        {new Date(
                          statsUser.sub.trial_ends_at ?? statsUser.sub.current_period_end!,
                        ).toLocaleDateString('he-IL')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {!statsLoading && !stats && (
              <p className="text-center text-sm text-[var(--text-faint)] py-4">שגיאה בטעינת נתונים</p>
            )}
          </div>
        </div>
      )}

      {/* ── Custom Extend dialog ─────────────────────────────────── */}
      {extendUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setExtendUser(null)}
        >
          <div
            className="w-full max-w-[320px] rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-surface)] shadow-2xl p-6 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-[var(--text-primary)]">הארך גישה</h2>
              <button onClick={() => setExtendUser(null)} className="text-[var(--text-faint)] hover:text-[var(--text-primary)]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              {extendUser.display_name ?? extendUser.email}
            </p>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-[var(--text-secondary)] font-semibold">מספר ימים</label>
              <input
                type="number"
                min="1"
                max="3650"
                value={extendDays}
                onChange={e => setExtendDays(e.target.value)}
                className="bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-[8px] px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-[#22D3EE]"
                autoFocus
              />
            </div>
            <button
              onClick={doExtend}
              disabled={extendLoading}
              className="w-full py-2 rounded-[8px] text-xs font-extrabold uppercase tracking-wide bg-gradient-to-br from-[#22D3EE] to-[#10F088] text-black transition hover:brightness-110 disabled:opacity-50 flex items-center justify-center gap-1"
            >
              {extendLoading && <Loader2 className="w-3 h-3 animate-spin" />}
              אשר הארכה
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ActionBtn({
  icon, label, disabled, loading, onClick, variant,
}: {
  icon:      React.ReactNode;
  label:     string;
  disabled?: boolean;
  loading?:  boolean;
  onClick:   () => void;
  variant?:  'danger' | 'success';
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        'flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold border transition-all whitespace-nowrap',
        disabled
          ? 'opacity-30 cursor-not-allowed border-[var(--border-subtle)] text-[var(--text-faint)]'
          : variant === 'danger'
            ? 'border-[#FF3B5C]/40 text-[#FF3B5C] hover:bg-[#FF3B5C]/10'
            : variant === 'success'
              ? 'border-[#10F088]/40 text-[#10F088] hover:bg-[#10F088]/10'
              : 'border-[var(--border-strong)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]',
      )}
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : icon}
      {label}
    </button>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 space-y-1">
      <p className="text-[10px] uppercase tracking-[0.15em] font-semibold text-[var(--text-faint)]">{label}</p>
      <p className="text-lg font-extrabold" style={color ? { color } : {}}>
        {value}
      </p>
    </div>
  );
}
