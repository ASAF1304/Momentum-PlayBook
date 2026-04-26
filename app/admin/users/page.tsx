// app/admin/users/page.tsx
//
// Admin panel: list all users, view their subscription status, and perform
// comp / extend / revoke actions. Only accessible when is_admin = true.

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Gift, RotateCcw, CalendarPlus, Search, Loader2, TrendingUp, ShieldAlert,
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
    status:            string;
    trial_ends_at:     string | null;
    current_period_end: string | null;
  } | null;
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
};

export default function AdminUsersPage() {
  const { profile, loading: authLoading } = useAuth();
  const router  = useRouter();
  const [users,   setUsers]   = useState<AdminUser[]>([]);
  const [query,   setQuery]   = useState('');
  const [loading, setLoading] = useState(true);
  const [acting,  setActing]  = useState<string | null>(null); // userId+action

  useEffect(() => {
    if (authLoading) return;
    if (!profile?.is_admin) { router.replace('/'); return; }
    fetch('/api/admin/users')
      .then(r => r.json())
      .then(data => { setUsers(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [profile, authLoading, router]);

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
      // Refresh list
      const data = await fetch('/api/admin/users').then(r => r.json());
      setUsers(data);
    } finally {
      setActing(null);
    }
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
        <div className="max-w-[1200px] mx-auto flex items-center justify-between">
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

      <div className="max-w-[1200px] mx-auto px-6 py-8 space-y-6">

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

        {/* Count */}
        <p className="text-xs text-[var(--text-faint)]">
          {filtered.length} משתמשים
        </p>

        {/* Table */}
        <div className="rounded-xl border border-[var(--border-subtle)] overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg-elevated)] text-[var(--text-secondary)] text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 text-right font-semibold">משתמש</th>
                <th className="px-4 py-3 text-right font-semibold">סטטוס</th>
                <th className="px-4 py-3 text-right font-semibold">תפוגה</th>
                <th className="px-4 py-3 text-right font-semibold">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {filtered.map(user => {
                const sub    = user.sub;
                const status = sub?.status ?? '—';
                const expiry = sub?.trial_ends_at ?? sub?.current_period_end;

                return (
                  <tr key={user.id} className="bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {user.is_admin && (
                          <ShieldAlert className="w-3.5 h-3.5 text-[#FF9F0A] shrink-0" />
                        )}
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
                      <div className="flex items-center gap-2">
                        <ActionBtn
                          icon={<Gift className="w-3.5 h-3.5" />}
                          label="Comp"
                          disabled={status === 'comp'}
                          loading={acting === `${user.id}:comp`}
                          onClick={() => doAction(user.id, 'comp')}
                        />
                        <ActionBtn
                          icon={<CalendarPlus className="w-3.5 h-3.5" />}
                          label="+30d"
                          loading={acting === `${user.id}:extend`}
                          onClick={() => doAction(user.id, 'extend')}
                        />
                        {status === 'comp' && (
                          <ActionBtn
                            icon={<RotateCcw className="w-3.5 h-3.5" />}
                            label="Revoke"
                            loading={acting === `${user.id}:revoke`}
                            onClick={() => doAction(user.id, 'revoke')}
                          />
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
    </div>
  );
}

function ActionBtn({
  icon, label, disabled, loading, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
  loading?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        'flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold border transition-all',
        disabled
          ? 'opacity-30 cursor-not-allowed border-[var(--border-subtle)] text-[var(--text-faint)]'
          : 'border-[var(--border-strong)] text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]',
      )}
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : icon}
      {label}
    </button>
  );
}
