'use client';

import { useEffect, useState } from 'react';
import { X, TrendingUp, BookOpen, ShieldCheck, Gift, ChevronLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase-client';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';

const BASE_SLIDES = [
  {
    icon: TrendingUp,
    iconColor: '#22D3EE',
    title: 'ברוכים הבאים ל-Momentum Playbook',
    body: 'כלי לניהול יומן מסחר שנבנה סביב מתודולוגיית Stage 2 של Minervini. תעדו עסקאות, נתחו ביצועים, ושפרו את המשמעת המסחרית שלכם — כל הנתונים שלכם, פרטיים ומאובטחים.',
  },
  {
    icon: BookOpen,
    iconColor: '#10F088',
    title: 'מה תמצאו כאן',
    body: 'יומן מסחר מלא עם ייבוא מ-IBI, Meitav, IBKR ו-eToro. Playbook למסחר וירטואלי. Stage 2 Leaders לסריקת מניות יומית. Validator — מסנן Stage 2 לפי Minervini.',
  },
  {
    icon: ShieldCheck,
    iconColor: '#FF9F0A',
    title: 'כתב ויתור חשוב',
    body: 'Momentum Playbook אינה מספקת ייעוץ השקעות. כל הנתונים המוצגים — לרבות מחירים, RS ותבנית מגמה — הם למטרות תיעוד אישי בלבד. מסחר בניירות ערך כרוך בסיכון גבוה לאובדן הון. אתם אחראים לכל ההחלטות הפיננסיות שלכם.',
  },
];

const GRACE_SLIDE = {
  icon: Gift,
  iconColor: '#10F088',
  title: 'שמחים שהצטרפת לבטא הסגור 🎉',
  body: 'קיבלת 30 יום גישה מלאה לאפליקציה בחינם, ללא צורך בכרטיס אשראי. כשהגישה תסתיים, תוכלו להמשיך ב-50 ₪ לחודש. עד אז — בנה את היומן שלך ותתחיל לעקוב!',
};

interface OnboardingModalProps {
  onDismiss: () => void;
}

export function OnboardingModal({ onDismiss }: OnboardingModalProps) {
  const { user, refreshProfile } = useAuth();
  const [isGrace, setIsGrace] = useState(false);
  const [slide,   setSlide]   = useState(0);
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('subscriptions')
      .select('status')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setIsGrace((data as { status?: string } | null)?.status === 'grace');
      });
  }, [user]);

  const slides = isGrace ? [...BASE_SLIDES, GRACE_SLIDE] : BASE_SLIDES;
  const isLast  = slide === slides.length - 1;
  const current = slides[slide];
  const Icon    = current.icon;

  const handleDismiss = async () => {
    if (!user || saving) return;
    setSaving(true);
    await supabase
      .from('user_profiles')
      .update({ dismissed_onboarding_at: new Date().toISOString() })
      .eq('id', user.id);
    await refreshProfile();
    onDismiss();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" dir="rtl">
      <div className="relative w-full max-w-[420px] rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-surface)] p-8 shadow-2xl">

        {/* Close */}
        <button
          onClick={handleDismiss}
          disabled={saving}
          className="absolute top-4 left-4 text-[var(--text-faint)] hover:text-[var(--text-secondary)] transition-colors"
          aria-label="סגור"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Slide dots */}
        <div className="flex justify-center gap-1.5 mb-8">
          {slides.map((_, i) => (
            <div
              key={i}
              className={cn(
                'h-1.5 rounded-full transition-all duration-300',
                i === slide ? 'w-5 bg-[#22D3EE]' : 'w-1.5 bg-[var(--border-strong)]',
              )}
            />
          ))}
        </div>

        {/* Icon */}
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 mx-auto"
          style={{ backgroundColor: current.iconColor + '18' }}
        >
          <Icon className="w-7 h-7" style={{ color: current.iconColor }} />
        </div>

        {/* Content */}
        <h2 className="text-[18px] font-extrabold tracking-tight text-[var(--text-primary)] text-center mb-3">
          {current.title}
        </h2>
        <p className="text-sm text-[var(--text-muted)] text-center leading-relaxed">
          {current.body}
        </p>

        {/* Navigation */}
        <div className="mt-8 flex items-center justify-between gap-3">
          {slide > 0 ? (
            <button
              onClick={() => setSlide(s => s - 1)}
              className="flex items-center gap-1 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              הקודם
            </button>
          ) : (
            <div />
          )}

          {isLast ? (
            <button
              onClick={handleDismiss}
              disabled={saving}
              className="px-6 py-2.5 rounded-[10px] text-[13px] font-extrabold uppercase tracking-[0.05em] bg-gradient-to-br from-[#22D3EE] to-[#10F088] text-black shadow-[0_0_20px_rgba(34,211,238,0.3)] hover:brightness-110 transition-all disabled:opacity-60"
            >
              {saving ? '…' : 'התחל'}
            </button>
          ) : (
            <button
              onClick={() => setSlide(s => s + 1)}
              className="px-6 py-2.5 rounded-[10px] text-[13px] font-extrabold uppercase tracking-[0.05em] bg-gradient-to-br from-[#22D3EE] to-[#10F088] text-black shadow-[0_0_20px_rgba(34,211,238,0.3)] hover:brightness-110 transition-all"
            >
              הבא
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
