// app/billing/page.tsx
//
// Shows the user's current subscription status and a link to manage billing
// via the Paddle customer portal.

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, TrendingUp, CheckCircle2, XCircle, AlertTriangle, Clock } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { supabase, type Subscription, type SubscriptionStatus } from '@/lib/supabase-client';

const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  trialing:   'ניסיון חינמי',
  active:     'פעיל',
  past_due:   'תשלום נכשל',
  paused:     'מושהה',
  cancelled:  'מבוטל',
};

const STATUS_ICON: Record<SubscriptionStatus, React.ReactNode> = {
  trialing:  <Clock className="w-5 h-5 text-[#22D3EE]" />,
  active:    <CheckCircle2 className="w-5 h-5 text-[#10F088]" />,
  past_due:  <AlertTriangle className="w-5 h-5 text-[#FF9F0A]" />,
  paused:    <AlertTriangle className="w-5 h-5 text-[#FF9F0A]" />,
  cancelled: <XCircle className="w-5 h-5 text-[#FF3B5C]" />,
};

export default function BillingPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [sub,     setSub]     = useState<Subscription | null>(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.replace('/login'); return; }

    supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setSub(data as Subscription | null);
        setFetching(false);
      });
  }, [user, authLoading, router]);

  if (authLoading || fetching) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#22D3EE]" />
      </div>
    );
  }

  const status = (sub?.status ?? 'cancelled') as SubscriptionStatus;
  const trialEnd = sub?.trial_ends_at ? new Date(sub.trial_ends_at) : null;
  const periodEnd = sub?.current_period_end ? new Date(sub.current_period_end) : null;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-4 font-[Manrope,ui-sans-serif,system-ui,sans-serif]">
      <div className="w-full max-w-[480px] space-y-6">

        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#22D3EE] to-[#10F088] flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-black" strokeWidth={3.5} />
          </div>
          <span className="text-[15px] font-extrabold tracking-tight text-[var(--text-primary)]">
            Momentum Playbook
          </span>
        </div>

        <div className="rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-surface)] backdrop-blur p-8 space-y-6">
          <h1 className="text-[20px] font-extrabold tracking-tight text-[var(--text-primary)]">
            ניהול מנוי
          </h1>

          {/* Current plan */}
          <div className="flex items-center justify-between p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] font-semibold text-[var(--text-secondary)] mb-1">
                תוכנית נוכחית
              </p>
              <p className="text-base font-bold text-[var(--text-primary)]">
                Momentum Playbook — 50 ₪ / חודש
              </p>
            </div>
            <div className="flex items-center gap-2">
              {STATUS_ICON[status]}
              <span className="text-sm font-semibold text-[var(--text-secondary)]">
                {STATUS_LABEL[status]}
              </span>
            </div>
          </div>

          {/* Dates */}
          {trialEnd && status === 'trialing' && (
            <p className="text-sm text-[var(--text-muted)]">
              תקופת הניסיון מסתיימת:{' '}
              <span className="font-semibold text-[var(--text-primary)]">
                {trialEnd.toLocaleDateString('he-IL')}
              </span>
            </p>
          )}
          {periodEnd && status === 'active' && (
            <p className="text-sm text-[var(--text-muted)]">
              חידוש הבא:{' '}
              <span className="font-semibold text-[var(--text-primary)]">
                {periodEnd.toLocaleDateString('he-IL')}
              </span>
            </p>
          )}

          {/* CTA */}
          {!sub ? (
            <button
              onClick={() => router.push('/onboarding/checkout')}
              className="w-full py-3 rounded-[10px] text-[13px] font-extrabold uppercase tracking-[0.05em] bg-gradient-to-br from-[#22D3EE] to-[#10F088] text-black shadow-[0_0_20px_rgba(34,211,238,0.3)] hover:brightness-110 transition-all"
            >
              התחל ניסיון חינמי
            </button>
          ) : (
            <a
              href="https://customer.paddle.com/subscriptions"
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full py-3 rounded-[10px] text-center text-[13px] font-extrabold uppercase tracking-[0.05em] border border-[var(--border-strong)] text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-all"
            >
              ניהול מנוי ב-Paddle ↗
            </a>
          )}

          <button
            onClick={() => router.push('/')}
            className="block w-full text-center text-sm text-[var(--text-faint)] hover:text-[var(--text-muted)] transition-colors"
          >
            ← חזרה לאפליקציה
          </button>
        </div>
      </div>
    </div>
  );
}
