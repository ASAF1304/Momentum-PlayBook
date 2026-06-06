// app/pricing/page.tsx
//
// Public pricing page — accessible without login.
// Three tiers (Starter / Pro / Elite) per docs/PRICING_STRATEGY.md.
// Grandfathered Founding Member callout for legacy $19 customers.

'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowRight, Check, Crown, ShieldCheck, Sparkles, Star, TrendingUp, Zap } from 'lucide-react';
import { TRIAL_DAYS } from '@/lib/trial-config';
import { cn } from '@/lib/utils';

type Billing = 'monthly' | 'annual';

interface Tier {
  key:        'starter' | 'pro' | 'elite';
  name:       string;
  tagline:    string;
  priceMonthly: number;
  priceAnnual:  number;
  cta:        { label: string; href: string };
  highlight?: boolean;
  capLabel?:  string;
  icon:       typeof TrendingUp;
  accent:     string;
  persona:    string;
  features:   string[];
  inheritsFrom?: string;
}

const TIERS: Tier[] = [
  {
    key:          'starter',
    name:         'Starter',
    tagline:      'הכלים הליבתיים של השיטה',
    priceMonthly: 29,
    priceAnnual:  290,
    cta:          { label: `התחל ניסיון ${TRIAL_DAYS} ימים`, href: '/signup?plan=starter' },
    icon:         Zap,
    accent:       '#22D3EE',
    persona:      'סוחר Stage 2 מתחיל · חשבון עד $25k',
    features: [
      'Pre-Trade Validator עם 12 קריטריוני Trend Template',
      'Stage 2 Leaders — סריקת מניות יומית',
      'Position Sizer (Phase 1 + 2) לפי % סיכון',
      'Watchlist עד 50 טיקרים',
      'Trade Journal — פייזים, יציאות חלקיות, screenshots',
      'Playbook — Win Rate, Avg R, ניתוח לפי Setup',
      'ייבוא מ-IBI / Meitav / IBKR / eToro',
      `ניסיון חינמי ${TRIAL_DAYS} ימים`,
    ],
  },
  {
    key:          'pro',
    name:         'Pro',
    tagline:      'הכי פופולרי · השכבה לסוחר רציני',
    priceMonthly: 59,
    priceAnnual:  590,
    cta:          { label: `התחל ניסיון ${TRIAL_DAYS} ימים`, href: '/signup?plan=pro' },
    highlight:    true,
    icon:         Star,
    accent:       '#10F088',
    persona:      'סוחר מומנטום פעיל · חשבון $25k-$200k',
    inheritsFrom: 'Starter',
    features: [
      'Asaf Lens — Market Read שבועי חי + מוקלט',
      'Personal Edge Discovery — Heatmap לפי שעה / יום / Setup',
      'Anti-pattern detection (זיהוי גישות מפסידות אישיות)',
      'ייצוא טופס 1322 לדוח רווחי הון ישראלי',
      'Cooling-Off אוטומטי אחרי 2 הפסדים רצופים',
      'Morning Prep + Evening Review (טקסי משמעת)',
      'גישה לקהילה פרטית של סוחרים בלבד',
      'Watchlist ללא הגבלה',
      'תמיכה במייל ב-24 שעות',
    ],
  },
  {
    key:          'elite',
    name:         'Elite',
    tagline:      'לסוחרים עם הון משמעותי',
    priceMonthly: 149,
    priceAnnual:  1490,
    cta:          { label: 'הגש מועמדות', href: '/signup?plan=elite' },
    capLabel:     '50 מקומות בלבד',
    icon:         Crown,
    accent:       '#A78BFA',
    persona:      'סוחר Full-Time · חשבון $100k+',
    inheritsFrom: 'Pro',
    features: [
      'שיחת רבעון אחת על אחד עם אסף (60 דקות)',
      'גישה מוקדמת ל-Stage 2 Scan (15 דק׳ לפני שאר השכבות)',
      'קו WhatsApp ישיר עם אסף לדיון על setups',
      'גישה ראשונה לפיצ׳רים חדשים (Beta)',
      'מחיר נעול ל-24 חודשים — מוגן מהעלאות',
      'התראות מותאמות אישית לטיקרים שלך',
    ],
  },
];

export default function PricingPage() {
  const [billing, setBilling] = useState<Billing>('annual');

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] font-[Manrope,ui-sans-serif,system-ui,sans-serif] overflow-x-hidden">
      {/* Grid background */}
      <div
        className="fixed inset-0 pointer-events-none z-0 opacity-[0.18]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(34,211,238,0.06) 1px, transparent 1px), ' +
            'linear-gradient(90deg, rgba(34,211,238,0.06) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse at top, black 30%, transparent 80%)',
          WebkitMaskImage: 'radial-gradient(ellipse at top, black 30%, transparent 80%)',
        }}
      />

      {/* Glow */}
      <div
        className="fixed top-[-200px] left-1/2 -translate-x-1/2 w-[800px] h-[800px] pointer-events-none z-0"
        style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.10) 0%, transparent 60%)' }}
      />

      {/* Header / Nav */}
      <nav className="relative z-20 max-w-[1200px] mx-auto px-4 sm:px-6 py-5 flex items-center justify-between">
        <Link href="/welcome" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#22D3EE] to-[#10F088] flex items-center justify-center group-hover:scale-105 transition-transform">
            <TrendingUp className="w-4 h-4 text-black" strokeWidth={3.5} />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-[15px] font-extrabold tracking-tight text-[var(--text-primary)]">
              Momentum Playbook
            </span>
            <span className="text-[9px] text-[var(--text-faint)] tracking-[0.22em] uppercase font-semibold mt-0.5">
              Stage 2 only
            </span>
          </div>
        </Link>
        <Link
          href="/login"
          className="min-h-[44px] flex items-center px-3 sm:px-4 py-2 rounded-[8px] text-xs sm:text-[13px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        >
          התחבר
        </Link>
      </nav>

      {/* Hero */}
      <section className="relative z-10 max-w-[1200px] mx-auto px-4 sm:px-6 pt-8 sm:pt-14 pb-8 text-center animate-slide-up">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#22D3EE]/20 bg-[#22D3EE]/[0.06] mb-5">
          <Sparkles className="w-3 h-3 text-[#22D3EE]" />
          <span className="text-[10px] uppercase tracking-[0.18em] font-bold text-[#22D3EE]">
            תמחור
          </span>
        </div>

        <h1 className="text-[36px] sm:text-[52px] font-extrabold tracking-tight leading-[1.05] mb-3 text-[var(--text-primary)]">
          בחר את השכבה שמתאימה לאיך שאתה סוחר
        </h1>
        <p className="text-[14px] sm:text-[16px] text-[var(--text-secondary)] max-w-[560px] mx-auto leading-relaxed">
          תמחור פשוט, ללא הגבלות מוסתרות.
          ניסיון חינמי {TRIAL_DAYS} ימים בכל שכבה — ללא כרטיס אשראי.
        </p>

        {/* Billing toggle */}
        <div className="mt-7 inline-flex items-center gap-1 p-1 rounded-[10px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
          <button
            type="button"
            onClick={() => setBilling('monthly')}
            className={cn(
              'px-4 py-2 rounded-[7px] text-xs font-bold transition-all',
              billing === 'monthly'
                ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]',
            )}
          >
            חיוב חודשי
          </button>
          <button
            type="button"
            onClick={() => setBilling('annual')}
            className={cn(
              'px-4 py-2 rounded-[7px] text-xs font-bold transition-all flex items-center gap-1.5',
              billing === 'annual'
                ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]',
            )}
          >
            חיוב שנתי
            <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-[#10F088]/15 text-[#10F088] border border-[#10F088]/25 uppercase tracking-wider">
              חיסכון 20%
            </span>
          </button>
        </div>
      </section>

      {/* Tiers */}
      <section className="relative z-10 max-w-[1200px] mx-auto px-4 sm:px-6 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {TIERS.map(tier => (
            <TierCard key={tier.key} tier={tier} billing={billing} />
          ))}
        </div>
      </section>

      {/* Founding Member callout */}
      <section className="relative z-10 max-w-[820px] mx-auto px-4 sm:px-6 pb-12">
        <div
          className="rounded-[14px] border border-[#22D3EE]/25 bg-gradient-to-br from-[#22D3EE]/[0.04] to-[#10F088]/[0.04] p-5 sm:p-6"
          style={{ boxShadow: 'var(--shadow-card), var(--inner-highlight)' }}
        >
          <div className="flex items-start gap-4 flex-col sm:flex-row">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border"
              style={{ background: '#22D3EE14', borderColor: '#22D3EE40' }}
            >
              <ShieldCheck className="w-5 h-5 text-[#22D3EE]" strokeWidth={2} />
            </div>
            <div className="flex-1">
              <div className="text-[10px] uppercase tracking-[0.18em] font-extrabold text-[#22D3EE] mb-1">
                Founding Members
              </div>
              <h3 className="text-[15px] sm:text-[16px] font-extrabold text-[var(--text-primary)] mb-1.5">
                לקוחות קיימים נשארים במחיר המקורי לנצח
              </h3>
              <p className="text-[12.5px] sm:text-[13px] text-[var(--text-secondary)] leading-relaxed">
                אם אתה כבר משלם מנוי ב-Momentum Playbook — המחיר שלך נעול. השכבות החדשות
                ($29/$59/$149) חלות רק על הצטרפויות חדשות. אין צורך לעשות שום דבר —
                אנחנו מטפלים בזה אוטומטית.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="relative z-10 max-w-[820px] mx-auto px-4 sm:px-6 pb-16">
        <h2 className="text-[11px] uppercase tracking-[0.22em] font-bold text-[var(--text-faint)] text-center mb-2">
          שאלות נפוצות
        </h2>
        <h3 className="text-[24px] sm:text-[28px] font-extrabold tracking-tight text-[var(--text-primary)] text-center mb-7">
          מה שכדאי לדעת
        </h3>

        <dl className="space-y-3">
          {FAQS.map(({ q, a }) => (
            <div
              key={q}
              className="rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 sm:px-5 py-4"
              style={{ boxShadow: 'var(--shadow-card)' }}
            >
              <dt className="font-bold text-[14px] text-[var(--text-primary)] mb-1">{q}</dt>
              <dd className="text-[12.5px] sm:text-[13px] text-[var(--text-muted)] leading-relaxed">{a}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Footer */}
      <footer className="relative z-10 max-w-[1200px] mx-auto px-4 sm:px-6 py-10 border-t border-[var(--border-subtle)]">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-[var(--text-faint)]">
          <p>
            בהצטרפות אתה מסכים ל{' '}
            <Link href="/legal/terms" className="underline hover:text-[var(--text-muted)] transition-colors">
              תנאי השימוש
            </Link>
            {' '}ול{' '}
            <Link href="/legal/privacy" className="underline hover:text-[var(--text-muted)] transition-colors">
              מדיניות הפרטיות
            </Link>
            .
          </p>
          <div className="flex items-center gap-4">
            <Link href="/legal/refund" className="hover:text-[var(--text-muted)] transition-colors">החזרים</Link>
            <Link href="/legal/disclaimer" className="hover:text-[var(--text-muted)] transition-colors">כתב ויתור</Link>
          </div>
        </div>
        <p className="text-[10px] text-[var(--text-faint)] text-center mt-4 leading-relaxed max-w-[640px] mx-auto">
          Momentum Playbook אינה ייעוץ השקעות. הסחר במניות כרוך בסיכון. אחריות הסחר על המשתמש בלבד.
        </p>
      </footer>
    </div>
  );
}

// ── Tier card ────────────────────────────────────────────────────────────────

function TierCard({ tier, billing }: { tier: Tier; billing: Billing }) {
  const Icon = tier.icon;
  const price = billing === 'monthly' ? tier.priceMonthly : Math.round(tier.priceAnnual / 12);
  const billedSubtitle = billing === 'monthly'
    ? 'לחודש · חיוב חודשי'
    : `$${tier.priceAnnual} לשנה · חיסכון $${tier.priceMonthly * 12 - tier.priceAnnual}`;

  return (
    <div
      className={cn(
        'relative flex flex-col rounded-[16px] p-6 sm:p-7 transition-all duration-300',
        tier.highlight
          ? 'border-2 border-[#10F088]/40 bg-[var(--bg-surface)] hover:-translate-y-1'
          : 'border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)] hover:-translate-y-1',
      )}
      style={{
        boxShadow: tier.highlight
          ? 'var(--shadow-card), 0 0 50px rgba(16,240,136,0.12), var(--inner-highlight)'
          : 'var(--shadow-card), var(--inner-highlight)',
      }}
    >
      {tier.highlight && (
        <div
          className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-[0.18em] bg-gradient-to-r from-[#22D3EE] to-[#10F088] text-black shadow-[0_4px_20px_rgba(16,240,136,0.35)]"
        >
          הכי פופולרי
        </div>
      )}

      {tier.capLabel && (
        <div
          className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-[0.18em] border"
          style={{ background: `${tier.accent}1F`, color: tier.accent, borderColor: `${tier.accent}55` }}
        >
          {tier.capLabel}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-2.5 mb-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center border"
          style={{ background: `${tier.accent}14`, borderColor: `${tier.accent}40` }}
        >
          <Icon className="w-5 h-5" style={{ color: tier.accent }} strokeWidth={2.2} />
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] font-bold" style={{ color: tier.accent }}>
            {tier.name}
          </div>
          <div className="text-[11px] text-[var(--text-muted)] mt-0.5">{tier.tagline}</div>
        </div>
      </div>

      {/* Persona */}
      <p className="text-[11px] text-[var(--text-faint)] mb-5 leading-relaxed">
        {tier.persona}
      </p>

      {/* Price */}
      <div className="mb-5">
        <div className="flex items-baseline gap-1.5">
          <span className="font-mono text-[44px] font-extrabold tracking-tight text-[var(--text-primary)] tabular-nums">
            ${price}
          </span>
          <span className="text-[13px] text-[var(--text-muted)]">/ חודש</span>
        </div>
        <p className="text-[10.5px] text-[var(--text-faint)] mt-1.5">
          {billedSubtitle}
        </p>
      </div>

      {/* CTA */}
      <Link
        href={tier.cta.href}
        className={cn(
          'w-full text-center py-3 rounded-[10px] text-[12px] font-extrabold uppercase tracking-[0.05em] transition-all flex items-center justify-center gap-2 mb-5',
          tier.highlight
            ? 'bg-gradient-to-br from-[#22D3EE] to-[#10F088] text-black shadow-[0_0_24px_rgba(34,211,238,0.3)] hover:brightness-110 hover:-translate-y-px'
            : 'border border-[var(--border-strong)] text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] hover:-translate-y-px',
        )}
      >
        {tier.cta.label}
        <ArrowRight className="w-3.5 h-3.5" />
      </Link>

      {tier.inheritsFrom && (
        <div className="mb-3 text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
          כל מה שב-{tier.inheritsFrom} + ↓
        </div>
      )}

      {/* Features */}
      <ul className="space-y-2.5 flex-1">
        {tier.features.map(f => (
          <li key={f} className="flex items-start gap-2.5 text-[12.5px] text-[var(--text-secondary)] leading-snug">
            <span
              className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 border"
              style={{ background: `${tier.accent}1A`, borderColor: `${tier.accent}33` }}
            >
              <Check className="w-2.5 h-2.5" style={{ color: tier.accent }} strokeWidth={3.5} />
            </span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── FAQ ──────────────────────────────────────────────────────────────────────

const FAQS: { q: string; a: string }[] = [
  {
    q: 'האם אני צריך כרטיס אשראי לתקופת הניסיון?',
    a: `לא. ${TRIAL_DAYS} ימי הניסיון חינמיים לחלוטין ולא דורשים פרטי תשלום.`,
  },
  {
    q: 'מה ההבדל בין Starter ל-Pro?',
    a: 'Starter כולל את כלי הליבה של השיטה — Validator, Stage 2 Leaders, Sizer ו-Journal. Pro מוסיף את Asaf Lens (Market Read שבועי), Personal Edge Discovery, וטופס 1322 לדוח מס שנתי. אם אתה עושה יותר מ-3 טריידים בחודש, Pro מחזיר את עצמו תוך טרייד אחד.',
  },
  {
    q: 'איך אני מצטרף ל-Elite?',
    a: 'Elite מוגבל ל-50 מקומות בלבד (אסף נותן רבעון אישי לכל חבר). אם המקומות מלאים, תתווסף לרשימת המתנה. אם פנויים — תקבל אישור תוך 48 שעות.',
  },
  {
    q: 'ניתן לבטל בכל עת?',
    a: 'כן. ביטול דרך פורטל הלקוחות, ייכנס לתוקף בתום תקופת החיוב הנוכחית. אין עמלת ביטול.',
  },
  {
    q: 'יש החזרים?',
    a: '14 ימי החזר מלא, ללא שאלות. אם זה לא בשבילך — תקבל את הכסף בחזרה.',
  },
  {
    q: 'אני כבר משלם — האם המחיר שלי עולה?',
    a: 'לא. כל לקוח קיים נשאר במחיר המקורי לנצח. השכבות החדשות חלות רק על הצטרפויות חדשות.',
  },
  {
    q: 'אפשר לשנות שכבה אחרי שהצטרפתי?',
    a: 'כן. אפשר לעלות / לרדת שכבה בכל רגע מתוך פורטל הלקוחות. החיוב מתעדכן יחסית.',
  },
];
