// app/(auth)/signup/page.tsx

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, TrendingUp } from 'lucide-react';
import { supabase } from '@/lib/supabase-client';
import { cn } from '@/lib/utils';

export default function SignupPage() {
  const router = useRouter();
  const [email,      setEmail]      = useState('');
  const [password,   setPassword]   = useState('');
  const [confirm,    setConfirm]    = useState('');
  const [error,      setError]      = useState<string | null>(null);
  const [message,    setMessage]    = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setError(null);
    setSubmitting(true);

    const { data, error: authError } = await supabase.auth.signUp({ email, password });

    if (authError) {
      setError(authError.message);
      setSubmitting(false);
      return;
    }

    if (data.session) {
      // Email confirmation disabled — signed in immediately
      router.push('/onboarding');
    } else {
      // Email confirmation required
      setMessage('Check your inbox to confirm your email, then sign in.');
      setSubmitting(false);
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
        Create account
      </h1>
      <p className="text-[12px] text-zinc-500 mb-6">
        Set up your trading journal in under a minute.
      </p>

      {message ? (
        <div className="px-4 py-4 rounded-[10px] bg-[#10F088]/[0.06] border border-[#10F088]/30 text-[13px] text-[#10F088] text-center leading-relaxed">
          {message}
          <div className="mt-3">
            <Link href="/login" className="font-bold underline">
              Back to sign in
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase tracking-[0.14em] font-semibold text-zinc-400">
              Email
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

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase tracking-[0.14em] font-semibold text-zinc-400">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              placeholder="6+ characters"
              className="bg-black/30 border border-white/[0.06] rounded-[8px] px-3 py-2.5 text-[14px] text-zinc-100 placeholder:text-zinc-700 focus:outline-none focus:border-[#22D3EE] focus:ring-[3px] focus:ring-[#22D3EE]/15 transition"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] uppercase tracking-[0.14em] font-semibold text-zinc-400">
              Confirm Password
            </label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
              autoComplete="new-password"
              placeholder="••••••••"
              className="bg-black/30 border border-white/[0.06] rounded-[8px] px-3 py-2.5 text-[14px] text-zinc-100 placeholder:text-zinc-700 focus:outline-none focus:border-[#22D3EE] focus:ring-[3px] focus:ring-[#22D3EE]/15 transition"
            />
          </div>

          {error && (
            <div className="px-3 py-2.5 rounded-[8px] bg-[#FF3B5C]/[0.06] border border-[#FF3B5C]/30 text-[12px] text-[#FF3B5C]">
              {error}
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
            {submitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>
      )}

      {!message && (
        <p className="mt-5 text-center text-[12px] text-zinc-500">
          Have an account?{' '}
          <Link href="/login" className="text-[#22D3EE] hover:underline font-semibold">
            Sign in
          </Link>
        </p>
      )}
    </div>
  );
}
