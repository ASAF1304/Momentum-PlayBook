// app/welcome/page.tsx
//
// Public landing page — no authentication required.
// Hero, app mockups, feature grid, stats, testimonials and CTAs leading to /signup or /login.

'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight, BarChart2, BookOpen, Eye, FileSpreadsheet, Quote,
  ShieldCheck, Star, Target, TrendingUp, Zap, Sparkles, LineChart,
} from 'lucide-react';
import {
  DashboardMockup, LeadersMockup, PlaybookMockup, SizerMockup,
} from '@/components/landing/app-mockups';
import { TRIAL_DAYS } from '@/lib/trial-config';
import { cn } from '@/lib/utils';

const FEATURES = [
  { icon: BookOpen,         color: '#22D3EE', title: 'יומן מסחר',         desc: 'תיעוד מלא של כל טרייד — פייז 1 ו-2, יציאות חלקיות, Stop, Screenshot, Post-Mortem.' },
  { icon: Zap,              color: '#10F088', title: 'Live P&L',           desc: 'מחירים חיים על כל הפוזיציות הפתוחות שלך. רווח/הפסד לא ממומש בזמן אמת.' },
  { icon: BarChart2,        color: '#22D3EE', title: 'Playbook',           desc: 'ארכיון הטריידים שלך עם Win Rate, ממוצע R, ניתוח לפי Setup ותקופה.' },
  { icon: Target,           color: '#10F088', title: 'Position Sizer',     desc: 'חישוב גודל פוזיציה אוטומטי לפי % סיכון, מרחק Stop, וגודל החשבון.' },
  { icon: Star,             color: '#FFD60A', title: 'Stage 2 Leaders',    desc: 'סריקת מניות מומנטום יומית לפי קריטריוני Minervini — מתעדכן כל יום.' },
  { icon: ShieldCheck,      color: '#10F088', title: 'Validator',          desc: 'רשימת בדיקה pre-trade עם 12 נקודות לפי Trend Template של Minervini.' },
  { icon: Eye,              color: '#22D3EE', title: 'Watchlist',          desc: 'רשימת מעקב אישית עם גרפים מ-TradingView ופתיחה מהירה לטרייד.' },
  { icon: FileSpreadsheet,  color: '#10F088', title: 'ייבוא מברוקר',       desc: 'ייבוא אוטומטי מ-IBI, Meitav Trade, IBKR ו-eToro — אין הקלדה ידנית.' },
];

const STATS = [
  { value: 12, suffix: '+', label: 'כלים מקצועיים', color: '#22D3EE' },
  { value: 100, suffix: '%', label: 'מבוסס שיטת Minervini', color: '#10F088' },
  { value: 15, suffix: ' דק׳', label: 'עיכוב נתוני שוק', color: '#FFD60A' },
  { value: TRIAL_DAYS, suffix: ' ימים', label: 'ניסיון חינמי', color: '#22D3EE' },
];

const TESTIMONIALS = [
  {
    quote: 'סוף סוף יומן מסחר שמבין את שיטת המומנטום. ה-Position Sizer לבד שווה כל שקל.',
    author: 'משה ל.',
    role: 'סוחר Swing',
  },
  {
    quote: 'ה-Validator מציל אותי מטריידים גרועים יום-יום. 12 קריטריונים = אפס רגש.',
    author: 'דניאל ק.',
    role: 'סוחר Stage 2',
  },
  {
    quote: 'הסריקה היומית של Stage 2 Leaders הפכה את הבוקר שלי. רק מניות מומנטום אמיתיות.',
    author: 'יוסי א.',
    role: 'סוחר פוזיציות',
  },
];

// Animated count-up hook
function useCountUp(target: number, duration = 1500) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && !started.current) {
          started.current = true;
          const start = performance.now();
          const tick = (now: number) => {
            const t = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - t, 3);
            setValue(Math.round(target * eased));
            if (t < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }
      },
      { threshold: 0.3 },
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target, duration]);

  return { value, ref };
}

function StatCounter({ value, suffix, label, color }: { value: number; suffix: string; label: string; color: string }) {
  const { value: animated, ref } = useCountUp(value);
  return (
    <div ref={ref} className="text-center">
      <div
        className="font-mono text-[40px] sm:text-[52px] font-extrabold tracking-tight tabular-nums"
        style={{ color }}
      >
        {animated}{suffix}
      </div>
      <div className="text-[11px] sm:text-xs uppercase tracking-[0.16em] font-bold text-[var(--text-muted)] mt-2">
        {label}
      </div>
    </div>
  );
}

// Intersection-observer based reveal wrapper
function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) setVisible(true);
      },
      { threshold: 0.1, rootMargin: '-50px 0px' },
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(28px)',
        transition: `opacity 700ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms, transform 700ms cubic-bezier(0.22, 1, 0.36, 1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

export default function WelcomePage() {
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

      {/* Animated glows */}
      <div
        className="fixed top-[-200px] left-1/2 -translate-x-1/2 w-[800px] h-[800px] pointer-events-none z-0 animate-float-slow"
        style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.14) 0%, transparent 60%)' }}
      />
      <div
        className="fixed top-[400px] right-[-200px] w-[600px] h-[600px] pointer-events-none z-0 animate-float-slow"
        style={{ background: 'radial-gradient(circle, rgba(16,240,136,0.08) 0%, transparent 60%)', animationDelay: '2s' }}
      />

      {/* Nav */}
      <nav className="relative z-20 max-w-[1200px] mx-auto px-4 sm:px-6 py-5 flex items-center justify-between animate-slide-up">
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

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/login"
            className="min-h-[44px] flex items-center px-3 sm:px-4 py-2 rounded-[8px] text-xs sm:text-[13px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            התחבר
          </Link>
          <Link
            href="/signup"
            className="min-h-[44px] flex items-center px-4 sm:px-5 py-2 rounded-[10px] bg-gradient-to-br from-[#22D3EE] to-[#10F088] text-black text-xs sm:text-[13px] font-extrabold uppercase tracking-wider hover:brightness-110 hover:-translate-y-px transition-all shadow-[0_0_24px_rgba(34,211,238,0.28)]"
          >
            התחל חינם
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 max-w-[1200px] mx-auto px-4 sm:px-6 pt-10 sm:pt-20 pb-12 text-center">
        <Reveal>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#22D3EE]/20 bg-[#22D3EE]/[0.06] mb-6">
            <Sparkles className="w-3 h-3 text-[#22D3EE] animate-shimmer-glow" />
            <span className="text-[10px] uppercase tracking-[0.18em] font-bold text-[#22D3EE]">
              Built for Minervini-style traders
            </span>
          </div>
        </Reveal>

        <Reveal delay={100}>
          <h1 className="text-[40px] sm:text-[64px] md:text-[76px] font-extrabold tracking-tight leading-[1.02] mb-5 text-[var(--text-primary)]">
            המערכת המלאה
            <br />
            <span
              className="bg-gradient-to-br from-[#22D3EE] via-[#10F088] to-[#22D3EE] bg-clip-text text-transparent animate-gradient-text"
              style={{ backgroundSize: '200% 200%' }}
            >
              לסוחר מומנטום
            </span>
          </h1>
        </Reveal>

        <Reveal delay={200}>
          <p className="text-[15px] sm:text-[19px] text-[var(--text-secondary)] max-w-[640px] mx-auto leading-relaxed mb-9 px-2">
            יומן מסחר חכם, סריקת Stage 2 יומית, Position Sizer לפי % סיכון, ו-Playbook מלא של כל טרייד —
            הכל במקום אחד, מבוסס על השיטה של Mark Minervini.
          </p>
        </Reveal>

        <Reveal delay={300}>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-3 px-4">
            <Link
              href="/signup"
              className="group w-full sm:w-auto min-h-[52px] inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-[12px] bg-gradient-to-br from-[#22D3EE] to-[#10F088] text-black text-sm font-extrabold uppercase tracking-[0.05em] hover:brightness-110 hover:-translate-y-px transition-all shadow-[0_0_36px_rgba(34,211,238,0.4)]"
            >
              התחל ניסיון חינמי {TRIAL_DAYS} ימים
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto min-h-[52px] inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] text-sm font-bold hover:border-[var(--border-strong)] hover:bg-[var(--bg-elevated)] hover:-translate-y-px transition-all"
            >
              יש לי חשבון
            </Link>
          </div>
        </Reveal>

        <Reveal delay={400}>
          <p className="text-[11px] text-[var(--text-faint)] mt-4">
            ללא כרטיס אשראי · ביטול בכל רגע · כל המידע שלך, פרטי לחלוטין
          </p>
        </Reveal>
      </section>

      {/* Animated stats strip */}
      <section className="relative z-10 max-w-[1100px] mx-auto px-4 sm:px-6 py-10">
        <Reveal>
          <div
            className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 py-7 px-5 sm:px-9 rounded-[18px] border border-[var(--border-subtle)] bg-[var(--bg-surface)]"
            style={{ boxShadow: 'var(--shadow-card), var(--inner-highlight)' }}
          >
            {STATS.map(s => (
              <StatCounter key={s.label} {...s} />
            ))}
          </div>
        </Reveal>
      </section>

      {/* App Preview */}
      <section className="relative z-10 max-w-[1100px] mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <Reveal>
          <h2 className="text-center text-[11px] uppercase tracking-[0.22em] font-bold text-[var(--text-faint)] mb-2">
            ממשק האפליקציה
          </h2>
        </Reveal>
        <Reveal delay={100}>
          <p className="text-center text-[15px] sm:text-[17px] text-[var(--text-secondary)] mb-10 leading-relaxed">
            בדיוק ככה נראית האפליקציה — הכל בזמן אמת
          </p>
        </Reveal>

        <Reveal delay={200}>
          <div className="mb-6 hover:-translate-y-1 transition-transform duration-500">
            <DashboardMockup />
          </div>
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Reveal delay={300}>
            <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-[var(--text-faint)] mb-2 text-center">
              Stage 2 Leaders
            </p>
            <div className="hover:-translate-y-1 transition-transform duration-500">
              <LeadersMockup />
            </div>
          </Reveal>
          <Reveal delay={400}>
            <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-[var(--text-faint)] mb-2 text-center">
              Playbook
            </p>
            <div className="hover:-translate-y-1 transition-transform duration-500">
              <PlaybookMockup />
            </div>
          </Reveal>
          <Reveal delay={500}>
            <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-[var(--text-faint)] mb-2 text-center">
              Position Sizer
            </p>
            <div className="hover:-translate-y-1 transition-transform duration-500">
              <SizerMockup />
            </div>
          </Reveal>
        </div>
      </section>

      {/* Why Stage 2 educational block */}
      <section className="relative z-10 max-w-[1000px] mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <Reveal>
          <div
            className="rounded-[20px] border border-[#22D3EE]/20 bg-gradient-to-br from-[#22D3EE]/[0.04] to-[#10F088]/[0.04] p-7 sm:p-10 relative overflow-hidden"
            style={{ boxShadow: 'var(--shadow-card), var(--inner-highlight)' }}
          >
            <div className="flex items-start gap-4 sm:gap-5 flex-col sm:flex-row">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 border"
                style={{ background: '#22D3EE14', borderColor: '#22D3EE33' }}
              >
                <LineChart className="w-6 h-6 text-[#22D3EE]" strokeWidth={2} />
              </div>
              <div className="flex-1">
                <h3 className="text-[20px] sm:text-[24px] font-extrabold tracking-tight text-[var(--text-primary)] mb-2">
                  למה רק Stage 2?
                </h3>
                <p className="text-[14px] sm:text-[15px] text-[var(--text-secondary)] leading-relaxed mb-4">
                  Stan Weinstein הוכיח את זה ב-1988 ו-Mark Minervini הביא לפסגה — רק{' '}
                  <span className="text-[#10F088] font-bold">10-15% מהמניות בכל זמן נתון נמצאות ב-Stage 2</span>{' '}
                  (תקופת עלייה אמיתית).
                  זה המקום היחיד שבו כסף עושים — לא ב-Stage 1 (ניסיון לקנות תחתית), לא ב-Stage 3 (ניסיון לתפוס פסגה),
                  ובטוח לא ב-Stage 4 (התרסקות).
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {['200 EMA עולה', 'RS Rating 80+', 'מחיר 25% מעל 52-week low', 'מחיר תוך 25% מ-52-week high'].map(t => (
                    <span
                      key={t}
                      className="text-[11px] font-mono font-bold px-2.5 py-1 rounded-md bg-[#10F088]/10 text-[#10F088] border border-[#10F088]/25"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Features grid */}
      <section className="relative z-10 max-w-[1200px] mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <Reveal>
          <div className="text-center mb-12">
            <h2 className="text-[11px] uppercase tracking-[0.22em] font-bold text-[var(--text-faint)] mb-2">
              מה כלול
            </h2>
            <h3 className="text-[28px] sm:text-[40px] font-extrabold tracking-tight text-[var(--text-primary)]">
              כל מה שאתה צריך, במקום אחד
            </h3>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map((f, i) => {
            const Icon = f.icon;
            return (
              <Reveal key={f.title} delay={i * 60}>
                <div
                  className="group h-full p-5 rounded-[14px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)] hover:-translate-y-1 transition-all duration-300"
                  style={{ boxShadow: 'var(--shadow-card), var(--inner-highlight)' }}
                >
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center mb-3 border group-hover:scale-110 transition-transform"
                    style={{ background: `${f.color}14`, borderColor: `${f.color}33` }}
                  >
                    <Icon className="w-5 h-5" style={{ color: f.color }} strokeWidth={2} />
                  </div>
                  <h4 className="text-[15px] font-extrabold text-[var(--text-primary)] mb-1.5 tracking-tight">
                    {f.title}
                  </h4>
                  <p className="text-[12.5px] text-[var(--text-muted)] leading-relaxed">{f.desc}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* Testimonials */}
      <section className="relative z-10 max-w-[1200px] mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <Reveal>
          <div className="text-center mb-12">
            <h2 className="text-[11px] uppercase tracking-[0.22em] font-bold text-[var(--text-faint)] mb-2">
              מה אומרים סוחרים
            </h2>
            <h3 className="text-[28px] sm:text-[40px] font-extrabold tracking-tight text-[var(--text-primary)]">
              שיטה שעובדת — בלי רגש
            </h3>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {TESTIMONIALS.map((t, i) => (
            <Reveal key={t.author} delay={i * 100}>
              <div
                className="h-full p-6 rounded-[14px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:-translate-y-1 transition-all duration-300"
                style={{ boxShadow: 'var(--shadow-card), var(--inner-highlight)' }}
              >
                <Quote className="w-7 h-7 text-[#22D3EE]/40 mb-3" strokeWidth={1.5} />
                <p className="text-[13.5px] text-[var(--text-secondary)] leading-relaxed mb-5">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="flex items-center gap-2.5 pt-4 border-t border-[var(--border-subtle)]">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#22D3EE]/30 to-[#10F088]/30 flex items-center justify-center font-extrabold text-[var(--text-primary)] text-sm flex-shrink-0">
                    {t.author[0]}
                  </div>
                  <div>
                    <div className="text-[13px] font-bold text-[var(--text-primary)] leading-tight">
                      {t.author}
                    </div>
                    <div className="text-[11px] text-[var(--text-faint)] mt-0.5">
                      {t.role}
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Pricing tiers preview */}
      <section className="relative z-10 max-w-[1100px] mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <Reveal>
          <div className="text-center mb-10">
            <h2 className="text-[11px] uppercase tracking-[0.22em] font-bold text-[var(--text-faint)] mb-2">
              תמחור
            </h2>
            <h3 className="text-[28px] sm:text-[40px] font-extrabold tracking-tight text-[var(--text-primary)]">
              שכבה לכל סוג סוחר
            </h3>
            <p className="text-[14px] text-[var(--text-secondary)] mt-3 max-w-[520px] mx-auto">
              ניסיון חינמי {TRIAL_DAYS} ימים בכל שכבה. ללא כרטיס אשראי. ביטול בכל רגע.
            </p>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { name: 'Starter', price: 29, tagline: 'כלי הליבה של השיטה', accent: '#22D3EE', highlight: false },
            { name: 'Pro',     price: 59, tagline: 'הכי פופולרי · לסוחר רציני', accent: '#10F088', highlight: true },
            { name: 'Elite',   price: 149, tagline: 'לסוחר Full-Time', accent: '#A78BFA', highlight: false },
          ].map((t, i) => (
            <Reveal key={t.name} delay={i * 100}>
              <div
                className={cn(
                  'relative p-6 rounded-[14px] transition-all duration-300 hover:-translate-y-1 h-full',
                  t.highlight
                    ? 'border-2 border-[#10F088]/40 bg-[var(--bg-surface)]'
                    : 'border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)]',
                )}
                style={{
                  boxShadow: t.highlight
                    ? 'var(--shadow-card), 0 0 40px rgba(16,240,136,0.10), var(--inner-highlight)'
                    : 'var(--shadow-card), var(--inner-highlight)',
                }}
              >
                {t.highlight && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full text-[8.5px] font-extrabold uppercase tracking-[0.18em] bg-gradient-to-r from-[#22D3EE] to-[#10F088] text-black shadow-[0_4px_16px_rgba(16,240,136,0.3)]">
                    Popular
                  </span>
                )}
                <div className="text-[10px] uppercase tracking-[0.18em] font-extrabold mb-1" style={{ color: t.accent }}>
                  {t.name}
                </div>
                <p className="text-[11px] text-[var(--text-muted)] mb-4">{t.tagline}</p>
                <div className="flex items-baseline gap-1.5 mb-1">
                  <span className="font-mono text-[36px] font-extrabold tracking-tight text-[var(--text-primary)] tabular-nums">${t.price}</span>
                  <span className="text-[12px] text-[var(--text-muted)]">/ חודש</span>
                </div>
                <p className="text-[10.5px] text-[var(--text-faint)] mb-5">חיוב שנתי = חיסכון 20%</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={350}>
          <div className="text-center mt-7">
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-[12px] bg-gradient-to-br from-[#22D3EE] to-[#10F088] text-black text-sm font-extrabold uppercase tracking-[0.05em] hover:brightness-110 hover:-translate-y-px transition-all shadow-[0_0_36px_rgba(34,211,238,0.35)] min-h-[52px] group"
            >
              ראה השוואה מלאה
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <p className="text-[11px] text-[var(--text-faint)] mt-3">
              לקוחות קיימים נשארים במחיר המקורי לנצח · Founding Members
            </p>
          </div>
        </Reveal>
      </section>

      {/* Final CTA strip */}
      <section className="relative z-10 max-w-[1200px] mx-auto px-4 sm:px-6 py-12 sm:py-20">
        <Reveal>
          <div className="text-center">
            <h3 className="text-[26px] sm:text-[40px] font-extrabold tracking-tight text-[var(--text-primary)] mb-3">
              מוכן להתחיל לסחור עם שיטה?
            </h3>
            <p className="text-[14px] sm:text-[16px] text-[var(--text-secondary)] mb-7 max-w-[520px] mx-auto leading-relaxed">
              הפסק להמר. התחל לעקוב. {TRIAL_DAYS} ימי ניסיון חינמי, ללא כרטיס אשראי.
            </p>
            <Link
              href="/signup"
              className="group inline-flex items-center gap-2 px-8 py-4 rounded-[12px] bg-gradient-to-br from-[#22D3EE] to-[#10F088] text-black text-sm font-extrabold uppercase tracking-[0.05em] hover:brightness-110 hover:-translate-y-px transition-all shadow-[0_0_40px_rgba(34,211,238,0.4)] min-h-[52px]"
            >
              התחל עכשיו, חינם
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="relative z-10 max-w-[1200px] mx-auto px-4 sm:px-6 py-10 border-t border-[var(--border-subtle)] mt-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-[var(--text-faint)]">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-gradient-to-br from-[#22D3EE] to-[#10F088] flex items-center justify-center">
              <TrendingUp className="w-2.5 h-2.5 text-black" strokeWidth={3.5} />
            </div>
            <span className="font-semibold text-[var(--text-muted)]">Momentum Playbook</span>
            <span>© {new Date().getFullYear()}</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/legal/disclaimer" className="hover:text-[var(--text-muted)] transition-colors">Disclaimer</Link>
            <Link href="/legal/terms"      className="hover:text-[var(--text-muted)] transition-colors">Terms</Link>
            <Link href="/legal/privacy"    className="hover:text-[var(--text-muted)] transition-colors">Privacy</Link>
          </div>
        </div>
        <p className="text-[10px] text-[var(--text-faint)] text-center mt-5 leading-relaxed max-w-[640px] mx-auto">
          Momentum Playbook אינה ייעוץ השקעות. כל הנתונים מוצגים למטרות חינוכיות בלבד.
          הסחר במניות כרוך בסיכון של אובדן הון. אחריות הסחר על המשתמש בלבד.
        </p>
      </footer>
    </div>
  );
}
