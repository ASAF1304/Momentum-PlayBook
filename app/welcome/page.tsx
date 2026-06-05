// app/welcome/page.tsx
//
// Public landing page — no authentication required.
// Hero, app mockups, feature grid, and CTAs leading to /signup or /login.

'use client';

import Link from 'next/link';
import {
  ArrowRight, BarChart2, BookOpen, Check, Eye, FileSpreadsheet,
  ShieldCheck, Star, Target, TrendingUp, Zap,
} from 'lucide-react';
import {
  DashboardMockup, LeadersMockup, PlaybookMockup, SizerMockup,
} from '@/components/landing/app-mockups';
import { TRIAL_DAYS } from '@/lib/trial-config';

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

      {/* Glow */}
      <div
        className="fixed top-[-200px] left-1/2 -translate-x-1/2 w-[800px] h-[800px] pointer-events-none z-0"
        style={{
          background: 'radial-gradient(circle, rgba(34,211,238,0.12) 0%, transparent 60%)',
        }}
      />

      {/* Nav */}
      <nav className="relative z-20 max-w-[1200px] mx-auto px-4 sm:px-6 py-5 flex items-center justify-between">
        <Link href="/welcome" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#22D3EE] to-[#10F088] flex items-center justify-center">
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
            className="px-3 sm:px-4 py-2 rounded-[8px] text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            התחבר
          </Link>
          <Link
            href="/signup"
            className="px-3 sm:px-4 py-2 rounded-[8px] bg-gradient-to-br from-[#22D3EE] to-[#10F088] text-black text-xs font-extrabold uppercase tracking-wider hover:brightness-110 transition-all shadow-[0_0_20px_rgba(34,211,238,0.25)]"
          >
            התחל חינם
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 max-w-[1200px] mx-auto px-4 sm:px-6 pt-12 sm:pt-20 pb-12 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#22D3EE]/20 bg-[#22D3EE]/[0.06] mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-[#22D3EE] animate-pulse" />
          <span className="text-[10px] uppercase tracking-[0.18em] font-bold text-[#22D3EE]">
            Built for Minervini-style traders
          </span>
        </div>

        <h1 className="text-[36px] sm:text-[56px] md:text-[68px] font-extrabold tracking-tight leading-[1.05] mb-5 text-[var(--text-primary)]">
          המערכת המלאה
          <br />
          <span className="bg-gradient-to-br from-[#22D3EE] to-[#10F088] bg-clip-text text-transparent">
            לסוחר מומנטום
          </span>
        </h1>

        <p className="text-[15px] sm:text-[18px] text-[var(--text-secondary)] max-w-[640px] mx-auto leading-relaxed mb-9">
          יומן מסחר חכם, סריקת Stage 2 יומית, Position Sizer לפי % סיכון, ו-Playbook מלא של כל טרייד —
          הכל במקום אחד, מבוסס על השיטה של Mark Minervini.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-3">
          <Link
            href="/signup"
            className="group inline-flex items-center gap-2 px-7 py-3.5 rounded-[12px] bg-gradient-to-br from-[#22D3EE] to-[#10F088] text-black text-sm font-extrabold uppercase tracking-[0.05em] hover:brightness-110 transition-all shadow-[0_0_30px_rgba(34,211,238,0.4)]"
          >
            התחל ניסיון חינמי {TRIAL_DAYS} ימים
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] text-sm font-bold hover:border-[var(--border-strong)] hover:bg-[var(--bg-elevated)] transition-all"
          >
            יש לי חשבון
          </Link>
        </div>
        <p className="text-[11px] text-[var(--text-faint)] mt-3">
          ללא כרטיס אשראי · ביטול בכל רגע · כל המידע שלך, פרטי לחלוטין
        </p>
      </section>

      {/* App Preview */}
      <section className="relative z-10 max-w-[1100px] mx-auto px-4 sm:px-6 py-8">
        <h2 className="text-center text-[11px] uppercase tracking-[0.22em] font-bold text-[var(--text-faint)] mb-2">
          ממשק האפליקציה
        </h2>
        <p className="text-center text-[15px] text-[var(--text-secondary)] mb-8 leading-relaxed">
          בדיוק ככה נראית האפליקציה — הכל בזמן אמת
        </p>
        <div className="mb-5">
          <DashboardMockup />
        </div>
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
      </section>

      {/* Features grid */}
      <section className="relative z-10 max-w-[1200px] mx-auto px-4 sm:px-6 py-16">
        <div className="text-center mb-12">
          <h2 className="text-[11px] uppercase tracking-[0.22em] font-bold text-[var(--text-faint)] mb-2">
            מה כלול
          </h2>
          <h3 className="text-[28px] sm:text-[36px] font-extrabold tracking-tight text-[var(--text-primary)]">
            כל מה שאתה צריך, במקום אחד
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map(f => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="p-5 rounded-[14px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)] transition-colors"
                style={{ boxShadow: 'var(--shadow-card), var(--inner-highlight)' }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 border"
                  style={{ background: `${f.color}14`, borderColor: `${f.color}33` }}
                >
                  <Icon className="w-5 h-5" style={{ color: f.color }} strokeWidth={2} />
                </div>
                <h4 className="text-[14px] font-extrabold text-[var(--text-primary)] mb-1.5 tracking-tight">
                  {f.title}
                </h4>
                <p className="text-[12px] text-[var(--text-muted)] leading-relaxed">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Plan card */}
      <section className="relative z-10 max-w-[640px] mx-auto px-4 sm:px-6 py-16">
        <div className="text-center mb-8">
          <h2 className="text-[11px] uppercase tracking-[0.22em] font-bold text-[var(--text-faint)] mb-2">
            תוכנית פשוטה
          </h2>
          <h3 className="text-[28px] sm:text-[36px] font-extrabold tracking-tight text-[var(--text-primary)]">
            הכל פתוח, מחיר אחד
          </h3>
        </div>

        <div
          className="rounded-[20px] border border-[#22D3EE]/30 p-7 sm:p-9 bg-[var(--bg-surface)] relative overflow-hidden"
          style={{ boxShadow: 'var(--shadow-card), 0 0 60px rgba(34,211,238,0.08)' }}
        >
          <div
            className="absolute top-0 left-0 right-0 h-[3px]"
            style={{ background: 'linear-gradient(to right, #22D3EE, #10F088)' }}
          />
          <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-[#22D3EE] mb-1">
                Pro
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-mono text-[42px] font-extrabold tracking-tight text-[var(--text-primary)]">
                  $19
                </span>
                <span className="text-[14px] text-[var(--text-muted)]">/ חודש</span>
              </div>
              <p className="text-[11px] text-[var(--text-faint)] mt-1.5">
                {TRIAL_DAYS} ימי ניסיון חינמי · ביטול בכל רגע
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-[#10F088]/15 text-[#10F088] border border-[#10F088]/30 text-[9px] font-extrabold uppercase tracking-[0.16em] flex-shrink-0">
              ★ הכי פופולרי
            </span>
          </div>

          <ul className="space-y-2.5 mb-7">
            {PLAN_FEATURES.map(f => (
              <li key={f} className="flex items-start gap-2.5 text-[13px] text-[var(--text-secondary)]">
                <span className="w-4 h-4 rounded-full bg-[#10F088]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Check className="w-2.5 h-2.5 text-[#10F088]" strokeWidth={3.5} />
                </span>
                <span>{f}</span>
              </li>
            ))}
          </ul>

          <Link
            href="/signup"
            className="block w-full text-center py-3.5 rounded-[12px] bg-gradient-to-br from-[#22D3EE] to-[#10F088] text-black text-sm font-extrabold uppercase tracking-[0.05em] hover:brightness-110 transition-all shadow-[0_0_30px_rgba(34,211,238,0.35)]"
          >
            התחל ניסיון חינמי →
          </Link>
        </div>
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
