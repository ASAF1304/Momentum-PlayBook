// app/settings/page.tsx
// Account settings — profile/risk tab + billing tab.

'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Loader2, CheckCircle2, XCircle, AlertTriangle, Clock, Gift,
} from 'lucide-react';
import { initializePaddle, type Paddle } from '@paddle/paddle-js';
import { AppNav } from '@/components/nav/app-nav';
import { GridOverlay } from '@/components/ui/grid-overlay';
import { supabase, type Subscription, type SubscriptionStatus } from '@/lib/supabase-client';
import { useAuth } from '@/lib/auth-context';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';

type Tab = 'account' | 'billing';

// ── Billing sub-component ─────────────────────────────────────────────────────

const STATUS_BANNER: Record<string, { label: string; color: string; bg: string; border: string }> = {
  grace:         { label: 'תקופת חסד — לא נדרש כרטיס אשראי', color: '#22D3EE', bg: '#22D3EE/10', border: '#22D3EE/30' },
  trialing:      { label: 'תקופת ניסיון', color: '#22D3EE', bg: '#22D3EE/10', border: '#22D3EE/30' },
  active:        { label: 'מנוי פעיל', color: '#10F088', bg: '#10F088/10', border: '#10F088/30' },
  past_due:      { label: 'החיוב נכשל — נדרש לעדכן כרטיס', color: '#FF9F0A', bg: '#FF9F0A/10', border: '#FF9F0A/30' },
  cancelled:     { label: 'המנוי בוטל', color: '#FF9F0A', bg: '#FF9F0A/10', border: '#FF9F0A/30' },
  expired_grace: { label: 'תקופת החסד הסתיימה — נדרש להוסיף כרטיס', color: '#FF3B5C', bg: '#FF3B5C/10', border: '#FF3B5C/30' },
  paused:        { label: 'המנוי מושהה', color: '#FF9F0A', bg: '#FF9F0A/10', border: '#FF9F0A/30' },
  comp:          { label: 'גישה חינמית קבועה', color: '#10F088', bg: '#10F088/10', border: '#10F088/30' },
  blocked:       { label: 'החשבון הושעה', color: '#FF3B5C', bg: '#FF3B5C/10', border: '#FF3B5C/30' },
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  trialing:      <Clock         className="w-4 h-4" />,
  active:        <CheckCircle2  className="w-4 h-4" />,
  past_due:      <AlertTriangle className="w-4 h-4" />,
  paused:        <AlertTriangle className="w-4 h-4" />,
  cancelled:     <XCircle       className="w-4 h-4" />,
  grace:         <Gift          className="w-4 h-4" />,
  comp:          <Gift          className="w-4 h-4" />,
  expired_grace: <XCircle       className="w-4 h-4" />,
};

function BillingTab({ userId }: { userId: string }) {
  const router   = useRouter();
  const paddleRef = useRef<Paddle | null>(null);
  const [sub,         setSub]         = useState<Subscription | null>(null);
  const [fetching,    setFetching]    = useState(true);
  const [paddleReady, setPaddleReady] = useState(false);
  const [opening,     setOpening]     = useState(false);

  useEffect(() => {
    supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => {
        setSub(data as Subscription | null);
        setFetching(false);
      });
  }, [userId]);

  // Initialise Paddle.js (only if env vars are set)
  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
    if (!token) return;
    const env = process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT === 'sandbox' ? 'sandbox' : 'production';
    initializePaddle({ environment: env, token })
      .then(p => { paddleRef.current = p ?? null; setPaddleReady(true); })
      .catch(err => console.error('[BILLING-TAB] Paddle init failed:', err));
  }, []);

  function openCheckout(userEmail: string) {
    const priceId = process.env.NEXT_PUBLIC_PADDLE_PRICE_ID;
    if (!paddleReady || !priceId) {
      router.push('/onboarding/checkout');
      return;
    }
    setOpening(true);
    paddleRef.current?.Checkout.open({
      items:      [{ priceId, quantity: 1 }],
      customer:   { email: userEmail },
      customData: { user_id: userId },
      settings: {
        successUrl: `${window.location.origin}/settings?tab=billing`,
        allowLogout: false,
      },
    });
    setOpening(false);
  }

  function openPortal() {
    window.open('https://customer.paddle.com/subscriptions', '_blank');
  }

  if (fetching) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-5 h-5 animate-spin text-[#22D3EE]" />
      </div>
    );
  }

  const status    = (sub?.status ?? 'expired_grace') as SubscriptionStatus;
  const trialEnd  = sub?.trial_ends_at      ? new Date(sub.trial_ends_at)      : null;
  const periodEnd = sub?.current_period_end ? new Date(sub.current_period_end) : null;
  const banner    = STATUS_BANNER[status] ?? STATUS_BANNER.expired_grace;

  const graceDaysLeft = status === 'grace' && trialEnd
    ? Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / 86_400_000))
    : null;

  const needsCard  = !sub || status === 'cancelled' || status === 'expired_grace';
  const isGrace    = status === 'grace';
  const isComp     = status === 'comp';
  const hasPaddle  = ['trialing', 'active', 'past_due', 'paused'].includes(status);

  return (
    <div className="space-y-4">
      {/* Status banner */}
      <div
        className="flex items-center gap-3 px-4 py-3 rounded-[10px] border"
        style={{
          backgroundColor: `rgb(from ${banner.color} r g b / 0.08)`,
          borderColor:     `rgb(from ${banner.color} r g b / 0.25)`,
          color:           banner.color,
        }}
      >
        <span style={{ color: banner.color }}>{STATUS_ICON[status]}</span>
        <span className="text-sm font-semibold">{banner.label}</span>
      </div>

      {/* Date info */}
      <div className="p-4 rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] space-y-2 text-sm text-[var(--text-muted)]">
        {trialEnd && status === 'trialing' && (
          <div className="flex justify-between">
            <span>חיוב יתחיל ב-</span>
            <span className="font-semibold text-[var(--text-primary)]">
              {trialEnd.toLocaleDateString('he-IL')}
            </span>
          </div>
        )}
        {periodEnd && status === 'active' && (
          <div className="flex justify-between">
            <span>חיוב הבא</span>
            <span className="font-semibold text-[var(--text-primary)]">
              {periodEnd.toLocaleDateString('he-IL')}
            </span>
          </div>
        )}
        {isGrace && trialEnd && (
          <div className="flex justify-between">
            <span>גישה חינמית עד</span>
            <span className="font-semibold text-[#22D3EE]">
              {trialEnd.toLocaleDateString('he-IL')}
              {graceDaysLeft !== null && (
                <span className="ml-1 text-[var(--text-faint)]">({graceDaysLeft} ימים)</span>
              )}
            </span>
          </div>
        )}
        {periodEnd && status === 'cancelled' && (
          <div className="flex justify-between">
            <span>גישה פעילה עד</span>
            <span className="font-semibold text-[var(--text-primary)]">
              {periodEnd.toLocaleDateString('he-IL')}
            </span>
          </div>
        )}
        {isComp && (
          <p>קיבלת גישה חינמית קבועה. אין צורך בכרטיס אשראי.</p>
        )}
        {!isComp && !isGrace && !trialEnd && !periodEnd && (
          <p className="text-[var(--text-faint)]">אין פרטי חיוב זמינים</p>
        )}
      </div>

      {/* CTA */}
      {needsCard && (
        <BillingBtn
          label={status === 'expired_grace' ? 'הוסף כרטיס אשראי' : 'התחל ניסיון חינמי'}
          loading={opening}
          onClick={() => openCheckout('')}
          primary
        />
      )}
      {isGrace && (
        <BillingBtn
          label="הוסף כרטיס אשראי"
          loading={opening}
          onClick={() => openCheckout('')}
          primary
        />
      )}
      {hasPaddle && (
        <BillingBtn
          label="נהל מנוי ב-Paddle ↗"
          loading={false}
          onClick={openPortal}
        />
      )}
    </div>
  );
}

function BillingBtn({
  label, loading, onClick, primary,
}: {
  label: string;
  loading: boolean;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={cn(
        'w-full py-2.5 rounded-[10px] text-[13px] font-extrabold uppercase tracking-[0.05em] transition-all flex items-center justify-center gap-2',
        primary
          ? 'bg-gradient-to-br from-[#22D3EE] to-[#10F088] text-black shadow-[0_0_20px_rgba(34,211,238,0.25)] hover:brightness-110'
          : 'border border-[var(--border-strong)] text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]',
        loading && 'opacity-50 cursor-not-allowed',
      )}
    >
      {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
      {label}
    </button>
  );
}

// ── Main settings page ────────────────────────────────────────────────────────

export default function SettingsPage() {
  const router = useRouter();
  const { user, profile, loading, refreshProfile } = useAuth();

  const [activeTab,  setActiveTab]  = useState<Tab>('account');
  const [displayName, setDisplayName] = useState('');
  const [accountSize, setAccountSize] = useState('');
  const [maxRisk,     setMaxRisk]     = useState('');
  const [maxStop,     setMaxStop]     = useState('');
  const [saving,      setSaving]      = useState(false);
  const [errors, setErrors] = useState({ accountSize: '', maxRisk: '', maxStop: '' });

  // Read ?tab= from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab === 'billing') setActiveTab('billing');
  }, []);

  useEffect(() => {
    if (!loading && !profile && user) {
      router.replace('/onboarding');
      return;
    }
    if (profile) {
      setDisplayName(profile.display_name ?? '');
      setAccountSize(String(profile.account_size));
      setMaxRisk(String(profile.max_risk_per_trade_pct));
      setMaxStop(String(profile.max_stop_distance_pct));
    }
  }, [profile, loading, user, router]);

  const validateAccountSize = () => {
    const v = parseFloat(accountSize);
    const msg = !Number.isFinite(v) || v <= 0 ? 'Enter a positive dollar amount' : '';
    setErrors(prev => ({ ...prev, accountSize: msg }));
    return !msg;
  };
  const validateMaxRisk = () => {
    const v = parseFloat(maxRisk);
    const msg = !Number.isFinite(v) || v <= 0 || v > 10 ? 'Must be between 0.1% and 10%' : '';
    setErrors(prev => ({ ...prev, maxRisk: msg }));
    return !msg;
  };
  const validateMaxStop = () => {
    const v = parseFloat(maxStop);
    const msg = !Number.isFinite(v) || v <= 0 || v > 25 ? 'Must be between 0.5% and 25%' : '';
    setErrors(prev => ({ ...prev, maxStop: msg }));
    return !msg;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || !user) return;
    const okSize = validateAccountSize();
    const okRisk = validateMaxRisk();
    const okStop = validateMaxStop();
    if (!okSize || !okRisk || !okStop) return;

    setSaving(true);
    const { error } = await supabase
      .from('user_profiles')
      .update({
        display_name:           displayName.trim() || null,
        account_size:           parseFloat(accountSize),
        max_risk_per_trade_pct: parseFloat(maxRisk),
        max_stop_distance_pct:  parseFloat(maxStop),
      })
      .eq('id', user.id);

    if (error) {
      toast({ title: 'Save failed', body: error.message, variant: 'error' });
    } else {
      await refreshProfile();
      toast({ title: 'Settings saved', variant: 'success' });
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#22D3EE]" />
      </div>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'account', label: 'חשבון' },
    { id: 'billing', label: 'חיוב' },
  ];

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] font-[Manrope,ui-sans-serif,system-ui,sans-serif]"
    >
      <GridOverlay />
      <AppNav />

      <main className="max-w-[520px] mx-auto px-6 py-10 relative">
        <div className="mb-6">
          <h1 className="text-[20px] font-extrabold tracking-tight mb-1">הגדרות</h1>
          <p className="text-xs text-[var(--text-muted)]">
            פרמטרים לגודל פוזיציה ומנוי.
          </p>
        </div>

        {/* Tab strip */}
        <div className="flex gap-1 mb-6 p-1 rounded-[10px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] w-fit">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-4 py-1.5 rounded-[8px] text-sm font-semibold transition-all',
                activeTab === tab.id
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Account tab */}
        {activeTab === 'account' && (
          <form onSubmit={handleSave} className="flex flex-col gap-4">
            <div className="p-5 rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] flex flex-col gap-4">
              <div className="text-xs uppercase tracking-[0.18em] font-bold text-[var(--text-muted)]">
                פרופיל
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs uppercase tracking-[0.14em] font-semibold text-[var(--text-secondary)]">
                  שם תצוגה
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="Your name"
                  className="bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-[8px] px-3 py-2.5 text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[#22D3EE] focus:ring-[3px] focus:ring-[#22D3EE]/15 transition"
                />
              </div>
            </div>

            <div className="p-5 rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] flex flex-col gap-4">
              <div className="text-xs uppercase tracking-[0.18em] font-bold text-[var(--text-muted)]">
                מנוע סיכון
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs uppercase tracking-[0.14em] font-semibold text-[#22D3EE]">
                  גודל חשבון ($)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] font-mono text-[14px]">$</span>
                  <input
                    type="number"
                    value={accountSize}
                    onChange={e => { setAccountSize(e.target.value); if (errors.accountSize) setErrors(p => ({ ...p, accountSize: '' })); }}
                    onBlur={validateAccountSize}
                    min="100" max="50000000" step="100"
                    className={cn(
                      'w-full bg-[var(--bg-input)] border rounded-[8px] pl-7 pr-3 py-2.5 font-mono text-[15px] font-semibold text-[var(--text-primary)] focus:outline-none focus:ring-[3px] transition',
                      errors.accountSize
                        ? 'border-[#FF3B5C] focus:border-[#FF3B5C] focus:ring-[#FF3B5C]/15'
                        : 'border-[var(--border-subtle)] focus:border-[#22D3EE] focus:ring-[#22D3EE]/15',
                    )}
                  />
                </div>
                {errors.accountSize && <p className="text-[11px] text-[#FF3B5C]">{errors.accountSize}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs uppercase tracking-[0.14em] font-semibold text-[var(--text-secondary)]">
                    סיכון מקס׳ / עסקה
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={maxRisk}
                      onChange={e => { setMaxRisk(e.target.value); if (errors.maxRisk) setErrors(p => ({ ...p, maxRisk: '' })); }}
                      onBlur={validateMaxRisk}
                      min="0.1" max="10" step="0.1"
                      className={cn(
                        'w-full bg-[var(--bg-input)] border rounded-[8px] px-3 pr-7 py-2.5 font-mono text-[14px] text-[var(--text-primary)] focus:outline-none focus:ring-[3px] transition',
                        errors.maxRisk
                          ? 'border-[#FF3B5C] focus:border-[#FF3B5C] focus:ring-[#FF3B5C]/15'
                          : 'border-[var(--border-subtle)] focus:border-[#22D3EE] focus:ring-[#22D3EE]/15',
                      )}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] font-mono text-xs">%</span>
                  </div>
                  {errors.maxRisk && <p className="text-[11px] text-[#FF3B5C]">{errors.maxRisk}</p>}
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs uppercase tracking-[0.14em] font-semibold text-[var(--text-secondary)]">
                    מרחק סטופ מקס׳
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={maxStop}
                      onChange={e => { setMaxStop(e.target.value); if (errors.maxStop) setErrors(p => ({ ...p, maxStop: '' })); }}
                      onBlur={validateMaxStop}
                      min="0.5" max="25" step="0.5"
                      className={cn(
                        'w-full bg-[var(--bg-input)] border rounded-[8px] px-3 pr-7 py-2.5 font-mono text-[14px] text-[var(--text-primary)] focus:outline-none focus:ring-[3px] transition',
                        errors.maxStop
                          ? 'border-[#FF3B5C] focus:border-[#FF3B5C] focus:ring-[#FF3B5C]/15'
                          : 'border-[var(--border-subtle)] focus:border-[#22D3EE] focus:ring-[#22D3EE]/15',
                      )}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] font-mono text-xs">%</span>
                  </div>
                  {errors.maxStop && <p className="text-[11px] text-[#FF3B5C]">{errors.maxStop}</p>}
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className={cn(
                'w-full py-3 rounded-[10px] text-[13px] font-extrabold uppercase tracking-[0.05em] transition-all flex items-center justify-center gap-2',
                saving
                  ? 'bg-[var(--bg-elevated)] text-[var(--text-faint)] cursor-not-allowed'
                  : 'bg-gradient-to-br from-[#22D3EE] to-[#10F088] text-black shadow-[0_0_20px_rgba(34,211,238,0.3)] hover:brightness-110',
              )}
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {saving ? 'שומר…' : 'שמור שינויים'}
            </button>
          </form>
        )}

        {/* Billing tab */}
        {activeTab === 'billing' && user && (
          <BillingTab userId={user.id} />
        )}
      </main>
    </div>
  );
}
