// app/(auth)/forgot-password/page.tsx

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2, TrendingUp } from 'lucide-react';
import { supabase } from '@/lib/supabase-client';
import { cn } from '@/lib/utils';

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

export default function ForgotPasswordPage() {
  const [email,      setEmail]      = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [sent,       setSent]       = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError,setServerError]= useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (!isValidEmail(email)) {
      setEmailError('Please enter a valid email address.');
      return;
    }

    setEmailError(null);
    setServerError(null);
    setSubmitting(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setServerError(error.message);
      setSubmitting(false);
      return;
    }

    setSent(true);
    setSubmitting(false);
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
        Reset password
      </h1>
      <p className="text-xs text-zinc-500 mb-6">
        Enter your account email and we&apos;ll send you a reset link.
      </p>

      {sent ? (
        <div className="px-4 py-5 rounded-[10px] bg-[#10F088]/[0.06] border border-[#10F088]/30 text-center">
          <p className="text-[13px] text-[#10F088] font-semibold mb-1">Check your email</p>
          <p className="text-xs text-zinc-400 leading-relaxed">
            A password reset link has been sent to <span className="text-zinc-200 font-mono">{email}</span>.
            If you don&apos;t see it, check your spam folder.
          </p>
          <div className="mt-4">
            <Link href="/login" className="text-xs font-bold text-[#22D3EE] hover:underline">
              Back to sign in
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-[0.14em] font-semibold text-zinc-400">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setEmailError(null); }}
              autoComplete="email"
              placeholder="you@example.com"
              className={cn(
                'bg-black/30 border rounded-[8px] px-3 py-2.5 text-[14px] text-zinc-100 placeholder:text-zinc-700 focus:outline-none focus:ring-[3px] transition',
                emailError
                  ? 'border-[#FF3B5C] focus:border-[#FF3B5C] focus:ring-[#FF3B5C]/15'
                  : 'border-white/[0.06] focus:border-[#22D3EE] focus:ring-[#22D3EE]/15',
              )}
            />
            {emailError && (
              <p className="text-[11px] text-[#FF3B5C] mt-0.5">{emailError}</p>
            )}
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
            {submitting ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
      )}

      {!sent && (
        <p className="mt-5 text-center text-xs text-zinc-500">
          Remember your password?{' '}
          <Link href="/login" className="text-[#22D3EE] hover:underline font-semibold">
            Sign in
          </Link>
        </p>
      )}
    </div>
  );
}
