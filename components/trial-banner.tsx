'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, X } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { supabase, type Subscription } from '@/lib/supabase-client';

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

export function TrialBanner() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [sub, setSub]         = useState<Subscription | null | undefined>(undefined);
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

  if (
    dismissed ||
    sub === undefined ||          // not yet loaded
    sub === null ||               // no subscription row
    sub.status !== 'trialing' ||  // not in trial
    !sub.trial_ends_at            // no trial end date
  ) return null;

  const msLeft = new Date(sub.trial_ends_at).getTime() - Date.now();
  if (msLeft > THREE_DAYS_MS) return null; // more than 3 days left — don't show yet

  const daysLeft = Math.max(0, Math.ceil(msLeft / (24 * 60 * 60 * 1000)));

  return (
    <div className="relative w-full bg-gradient-to-r from-[#FF9F0A]/20 to-[#FF3B5C]/20 border-b border-[#FF9F0A]/30 px-4 py-2.5 flex items-center justify-between gap-3 text-sm">
      <div className="flex items-center gap-2 text-[#FF9F0A]">
        <Clock className="w-4 h-4 shrink-0" />
        <span className="font-semibold">
          {daysLeft === 0
            ? 'תקופת הניסיון מסתיימת היום!'
            : `תקופת הניסיון מסתיימת בעוד ${daysLeft} ${daysLeft === 1 ? 'יום' : 'ימים'}`}
        </span>
        <button
          onClick={() => router.push('/billing')}
          className="underline font-bold text-[#FF9F0A] hover:text-[#FF9F0A]/80 transition-colors ml-1"
        >
          הוסף כרטיס אשראי
        </button>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="text-[#FF9F0A]/60 hover:text-[#FF9F0A] transition-colors shrink-0"
        aria-label="סגור"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
