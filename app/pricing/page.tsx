// app/pricing/page.tsx
//
// Public pricing page — accessible without login.
// Shows the single subscription tier with trial details.

import type { Metadata } from 'next';
import Link from 'next/link';
import { Check, TrendingUp } from 'lucide-react';

export const metadata: Metadata = { title: 'תמחור — Momentum Playbook' };

const FEATURES = [
  'יומן מסחר מלא — פתיחה, סקייל-אין, יציאות חלקיות',
  'ייבוא אוטומטי מ-IBI, Meitav Trade, IBKR, eToro',
  'Playbook — מה-אם ומסחר ורטואלי',
  'Stage 2 Leaders — סריקת מניות יומית',
  'Validator — מסנן Stage 2 לפי Minervini',
  'Live P&L על פוזיציות פתוחות',
  'ניתוח Win Rate, ממוצע R, ו-Total PnL',
  'גישה מכל מכשיר — אין צורך בהתקנה',
];

export default function PricingPage() {
  return (
    <div
      className="min-h-screen bg-[#0A0A0F] text-white font-[Manrope,ui-sans-serif,system-ui,sans-serif]"
      dir="rtl"
    >
      {/* Header */}
      <header className="border-b border-white/[0.06] px-6 py-4">
        <Link href="/" className="inline-flex items-center gap-2.5 hover:opacity-80 transition-opacity">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#22D3EE] to-[#10F088] flex items-center justify-center">
            <TrendingUp className="w-3.5 h-3.5 text-black" strokeWidth={3.5} />
          </div>
          <span className="text-[14px] font-extrabold tracking-tight">Momentum Playbook</span>
        </Link>
      </header>

      <main className="max-w-[680px] mx-auto px-6 py-16 space-y-12">
        {/* Hero */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-extrabold tracking-tight">תמחור פשוט</h1>
          <p className="text-zinc-400 text-lg">
            תוכנית אחת. כל הכלים. ניסיון חינמי ללא כרטיס אשראי.
          </p>
        </div>

        {/* Pricing card */}
        <div className="rounded-2xl border border-[#22D3EE]/30 bg-white/[0.03] p-8 space-y-8 shadow-[0_0_40px_rgba(34,211,238,0.08)]">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] font-semibold text-zinc-500 mb-1">
                Momentum Playbook
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-extrabold">50 ₪</span>
                <span className="text-zinc-400 text-base">לחודש</span>
              </div>
              <p className="text-xs text-zinc-600 mt-1">כולל מע&quot;מ אם חל</p>
            </div>
            <div className="text-right">
              <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-[#10F088]/10 text-[#10F088] border border-[#10F088]/20">
                30 יום ניסיון חינמי
              </span>
            </div>
          </div>

          {/* Features */}
          <ul className="space-y-3">
            {FEATURES.map(feature => (
              <li key={feature} className="flex items-start gap-3">
                <Check className="w-4 h-4 text-[#10F088] mt-0.5 shrink-0" />
                <span className="text-sm text-zinc-300">{feature}</span>
              </li>
            ))}
          </ul>

          {/* CTA */}
          <Link
            href="/signup"
            className="block w-full py-3.5 rounded-[10px] text-center text-[13px] font-extrabold uppercase tracking-[0.06em] bg-gradient-to-br from-[#22D3EE] to-[#10F088] text-black shadow-[0_0_20px_rgba(34,211,238,0.3)] hover:brightness-110 transition-all"
          >
            התחל ניסיון חינמי — ללא כרטיס אשראי
          </Link>

          <p className="text-xs text-zinc-600 text-center">
            ביטול בכל עת. אין חוזה. אין עמלות הפסקה.
          </p>
        </div>

        {/* FAQ */}
        <div className="space-y-6">
          <h2 className="text-xl font-extrabold">שאלות נפוצות</h2>
          <dl className="space-y-5 text-sm">
            {[
              {
                q: 'האם אני צריך להזין כרטיס אשראי לתקופת הניסיון?',
                a: 'לא. תקופת הניסיון של 30 יום אינה מחייבת פרטי כרטיס אשראי.',
              },
              {
                q: 'מה קורה אחרי 30 יום?',
                a: 'תקבלו התראה לפני סיום הניסיון. תוכלו להזין כרטיס אשראי ולעבור למנוי, או לא — הבחירה שלכם.',
              },
              {
                q: 'ניתן לבטל בכל עת?',
                a: 'כן. ביטול מבוצע דרך פורטל הלקוחות של Paddle ויכנס לתוקף בתום תקופת החיוב הנוכחית.',
              },
              {
                q: 'האם ניתן לקבל החזר?',
                a: 'ראו את מדיניות ההחזרים המלאה שלנו.',
              },
            ].map(({ q, a }) => (
              <div key={q} className="border-b border-white/[0.05] pb-5">
                <dt className="font-bold text-white mb-1.5">{q}</dt>
                <dd className="text-zinc-400">{a}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Legal links */}
        <div className="text-center text-xs text-zinc-700 space-y-2">
          <p>
            בהצטרפות אתם מסכימים ל
            <Link href="/legal/terms" className="underline hover:text-zinc-500 mx-1">תנאי השימוש</Link>
            ול
            <Link href="/legal/privacy" className="underline hover:text-zinc-500 mx-1">מדיניות הפרטיות</Link>
            שלנו.
          </p>
          <p>
            <Link href="/legal/refund" className="underline hover:text-zinc-500">מדיניות החזרים</Link>
            {' · '}
            <Link href="/legal/disclaimer" className="underline hover:text-zinc-500">כתב ויתור</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
