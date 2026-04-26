'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, Gift, X } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { supabase, type Subscription } from '@/lib/supabase-client';

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

export function TrialBanner() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [sub,       setSub]       = useState<Subscription | null | undefined>(undefined);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (loading || !user) return;
    supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => setSub(data as Subscription | null));
  }, [user, loading]);

  if (dismissed || sub === undefined || sub === null) return null;

  const { status, trial_ends_at } = sub;
  const isTrialing = status === 'trialing';
  const isGrace    = status === 'grace';

  if (!isTrialing && !isGrace) return null;
  if (!trial_ends_at) return null;

  const msLeft   = new Date(trial_ends_at).getTime() - Date.now();
  const daysLeft = Math.max(0, Math.ceil(msLeft / 86_400_000));

  // Trial banner: only show in last 3 days
  if (isTrialing && msLeft > THREE_DAYS_MS) return null;
  // Grace banner: show in last 7 days
  if (isGrace && msLeft > 7 * 24 * 60 * 60 * 1000) return null;

  const isGraceExpiring = isGrace;
  const color = isGraceExpiring ? '#22D3EE' : '#FF9F0A';
  const bgFrom = isGraceExpiring ? 'from-[#22D3EE]/10' : 'from-[#FF9F0A]/20';
  const bgTo   = isGraceExpiring ? 'to-[#10F088]/10'   : 'to-[#FF3B5C]/20';
  const border = isGraceExpiring ? 'border-[#22D3EE]/20' : 'border-[#FF9F0A]/30';

  const message = isGrace
    ? daysLeft === 0
      ? 'גישת הבטא החינמית מסתיימת היום!'
      : `גישת הבטא החינמית מסתיימת בעוד ${daysLeft} ${daysLeft === 1 ? 'יום' : 'ימים'}`
    : daysLeft === 0
      ? 'תקופת הניסיון מסתיימת היום!'
      : `תקופת הניסיון מסתיימת בעוד ${daysLeft} ${daysLeft === 1 ? 'יום' : 'ימים'}`;

  const ctaLabel = isGrace ? 'הוסף כרטיס אשראי' : 'הוסף כרטיס אשראי';

  return (
    <div
      className={`relative w-full bg-gradient-to-r ${bgFrom} ${bgTo} border-b ${border} px-4 py-2.5 flex items-center justify-between gap-3 text-sm`}
      style={{ color }}
    >
      <div className="flex items-center gap-2">
        {isGrace
          ? <Gift  className="w-4 h-4 shrink-0" />
          : <Clock className="w-4 h-4 shrink-0" />}
        <span className="font-semibold">{message}</span>
        <button
          onClick={() => router.push('/billing')}
          className="underline font-bold hover:opacity-80 transition-opacity ml-1"
        >
          {ctaLabel}
        </button>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="opacity-60 hover:opacity-100 transition-opacity shrink-0"
        aria-label="סגור"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
