// app/(auth)/reset-password/page.tsx
// Supabase redirects here after the user clicks the password reset email link.
// The URL contains a code query param that Supabase auto-exchanges for a session.

'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, TrendingUp } from 'lucide-react';
import { supabase } from '@/lib/supabase-client';
import { cn } from '@/lib/utils';

function ResetForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const [password,   setPassword]   = useState('');
  const [confirm,    setConfirm]    = useState('');
  const [errors,     setErrors]     = useState<{ password?: string; confirm?: string }>({});
  const [serverError,setServerError]= useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done,       setDone]       = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  // Supabase auto-exchanges the code in the URL for a session on load.
  // We just need to wait for the auth state change.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setSessionReady(true);
    });

    // Also check current session immediately in case the exchange already happened
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true);
    });

    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const errs: typeof errors = {};
    if (password.length < 6)  errs.password = 'Password must be at least 6 characters.';
    if (confirm !== password)  errs.confirm  = 'Passwords do not match.';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setErrors({});
    setServerError(null);
    setSubmitting(true);

    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setServerError(error.message);
      setSubmitting(false);
      return;
    }

    setDone(true);
    setTimeout(() => router.push('/'), 2000);
  };

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] backdrop-blur p-8">
      {/* Logo */}
      <div className="flex items-center gap-2.5 mb-8">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#22D3EE] to-[#10F088] flex items-center justify-center">
          <TrendingUp className="w-4 h-4 text-black" strokeWidth={3.5} />
        </div>
        <div className="flex flex-col leading-none">
          <span className="text-[15px] font-extrabold tracking-tight text-zinc-100">Momentum Playbook</span>
          <span className="text-[9px] text-zinc-600 tracking-[0.22em] uppercase font-semibold mt-0.5">Stage 2 only</span>
        </div>
      </div>

      <h1 className="text-[20px] font-extrabold tracking-tight text-zinc-100 mb-1">Set new password</h1>
      <p className="text-xs text-zinc-500 mb-6">Choose a new password for your account.</p>

      {done ? (
        <div className="px-4 py-5 rounded-[10px] bg-[#10F088]/[0.06] border border-[#10F088]/30 text-center">
          <p className="text-[13px] text-[#10F088] font-semibold">Password updated!</p>
          <p className="text-xs text-zinc-400 mt-1">Redirecting you to the dashboard…</p>
        </div>
      ) : !sessionReady ? (
        <div className="flex items-center gap-2 py-8 text-zinc-500 text-sm">
          <Loader2 className="w-4 h-4 animate-spin text-[#22D3EE]" />
          Verifying reset link…
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-[0.14em] font-semibold text-zinc-400">New Password</label>
            <input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setErrors(p => ({ ...p, password: undefined })); }}
              autoComplete="new-password"
              placeholder="6+ characters"
              className={cn(
                'bg-black/30 border rounded-[8px] px-3 py-2.5 text-[14px] text-zinc-100 placeholder:text-zinc-700 focus:outline-none focus:ring-[3px] transition',
                errors.password
                  ? 'border-[#FF3B5C] focus:border-[#FF3B5C] focus:ring-[#FF3B5C]/15'
                  : 'border-white/[0.06] focus:border-[#22D3EE] focus:ring-[#22D3EE]/15',
              )}
            />
            {errors.password && <p className="text-[11px] text-[#FF3B5C] mt-0.5">{errors.password}</p>}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-[0.14em] font-semibold text-zinc-400">Confirm Password</label>
            <input
              type="password"
              value={confirm}
              onChange={e => { setConfirm(e.target.value); setErrors(p => ({ ...p, confirm: undefined })); }}
              autoComplete="new-password"
              placeholder="••••••••"
              className={cn(
                'bg-black/30 border rounded-[8px] px-3 py-2.5 text-[14px] text-zinc-100 placeholder:text-zinc-700 focus:outline-none focus:ring-[3px] transition',
                errors.confirm
                  ? 'border-[#FF3B5C] focus:border-[#FF3B5C] focus:ring-[#FF3B5C]/15'
                  : 'border-white/[0.06] focus:border-[#22D3EE] focus:ring-[#22D3EE]/15',
              )}
            />
            {errors.confirm && <p className="text-[11px] text-[#FF3B5C] mt-0.5">{errors.confirm}</p>}
          </div>

          {serverError && (
            <div className="px-3 py-2.5 rounded-[8px] bg-[#FF3B5C]/[0.06] border border-[#FF3B5C]/30 text-xs text-[#FF3B5C]">
              {serverError}
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
            {submitting ? 'Updating…' : 'Update password'}
          </button>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-950" />}>
      <ResetForm />
    </Suspense>
  );
}
