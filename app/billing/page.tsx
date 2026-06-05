// app/billing/page.tsx
//
// Shows a feature landing page for users without a subscription.
// Shows compact billing management for existing subscribers.

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Loader2, TrendingUp, CheckCircle2, XCircle,
  AlertTriangle, Clock, Gift, BookOpen, BarChart2,
  Target, Star, ShieldCheck, Eye, FileSpreadsheet,
  Zap, Check, ChevronLeft,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { supabase, type Subscription, type SubscriptionStatus } from '@/lib/supabase-client';
import { TRIAL_DAYS } from '@/lib/trial-config';

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
  trialing:      <Clock         className="w-5 h-5 text-[#22D3EE]" />,
  active:        <CheckCircle2  className="w-5 h-5 text-[#10F088]" />,
  past_due:      <AlertTriangle className="w-5 h-5 text-[#FF9F0A]" />,
  paused:        <AlertTriangle className="w-5 h-5 text-[#FF9F0A]" />,
  cancelled:     <XCircle       className="w-5 h-5 text-[#FF3B5C]" />,
  grace:         <Gift          className="w-5 h-5 text-[#22D3EE]" />,
  comp:          <Gift          className="w-5 h-5 text-[#10F088]" />,
  expired_grace: <XCircle       className="w-5 h-5 text-[#FF3B5C]" />,
};

const HAS_ACTIVE_SUB: SubscriptionStatus[] = ['trialing', 'active', 'past_due', 'paused', 'cancelled'];

const FEATURES = [
  {
    icon: BookOpen,
    color: '#22D3EE',
    title: 'יומן מסחר',
    desc: 'תיעוד מלא של כל טרייד — פייז 1 ו-2, יציאות חלקיות, Stop, Screenshot, Post-Mortem.',
  },
  {
    icon: Zap,
    color: '#10F088',
    title: 'Live P&L',
    desc: 'מחירים חיים על כל הפוזיציות הפתוחות שלך. רווח/הפסד לא ממומש בזמן אמת.',
  },
  {
    icon: BarChart2,
    color: '#22D3EE',
    title: 'Playbook',
    desc: 'ארכיון הטריידים שלך עם Win Rate, ממוצע R, ניתוח לפי Setup ותקופה.',
  },
  {
    icon: Target,
    color: '#10F088',
    title: 'Position Sizer',
    desc: 'חישוב גודל פוזיציה אוטומטי לפי % סיכון, מרחק Stop, וגודל החשבון.',
  },
  {
    icon: Star,
    color: '#FFD60A',
    title: 'Stage 2 Leaders',
    desc: 'סריקת מניות מומנטום יומית לפי קריטריוני Minervini — מתעדכן כל יום.',
  },
  {
    icon: ShieldCheck,
    color: '#10F088',
    title: 'Validator',
    desc: 'רשימת בדיקה pre-trade עם 12 נקודות לפי Trend Template של Minervini.',
  },
  {
    icon: Eye,
    color: '#22D3EE',
    title: 'Watchlist',
    desc: 'רשימת מעקב אישית עם גרפים מ-TradingView ופתיחה מהירה לטרייד.',
  },
  {
    icon: FileSpreadsheet,
    color: '#10F088',
    title: 'ייבוא מברוקר',
    desc: 'ייבוא אוטומטי מ-IBI, Meitav Trade, IBKR ו-eToro — אין הקלדה ידנית.',
  },
];

const PLAN_FEATURES = [
  'יומן מסחר מלא עם פייזים ויציאות חלקיות',
  'Live P&L על פוזיציות פתוחות',
  'Playbook — ארכיון + ניתוח ביצועים',
  'Position Sizer לפי % סיכון',
  'Stage 2 Leaders — סריקה יומית',
  'Validator — Minervini Trend Template',
  'Watchlist עם גרפי TradingView',
  'ייבוא אוטומטי מ-IBI / Meitav / IBKR / eToro',
];

// ── App Preview Mockup Components ─────────────────────────────────────────────

function MockupWindow({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl overflow-hidden border border-[var(--border-strong)]"
      style={{ background: 'var(--bg-surface)', boxShadow: '0 0 0 1px rgba(34,211,238,0.06), 0 16px 56px rgba(0,0,0,0.45)' }}
    >
      <div
        className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--border-subtle)]"
        style={{ background: 'var(--bg-elevated)' }}
      >
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#FF5F57' }} />
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#FEBC2E' }} />
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#28C840' }} />
        </div>
        <div className="flex-1 flex justify-center">
          <div
            className="px-3 py-0.5 rounded-md border border-[var(--border-subtle)]"
            style={{ background: 'var(--bg-surface)' }}
          >
            <span className="text-[9px] text-[var(--text-faint)] font-mono">momentum-playbook.vercel.app</span>
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}

function DashboardMockup() {
  const BARS = [-0.22, 0.58, 0.44, 0.88, 0.72, -0.14, 0.83, 0.51, 1.0, 0.36, -0.12, 0.70];

  return (
    <MockupWindow>
      <div className="p-4 space-y-3" dir="ltr">
        <div className="flex gap-3">
          <div
            className="flex-1 rounded-[10px] border border-[var(--border-subtle)] p-4"
            style={{ background: 'var(--bg-elevated)' }}
          >
            <div className="flex items-center justify-between mb-2">
              <span
                className="uppercase font-bold text-[var(--text-faint)]"
                style={{ fontSize: 7, letterSpacing: '0.2em' }}
              >
                Account Equity
              </span>
              <span className="flex items-center gap-1 font-bold" style={{ fontSize: 7, color: '#F59E0B' }}>
                <span
                  className="rounded-full inline-block animate-pulse"
                  style={{ width: 5, height: 5, background: '#F59E0B' }}
                />
                Live
              </span>
            </div>
            <div
              className="font-mono font-extrabold tracking-tight text-[var(--text-primary)]"
              style={{ fontSize: 24 }}
            >
              $127,438
            </div>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="font-mono font-bold" style={{ fontSize: 13, color: '#10F088' }}>+$27,438</span>
              <span className="font-mono" style={{ fontSize: 11, color: '#10F088' }}>(+27.4%)</span>
            </div>
            <div className="mt-1 font-mono" style={{ fontSize: 8, color: 'var(--text-faint)' }}>
              3 open positions
            </div>
          </div>

          <div className="flex flex-col gap-2" style={{ width: 96 }}>
            {[
              { l: 'Win Rate', v: '68.4%', c: '#10F088' },
              { l: 'Avg R',    v: '+2.1R',  c: '#10F088' },
              { l: 'Max DD',   v: '-3.2%',  c: '#FF3B5C' },
            ].map(s => (
              <div
                key={s.l}
                className="rounded-[7px] border border-[var(--border-subtle)] px-2.5 py-2"
                style={{ background: 'var(--bg-elevated)' }}
              >
                <div
                  className="uppercase font-bold text-[var(--text-faint)]"
                  style={{ fontSize: 6, letterSpacing: '0.15em' }}
                >
                  {s.l}
                </div>
                <div className="font-mono font-extrabold" style={{ fontSize: 13, color: s.c }}>{s.v}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <div
            className="flex-1 rounded-[8px] border border-[var(--border-subtle)] p-3"
            style={{ background: 'var(--bg-elevated)' }}
          >
            <div
              className="uppercase font-bold text-[var(--text-faint)] mb-2"
              style={{ fontSize: 7, letterSpacing: '0.18em' }}
            >
              Monthly Performance
            </div>
            <div className="relative flex gap-0.5" style={{ height: 48 }}>
              <div
                className="absolute inset-x-0"
                style={{ top: '50%', borderTop: '1px dashed rgba(255,255,255,0.07)' }}
              />
              {BARS.map((v, i) => {
                const hPx = Math.max(Math.abs(v) * 21, 3);
                const isPos = v >= 0;
                return (
                  <div key={i} className="flex-1 flex flex-col" style={{ height: 48 }}>
                    <div style={{ height: 24, display: 'flex', alignItems: 'flex-end' }}>
                      {isPos && (
                        <div
                          style={{
                            width: '100%', height: hPx,
                            background: '#10F088',
                            borderRadius: '2px 2px 0 0',
                            opacity: 0.85,
                          }}
                        />
                      )}
                    </div>
                    <div style={{ height: 24, display: 'flex', alignItems: 'flex-start' }}>
                      {!isPos && (
                        <div
                          style={{
                            width: '100%', height: hPx,
                            background: '#FF3B5C',
                            borderRadius: '0 0 2px 2px',
                            opacity: 0.85,
                          }}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div
            className="rounded-[8px] border border-[var(--border-subtle)] p-2.5"
            style={{ background: 'var(--bg-elevated)', width: 100 }}
          >
            <div
              className="uppercase font-bold text-[var(--text-faint)] mb-1.5"
              style={{ fontSize: 7, letterSpacing: '0.18em' }}
            >
              Positions
            </div>
            {[
              { t: 'NVDA', r: '+2.8R', c: '#10F088' },
              { t: 'META', r: '+1.2R', c: '#10F088' },
              { t: 'SMCI', r: '-0.4R', c: '#FF3B5C' },
            ].map(p => (
              <div
                key={p.t}
                className="flex items-center justify-between py-1.5 border-b border-[var(--border-subtle)] last:border-0"
              >
                <span
                  className="font-mono font-extrabold text-[var(--text-primary)]"
                  style={{ fontSize: 10 }}
                >
                  {p.t}
                </span>
                <span className="font-mono font-bold" style={{ fontSize: 9, color: p.c }}>{p.r}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </MockupWindow>
  );
}

function LeadersMockup() {
  return (
    <div
      className="rounded-xl overflow-hidden border border-[var(--border-subtle)]"
      style={{ background: 'var(--bg-surface)' }}
      dir="ltr"
    >
      <div
        className="px-3 py-2.5 border-b border-[var(--border-subtle)]"
        style={{ background: 'var(--bg-elevated)' }}
      >
        <div className="font-bold text-[var(--text-primary)]" style={{ fontSize: 11 }}>Stage 2 Leaders</div>
        <div className="text-[var(--text-muted)] mt-0.5" style={{ fontSize: 8 }}>
          Minervini Trend Template · Ranked by RS
        </div>
      </div>
      <div className="p-2">
        {[
          { rank: 1, t: 'NVDA', co: 'NVIDIA Corporation',   p: '$875', ch: '+4.2%' },
          { rank: 2, t: 'SMCI', co: 'Super Micro Computer', p: '$743', ch: '+3.8%' },
          { rank: 3, t: 'META', co: 'Meta Platforms',       p: '$530', ch: '+2.1%' },
          { rank: 4, t: 'ANET', co: 'Arista Networks',      p: '$312', ch: '+1.9%' },
          { rank: 5, t: 'CRDO', co: 'Credo Technology',     p: '$38',  ch: '+1.5%' },
        ].map(l => (
          <div key={l.t} className="flex items-center gap-2 px-2 py-1.5">
            <span
              className="font-mono text-[var(--text-faint)] flex-shrink-0 text-right"
              style={{ fontSize: 7, width: 10 }}
            >
              {l.rank}
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-mono font-extrabold text-[var(--text-primary)]" style={{ fontSize: 10 }}>
                {l.t}
              </div>
              <div className="text-[var(--text-faint)] truncate" style={{ fontSize: 7 }}>{l.co}</div>
            </div>
            <span className="font-mono text-[var(--text-muted)] flex-shrink-0" style={{ fontSize: 8 }}>{l.p}</span>
            <span className="font-mono font-bold flex-shrink-0" style={{ fontSize: 8, color: '#10F088' }}>
              {l.ch}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlaybookMockup() {
  return (
    <div
      className="rounded-xl overflow-hidden border border-[var(--border-subtle)]"
      style={{ background: 'var(--bg-surface)' }}
      dir="ltr"
    >
      <div
        className="px-3 py-2.5 border-b border-[var(--border-subtle)]"
        style={{ background: 'var(--bg-elevated)' }}
      >
        <div className="font-bold text-[var(--text-primary)]" style={{ fontSize: 11 }}>Playbook</div>
        <div className="flex items-center gap-3 mt-1.5">
          {[
            { l: 'Win Rate',  v: '68.4%', c: '#10F088' },
            { l: 'Avg R',     v: '+2.4R', c: '#10F088' },
            { l: 'Total PnL', v: '+$24K', c: '#10F088' },
          ].map(s => (
            <div key={s.l}>
              <div
                className="text-[var(--text-faint)] uppercase"
                style={{ fontSize: 6, letterSpacing: '0.15em' }}
              >
                {s.l}
              </div>
              <div className="font-mono font-extrabold" style={{ fontSize: 10, color: s.c }}>{s.v}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="p-2 space-y-1">
        {[
          { t: 'SMCI', o: 'winner', pnl: '+$4,600', r: '+3.2R' },
          { t: 'NVDA', o: 'winner', pnl: '+$3,200', r: '+2.8R' },
          { t: 'TSLA', o: 'winner', pnl: '+$1,850', r: '+1.9R' },
          { t: 'COIN', o: 'loser',  pnl: '-$820',   r: '-0.8R' },
        ].map(tr => (
          <div
            key={tr.t}
            className="flex items-center gap-2 px-2 py-1.5 rounded-[5px] border border-[var(--border-subtle)]"
            style={{ background: 'var(--bg-elevated)' }}
          >
            <div
              className="rounded-full flex-shrink-0"
              style={{ width: 3, height: 16, background: tr.o === 'winner' ? '#10F088' : '#FF3B5C' }}
            />
            <span
              className="font-mono font-extrabold text-[var(--text-primary)] flex-1"
              style={{ fontSize: 10 }}
            >
              {tr.t}
            </span>
            <span className="font-mono font-bold" style={{ fontSize: 9, color: tr.o === 'winner' ? '#10F088' : '#FF3B5C' }}>
              {tr.pnl}
            </span>
            <span className="font-mono" style={{ fontSize: 8, color: tr.o === 'winner' ? '#10F088' : '#FF3B5C' }}>
              {tr.r}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SizerMockup() {
  return (
    <div
      className="rounded-xl overflow-hidden border border-[var(--border-subtle)]"
      style={{ background: 'var(--bg-surface)' }}
      dir="ltr"
    >
      <div
        className="px-3 py-2.5 border-b border-[var(--border-subtle)]"
        style={{ background: 'var(--bg-elevated)' }}
      >
        <div className="font-bold text-[var(--text-primary)]" style={{ fontSize: 11 }}>Position Sizer</div>
        <div className="text-[var(--text-muted)] mt-0.5" style={{ fontSize: 8 }}>Risk-based · Phase 1 &amp; 2</div>
      </div>
      <div className="p-3 space-y-2">
        {[
          { l: 'Ticker',      v: 'NVDA'    },
          { l: 'Entry Price', v: '$875.20' },
          { l: 'Stop Price',  v: '$841.00' },
          { l: 'Risk %',      v: '1.5%'    },
        ].map(f => (
          <div key={f.l} className="flex items-center justify-between">
            <span
              className="uppercase text-[var(--text-faint)]"
              style={{ fontSize: 7, letterSpacing: '0.15em' }}
            >
              {f.l}
            </span>
            <span
              className="font-mono font-semibold text-[var(--text-primary)] px-2 py-0.5 rounded border border-[var(--border-subtle)]"
              style={{ fontSize: 9, background: 'var(--bg-elevated)' }}
            >
              {f.v}
            </span>
          </div>
        ))}
        <div
          className="rounded-[7px] p-2.5 mt-1"
          style={{ background: 'rgba(34,211,238,0.06)', border: '1px solid rgba(34,211,238,0.2)' }}
        >
          <div
            className="uppercase font-bold mb-1.5"
            style={{ fontSize: 7, color: 'rgba(34,211,238,0.7)', letterSpacing: '0.15em' }}
          >
            Phase 1 Result
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { l: 'Shares',   v: '512 sh'  },
              { l: 'Risk $',   v: '$1,875'  },
              { l: 'Stop %',   v: '3.9%'    },
              { l: 'Invested', v: '$44,800' },
            ].map(r => (
              <div key={r.l}>
                <div
                  className="uppercase"
                  style={{ fontSize: 6, color: 'rgba(34,211,238,0.6)', letterSpacing: '0.15em' }}
                >
                  {r.l}
                </div>
                <div className="font-mono font-extrabold" style={{ fontSize: 10, color: '#22D3EE' }}>{r.v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

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

  const status       = (sub?.status ?? 'cancelled') as SubscriptionStatus;
  const trialEnd     = sub?.trial_ends_at      ? new Date(sub.trial_ends_at)      : null;
  const periodEnd    = sub?.current_period_end ? new Date(sub.current_period_end) : null;
  const hasActiveSub = HAS_ACTIVE_SUB.includes(status);
  const isGrace      = status === 'grace';
  const isComp       = status === 'comp';
  const noSub        = !sub;
  const needsCard    = noSub || status === 'cancelled' || status === 'expired_grace';

  const graceDaysLeft = isGrace && trialEnd
    ? Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / 86_400_000))
    : null;

  // ── Landing page for users without a subscription ──────────────────────────
  if (needsCard) {
    return (
      <div
        className="min-h-screen bg-[var(--bg-primary)] font-[Manrope,ui-sans-serif,system-ui,sans-serif]"
        dir="rtl"
      >
        <GridOverlay />

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <header className="relative z-10 border-b border-[var(--border-subtle)] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#22D3EE] to-[#10F088] flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5 text-black" strokeWidth={3.5} />
            </div>
            <span className="text-[14px] font-extrabold tracking-tight text-[var(--text-primary)]">
              Momentum Playbook
            </span>
          </div>
          <button
            onClick={() => router.push('/onboarding/checkout')}
            className="flex items-center gap-1 text-xs text-[var(--text-faint)] hover:text-[var(--text-muted)] transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            להמשיך לתשלום
          </button>
        </header>

        <main className="relative z-10 max-w-[900px] mx-auto px-6 py-14 space-y-16">

          {/* ── Hero ──────────────────────────────────────────────────────── */}
          <div className="text-center space-y-5">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#10F088]/25 bg-[#10F088]/[0.06] text-[#10F088] text-xs font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10F088] animate-pulse" />
              ניסיון חינמי · ללא כרטיס אשראי
            </div>

            <h1 className="text-[38px] sm:text-[48px] font-extrabold tracking-tight leading-[1.1]">
              <span className="text-[var(--text-primary)]">הכלי של </span>
              <span className="bg-gradient-to-l from-[#22D3EE] to-[#10F088] bg-clip-text text-transparent">
                הטריידר המומנטום
              </span>
            </h1>

            <p className="text-[var(--text-secondary)] text-[17px] leading-relaxed max-w-[560px] mx-auto">
              יומן מסחר, ניתוח ביצועים, סריקת מניות יומית, ו-Position Sizer — כל מה שצריך כדי לסחור לפי שיטת Minervini.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                onClick={() => router.push('/onboarding/checkout')}
                className="w-full sm:w-auto px-8 py-3.5 rounded-[10px] text-[13px] font-extrabold uppercase tracking-[0.06em] bg-gradient-to-br from-[#22D3EE] to-[#10F088] text-black shadow-[0_0_30px_rgba(34,211,238,0.25)] hover:brightness-110 transition-all"
              >
                התחל חינם — {TRIAL_DAYS} יום ניסיון
              </button>
            </div>

            <p className="text-[var(--text-faint)] text-xs">
              ללא כרטיס אשראי · ביטול בכל עת · 50 ₪ / חודש לאחר הניסיון
            </p>
          </div>

          {/* ── App Preview Section ────────────────────────────────────────── */}
          <div>
            <h2 className="text-center text-[13px] uppercase tracking-[0.2em] font-bold text-[var(--text-faint)] mb-2">
              ממשק האפליקציה
            </h2>
            <p className="text-center text-[15px] text-[var(--text-secondary)] mb-8 leading-relaxed">
              בדיוק ככה נראית האפליקציה — הכל בזמן אמת
            </p>

            {/* Main dashboard mockup */}
            <div className="mb-5">
              <DashboardMockup />
            </div>

            {/* 3 smaller feature previews */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-[var(--text-faint)] mb-2 text-center">
                  Stage 2 Leaders
                </p>
                <LeadersMockup />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-[var(--text-faint)] mb-2 text-center">
                  Playbook
                </p>
                <PlaybookMockup />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-[var(--text-faint)] mb-2 text-center">
                  Position Sizer
                </p>
                <SizerMockup />
              </div>
            </div>
          </div>

          {/* ── Features grid ─────────────────────────────────────────────── */}
          <div>
            <h2 className="text-center text-[13px] uppercase tracking-[0.2em] font-bold text-[var(--text-faint)] mb-8">
              מה כלול
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {FEATURES.map(({ icon: Icon, color, title, desc }) => (
                <div
                  key={title}
                  className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 space-y-3 hover:border-[var(--border-strong)] transition-colors"
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{ background: `${color}18` }}
                  >
                    <Icon className="w-5 h-5" style={{ color }} strokeWidth={2} />
                  </div>
                  <div>
                    <p className="font-extrabold text-[var(--text-primary)] text-sm mb-1">{title}</p>
                    <p className="text-xs text-[var(--text-muted)] leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Pricing card ──────────────────────────────────────────────── */}
          <div className="max-w-[440px] mx-auto">
            <div className="rounded-2xl border border-[#22D3EE]/25 bg-[var(--bg-surface)] p-8 space-y-7 shadow-[0_0_50px_rgba(34,211,238,0.07)]">

              {/* Badge */}
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.14em] font-semibold text-[var(--text-faint)]">
                  Momentum Playbook
                </p>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#10F088]/10 text-[#10F088] border border-[#10F088]/20">
                  {TRIAL_DAYS} יום חינם
                </span>
              </div>

              {/* Price */}
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-[44px] font-extrabold tracking-tight text-[var(--text-primary)]">50 ₪</span>
                  <span className="text-[var(--text-muted)] text-base">/ חודש</span>
                </div>
                <p className="text-xs text-[var(--text-faint)] mt-0.5">כולל מע&quot;מ אם חל</p>
              </div>

              {/* Feature list */}
              <ul className="space-y-2.5">
                {PLAN_FEATURES.map(f => (
                  <li key={f} className="flex items-start gap-2.5">
                    <Check className="w-3.5 h-3.5 text-[#10F088] mt-0.5 shrink-0" />
                    <span className="text-sm text-[var(--text-secondary)]">{f}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <button
                onClick={() => router.push('/onboarding/checkout')}
                className="w-full py-3.5 rounded-[10px] text-[13px] font-extrabold uppercase tracking-[0.06em] bg-gradient-to-br from-[#22D3EE] to-[#10F088] text-black shadow-[0_0_20px_rgba(34,211,238,0.3)] hover:brightness-110 transition-all"
              >
                התחל ניסיון חינמי
              </button>

              <p className="text-xs text-[var(--text-faint)] text-center">
                ביטול בכל עת · אין חוזה · אין עמלות הפסקה
              </p>
            </div>
          </div>

        </main>
      </div>
    );
  }

  // ── Compact billing management for existing subscribers ────────────────────
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-4 font-[Manrope,ui-sans-serif,system-ui,sans-serif]" dir="rtl">
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
                  : <span>Momentum Playbook — 50 ₪ / חודש</span>}
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

          {/* CTA for grace users who want to upgrade */}
          {isGrace && (
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
          )}

          {!isGrace && !isComp && hasActiveSub && (
            <button
              onClick={() => router.push('/settings?tab=billing')}
              className="block w-full py-3 rounded-[10px] text-center text-[13px] font-extrabold uppercase tracking-[0.05em] border border-[var(--border-strong)] text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-all"
            >
              ניהול מנוי ← הגדרות
            </button>
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

function GridOverlay() {
  return (
    <div
      className="fixed inset-0 pointer-events-none z-0 opacity-[0.15]"
      style={{
        backgroundImage:
          'linear-gradient(rgba(34,211,238,0.07) 1px, transparent 1px), ' +
          'linear-gradient(90deg, rgba(34,211,238,0.07) 1px, transparent 1px)',
        backgroundSize: '52px 52px',
        maskImage: 'radial-gradient(ellipse at top, black 20%, transparent 75%)',
        WebkitMaskImage: 'radial-gradient(ellipse at top, black 20%, transparent 75%)',
      }}
    />
  );
}
