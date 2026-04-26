// app/auth/forgot-password/page.tsx
// Sends a password reset email via Supabase Auth.
// Always shows the same vague success message to prevent email enumeration.

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2, TrendingUp } from 'lucide-react';
import { supabase } from '@/lib/supabase-client';
import { cn } from '@/lib/utils';

export default function ForgotPasswordPage() {
  const [email,     setEmail]     = useState('');
  const [sent,      setSent]      = useState(false);
  const [submitting,setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
    } catch {
      // Intentionally swallow errors — we never reveal whether an email exists.
    } finally {
      setSubmitting(false);
      setSent(true);
    }
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
        איפוס סיסמה
      </h1>
      <p className="text-xs text-zinc-500 mb-6">
        נשלח אליך קישור לאיפוס הסיסמה.
      </p>

      {sent ? (
        <div className="flex flex-col gap-4">
          <div className="px-4 py-3 rounded-[10px] bg-[#10F088]/[0.07] border border-[#10F088]/25 text-xs text-[#10F088] leading-relaxed">
            אם הכתובת קיימת במערכת, שלחנו אליה קישור לאיפוס.
          </div>
          <Link
            href="/login"
            className="text-center text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            ← חזרה להתחברות
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs uppercase tracking-[0.14em] font-semibold text-zinc-400">
              כתובת אימייל
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="you@example.com"
              className="bg-black/30 border border-white/[0.06] rounded-[8px] px-3 py-2.5 text-[14px] text-zinc-100 placeholder:text-zinc-700 focus:outline-none focus:border-[#22D3EE] focus:ring-[3px] focus:ring-[#22D3EE]/15 transition"
            />
          </div>

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
            {submitting ? 'שולח…' : 'שלח לי קישור לאיפוס'}
          </button>

          <Link
            href="/login"
            className="text-center text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            ← חזרה להתחברות
          </Link>
        </form>
      )}
    </div>
  );
}
