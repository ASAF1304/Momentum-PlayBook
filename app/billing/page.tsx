// app/billing/page.tsx
//
// Shows the user's current subscription status and options to manage it.
// grace / comp users see their free-access details.
// Active subscribers can open the Paddle customer portal.

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Loader2, TrendingUp, CheckCircle2, XCircle,
  AlertTriangle, Clock, Gift,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { supabase, type Subscription, type SubscriptionStatus } from '@/lib/supabase-client';

const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  trialing:      'ניסיון חינמי',
  active:        'פעיל',
  past_due:      'תשלום נכשל',
  paused:        'מושהה',
  cancelled:     'מבוטל',
  grace:         'גישת בטא בחינם',
  comp:          'גישה חינמית קבועה',
  expired_grace: 'גישת הבטא הסתיימה',
};

const STATUS_ICON: Record<SubscriptionStatus, React.ReactNode> = {
  trialing:      <Clock        className="w-5 h-5 text-[#22D3EE]" />,
  active:        <CheckCircle2 className="w-5 h-5 text-[#10F088]" />,
  past_due:      <AlertTriangle className="w-5 h-5 text-[#FF9F0A]" />,
  paused:        <AlertTriangle className="w-5 h-5 text-[#FF9F0A]" />,
  cancelled:     <XCircle      className="w-5 h-5 text-[#FF3B5C]" />,
  grace:         <Gift         className="w-5 h-5 text-[#22D3EE]" />,
  comp:          <Gift         className="w-5 h-5 text-[#10F088]" />,
  expired_grace: <XCircle      className="w-5 h-5 text-[#FF3B5C]" />,
};

// Statuses that have a real Paddle subscription to manage
const HAS_PADDLE_SUB: SubscriptionStatus[] = ['trialing', 'active', 'past_due', 'paused', 'cancelled'];

export default function BillingPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [sub,      setSub]      = useState<Subscription | null>(null);
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

  const status     = (sub?.status ?? 'cancelled') as SubscriptionStatus;
  const trialEnd   = sub?.trial_ends_at      ? new Date(sub.trial_ends_at)      : null;
  const periodEnd  = sub?.current_period_end ? new Date(sub.current_period_end) : null;
  const hasPaddle  = HAS_PADDLE_SUB.includes(status);
  const isGrace    = status === 'grace';
  const isComp     = status === 'comp';
  const noSub      = !sub;
  const needsCard  = noSub || status === 'cancelled' || status === 'expired_grace';

  const graceDaysLeft = isGrace && trialEnd
    ? Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / 86_400_000))
    : null;

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
                {isComp
                  ? 'Momentum Playbook — גישה חינמית'
                  : 'Momentum Playbook — 50 ₪ / חודש'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {STATUS_ICON[status]}
              <span className="text-sm font-semibold text-[var(--text-secondary)]">
                {STATUS_LABEL[status]}
              </span>
            </div>
          </div>

          {/* Dates / info */}
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
          {isGrace && (
            <p className="text-sm text-[var(--text-muted)]">
              {graceDaysLeft !== null && graceDaysLeft > 0
                ? <>ניסיון חינמי מסתיים בעוד{' '}
                    <span className="font-semibold text-[#22D3EE]">
                      {graceDaysLeft} {graceDaysLeft === 1 ? 'יום' : 'ימים'}
                    </span>
                    {' '}— הוסף כרטיס ותקבל חודש נוסף חינם
                  </>
                : 'הניסיון החינמי הסתיים — הוסף כרטיס כדי להמשיך'}
            </p>
          )}
          {isComp && (
            <p className="text-sm text-[var(--text-muted)]">
              קיבלת גישה חינמית קבועה לאפליקציה. אין צורך בכרטיס אשראי.
            </p>
          )}

          {/* CTA */}
          {needsCard ? (
            <div className="space-y-3">
              <button
                onClick={() => router.push('/onboarding/checkout')}
                className="w-full py-3 rounded-[10px] text-[13px] font-extrabold uppercase tracking-[0.05em] bg-gradient-to-br from-[#22D3EE] to-[#10F088] text-black shadow-[0_0_20px_rgba(34,211,238,0.3)] hover:brightness-110 transition-all"
              >
                הוסף כרטיס אשראי — חודש חינם
              </button>
              <p className="text-center text-xs text-[var(--text-faint)]">
                חודש ניסיון חינמי, לאחר מכן 50 ₪ / חודש. ביטול בכל עת.
              </p>
            </div>
          ) : isGrace ? (
            <div className="space-y-3">
              <button
                onClick={() => router.push('/onboarding/checkout')}
                className="w-full py-3 rounded-[10px] text-[13px] font-extrabold uppercase tracking-[0.05em] bg-gradient-to-br from-[#22D3EE] to-[#10F088] text-black shadow-[0_0_20px_rgba(34,211,238,0.3)] hover:brightness-110 transition-all"
              >
                הוסף כרטיס — קבל חודש נוסף חינם
              </button>
              <p className="text-center text-xs text-[var(--text-faint)]">
                חודש ניסיון חינמי, לאחר מכן 50 ₪ / חודש. ביטול בכל עת.
              </p>
            </div>
          ) : isComp ? null : hasPaddle ? (
            <a
              href="https://customer.paddle.com/subscriptions"
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full py-3 rounded-[10px] text-center text-[13px] font-extrabold uppercase tracking-[0.05em] border border-[var(--border-strong)] text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-all"
            >
              ניהול מנוי ב-Paddle ↗
            </a>
          ) : null}

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
