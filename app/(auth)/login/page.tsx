// app/(auth)/login/page.tsx

'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, Loader2, TrendingUp, Info } from 'lucide-react';
import { supabase } from '@/lib/supabase-client';
import { clearAuthStorage } from '@/lib/auth-context';
import { cn } from '@/lib/utils';

// useSearchParams() must live inside a Suspense boundary for static export.
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reason = searchParams.get('reason');

  const [email,      setEmail]      = useState('');
  const [password,   setPassword]   = useState('');
  const [error,      setError]      = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [clearing,   setClearing]   = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError(authError.message);
      setSubmitting(false);
      return;
    }

    router.push('/');
  };

  const handleClearSession = async () => {
    setClearing(true);
    await clearAuthStorage();
    window.location.replace('/login?reason=cleared');
  };

  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] backdrop-blur p-8"
      style={{ boxShadow: '0 0 0 1px rgba(34,211,238,0.04), 0 16px 48px rgba(0,0,0,0.18)' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 mb-8">
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
      </div>

      {/* Session-related banners */}
      {reason === 'timeout' && (
        <div className="mb-5 flex items-start gap-2.5 px-3 py-2.5 rounded-[8px] bg-amber-500/[0.08] border border-amber-500/30">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-amber-300 font-semibold">Session timed out</p>
            <p className="text-xs text-amber-400/70 mt-0.5">
              Your session took too long to load and was cleared. Please sign in again.
            </p>
          </div>
        </div>
      )}
      {reason === 'cleared' && (
        <div className="mb-5 px-3 py-2.5 rounded-[8px] bg-[#22D3EE]/[0.06] border border-[#22D3EE]/25">
          <p className="text-xs text-[#22D3EE]">Session cleared. Please sign in.</p>
        </div>
      )}

      <h1 className="text-[20px] font-extrabold tracking-tight text-[var(--text-primary)] mb-1">
        Sign in
      </h1>
      <p className="text-xs text-[var(--text-muted)] mb-6">
        Your trades, your rules. No sharing.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs uppercase tracking-[0.14em] font-semibold text-[var(--text-muted)]">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[8px] px-3 py-2.5 text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[#22D3EE] focus:ring-[3px] focus:ring-[#22D3EE]/15 transition"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs uppercase tracking-[0.14em] font-semibold text-[var(--text-muted)]">
              Password
            </label>
            <Link href="/forgot-password" className="text-xs text-[var(--text-faint)] hover:text-[var(--text-secondary)] transition-colors">
              Forgot password?
            </Link>
          </div>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            placeholder="••••••••"
            className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[8px] px-3 py-2.5 text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[#22D3EE] focus:ring-[3px] focus:ring-[#22D3EE]/15 transition"
          />
        </div>

        {error && (
          <div className="px-3 py-2.5 rounded-[8px] bg-[#FF3B5C]/[0.06] border border-[#FF3B5C]/30 text-xs text-[#FF3B5C]">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className={cn(
            'mt-1 w-full py-3 rounded-[10px] text-[13px] font-extrabold uppercase tracking-[0.05em] transition-all flex items-center justify-center gap-2',
            submitting
              ? 'bg-[var(--bg-elevated)] text-[var(--text-faint)] cursor-not-allowed'
              : 'bg-gradient-to-br from-[#22D3EE] to-[#10F088] text-black shadow-[0_0_20px_rgba(34,211,238,0.3)] hover:brightness-110',
          )}
        >
          {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="mt-5 text-center text-xs text-[var(--text-muted)]">
        No account?{' '}
        <Link href="/signup" className="text-[#22D3EE] hover:underline font-semibold">
          Sign up
        </Link>
      </p>

      {/* Legal disclaimer */}
      <div className="mt-6 pt-5 border-t border-[var(--border-subtle)]">
        <div className="flex items-start gap-2 text-[10px] text-[var(--text-faint)] leading-relaxed">
          <Info className="w-3 h-3 text-[var(--text-faint)] mt-0.5 shrink-0" />
          <span>
            Momentum Playbook does not provide investment advice.{' '}
            <Link href="/legal/disclaimer" className="underline hover:text-[var(--text-muted)] transition-colors">
              Disclaimer
            </Link>
            {' · '}
            <Link href="/legal/terms" className="underline hover:text-[var(--text-muted)] transition-colors">
              Terms of Use
            </Link>
            {' · '}
            <Link href="/legal/privacy" className="underline hover:text-[var(--text-muted)] transition-colors">
              Privacy
            </Link>
          </span>
        </div>
      </div>

      {/* Escape hatch for stuck/corrupted sessions */}
      <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
        <p className="text-xs text-[var(--text-faint)] text-center mb-2.5">Having trouble loading the app?</p>
        <button
          type="button"
          onClick={handleClearSession}
          disabled={clearing}
          className="w-full py-2 rounded-[8px] border border-[var(--border-subtle)] text-xs text-[var(--text-faint)] hover:text-[var(--text-muted)] hover:border-[var(--border-strong)] transition-colors flex items-center justify-center gap-1.5"
        >
          {clearing && <Loader2 className="w-3 h-3 animate-spin" />}
          {clearing ? 'Clearing…' : 'Clear session data'}
        </button>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
