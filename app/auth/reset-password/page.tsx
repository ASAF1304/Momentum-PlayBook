// app/auth/reset-password/page.tsx
// Handles the password reset landing page.
//
// Flow: user clicks the email link → lands here with ?code=... in the URL.
// @supabase/ssr's detectSessionInUrl automatically exchanges the code for a
// PASSWORD_RECOVERY session. The auth context sets user to the recovery user,
// enabling updateUser() to work without a separate login.

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, TrendingUp } from 'lucide-react';
import { supabase } from '@/lib/supabase-client';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';

export default function ResetPasswordPage() {
  const router = useRouter();

  const [password,  setPassword]  = useState('');
  const [confirm,   setConfirm]   = useState('');
  const [error,     setError]     = useState<string | null>(null);
  const [submitting,setSubmitting] = useState(false);
  const [ready,     setReady]     = useState(false);

  // Wait for Supabase to exchange the recovery code. The auth state change to
  // PASSWORD_RECOVERY signals that we have a valid recovery session.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setReady(true);
      }
    });
    // Also check if there's already an active session (e.g., page reload after exchange).
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) { setError('הסיסמה חייבת להכיל לפחות 8 תווים.'); return; }
    if (password !== confirm)  { setError('הסיסמאות אינן תואמות.'); return; }
    if (submitting) return;
    setSubmitting(true);

    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setSubmitting(false);
      return;
    }

    toast({ title: 'הסיסמה עודכנה', variant: 'success' });
    router.push('/');
  };

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] backdrop-blur p-8">
      {/* Logo */}
      <div className="flex items-center gap-2.5 mb-8">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#22D3EE] to-[#10F088] flex items-center justify-center">
          <TrendingUp className="w-4 h-4 text-black" strokeWidth={3.5} />
        </div>
        <div className="flex flex-col leading-none">
          <span className="text-[15px] font-extrabold tracking-tight text-zinc-100">
            Momentum Playbook
          </span>
          <span className="text-[9px] text-zinc-600 tracking-[0.22em] uppercase font-semibold mt-0.5">
            Stage 2 only
          </span>
        </div>
      </div>

      <h1 className="text-[20px] font-extrabold tracking-tight text-zinc-100 mb-1">
        סיסמה חדשה
      </h1>
      <p className="text-xs text-zinc-500 mb-6">
        בחר סיסמה חדשה לחשבון שלך.
      </p>

      {!ready ? (
        <div className="flex items-center gap-2 py-6 text-zinc-500 text-xs">
          <Loader2 className="w-4 h-4 animate-spin" />
          מאמת את הקישור…
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs uppercase tracking-[0.14em] font-semibold text-zinc-400">
              סיסמה חדשה
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="לפחות 8 תווים"
              className="bg-black/30 border border-white/[0.06] rounded-[8px] px-3 py-2.5 text-[14px] text-zinc-100 placeholder:text-zinc-700 focus:outline-none focus:border-[#22D3EE] focus:ring-[3px] focus:ring-[#22D3EE]/15 transition"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs uppercase tracking-[0.14em] font-semibold text-zinc-400">
              אימות סיסמה חדשה
            </label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              placeholder="חזור על הסיסמה"
              className="bg-black/30 border border-white/[0.06] rounded-[8px] px-3 py-2.5 text-[14px] text-zinc-100 placeholder:text-zinc-700 focus:outline-none focus:border-[#22D3EE] focus:ring-[3px] focus:ring-[#22D3EE]/15 transition"
            />
          </div>

          {error && (
            <div className="px-3 py-2.5 rounded-[8px] bg-[#FF3B5C]/[0.06] border border-[#FF3B5C]/30 text-xs text-[#FF3B5C]">
              {error}{' '}
              <Link href="/auth/forgot-password" className="underline hover:no-underline">
                בקש קישור חדש
              </Link>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className={cn(
              'mt-1 w-full py-3 rounded-[10px] text-[13px] font-extrabold uppercase tracking-[0.05em] transition-all flex items-center justify-center gap-2',
              submitting
                ? 'bg-white/[0.04] text-zinc-600 cursor-not-allowed'
                : 'bg-gradient-to-br from-[#22D3EE] to-[#10F088] text-black shadow-[0_0_20px_rgba(34,211,238,0.3)] hover:brightness-110',
            )}
          >
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {submitting ? 'מעדכן…' : 'עדכן סיסמה'}
          </button>
        </form>
      )}
    </div>
  );
}
