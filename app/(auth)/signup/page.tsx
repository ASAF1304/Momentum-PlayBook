// app/(auth)/signup/page.tsx

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, TrendingUp } from 'lucide-react';
import { supabase } from '@/lib/supabase-client';
import { cn } from '@/lib/utils';

interface FieldErrors {
  email?: string;
  password?: string;
  confirm?: string;
  terms?: string;
}

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

export default function SignupPage() {
  const router = useRouter();
  const [email,         setEmail]         = useState('');
  const [password,      setPassword]      = useState('');
  const [confirm,       setConfirm]       = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [fieldErrors,   setFieldErrors]   = useState<FieldErrors>({});
  const [serverError,   setServerError]   = useState<string | null>(null);
  const [message,       setMessage]       = useState<string | null>(null);
  const [submitting,    setSubmitting]    = useState(false);

  const validate = (): FieldErrors => {
    const errs: FieldErrors = {};
    if (!isValidEmail(email)) errs.email = 'Please enter a valid email address.';
    if (password.length < 6)  errs.password = 'Password must be at least 6 characters.';
    if (confirm !== password)  errs.confirm = 'Passwords do not match.';
    if (!termsAccepted)        errs.terms = 'Please accept the terms and conditions.';
    return errs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    setFieldErrors({});
    setServerError(null);
    setSubmitting(true);

    const { data, error: authError } = await supabase.auth.signUp({ email: email.trim(), password });

    if (authError) {
      setServerError(authError.message);
      setSubmitting(false);
      return;
    }

    if (data.session) {
      router.push('/onboarding');
    } else {
      setMessage('Check your inbox to confirm your email, then sign in.');
      setSubmitting(false);
    }
  };

  const inputClass = (hasError: boolean) => cn(
    'bg-[var(--bg-elevated)] border rounded-[8px] px-3 py-2.5 text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:ring-[3px] transition w-full',
    hasError
      ? 'border-[#FF3B5C] focus:border-[#FF3B5C] focus:ring-[#FF3B5C]/15'
      : 'border-[var(--border-subtle)] focus:border-[#22D3EE] focus:ring-[#22D3EE]/15',
  );

  return (
    <div
      className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] backdrop-blur p-8"
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

      <h1 className="text-[20px] font-extrabold tracking-tight text-[var(--text-primary)] mb-1">
        Create account
      </h1>
      <p className="text-xs text-[var(--text-muted)] mb-6">
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
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3.5">
          {/* Email */}
          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-[0.14em] font-semibold text-[var(--text-muted)]">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setFieldErrors(p => ({ ...p, email: undefined })); }}
              autoComplete="email"
              placeholder="you@example.com"
              className={inputClass(!!fieldErrors.email)}
            />
            {fieldErrors.email && (
              <p className="text-[11px] text-[#FF3B5C] mt-0.5">{fieldErrors.email}</p>
            )}
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-[0.14em] font-semibold text-[var(--text-muted)]">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setFieldErrors(p => ({ ...p, password: undefined })); }}
              autoComplete="new-password"
              placeholder="6+ characters"
              className={inputClass(!!fieldErrors.password)}
            />
            {fieldErrors.password && (
              <p className="text-[11px] text-[#FF3B5C] mt-0.5">{fieldErrors.password}</p>
            )}
          </div>

          {/* Confirm Password */}
          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-[0.14em] font-semibold text-[var(--text-muted)]">
              Confirm Password
            </label>
            <input
              type="password"
              value={confirm}
              onChange={e => { setConfirm(e.target.value); setFieldErrors(p => ({ ...p, confirm: undefined })); }}
              autoComplete="new-password"
              placeholder="••••••••"
              className={inputClass(!!fieldErrors.confirm)}
            />
            {fieldErrors.confirm && (
              <p className="text-[11px] text-[#FF3B5C] mt-0.5">{fieldErrors.confirm}</p>
            )}
          </div>

          {/* Terms */}
          <div className="flex flex-col gap-1">
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={e => { setTermsAccepted(e.target.checked); setFieldErrors(p => ({ ...p, terms: undefined })); }}
                className="mt-0.5 w-4 h-4 rounded border border-[var(--border-strong)] bg-[var(--bg-elevated)] accent-[#22D3EE] cursor-pointer shrink-0"
              />
              <span className="text-xs text-[var(--text-muted)] leading-relaxed">
                I have read and agree to the{' '}
                <Link href="/legal/terms" target="_blank" className="text-[#22D3EE] hover:underline">Terms of Use</Link>
                {' '}and{' '}
                <Link href="/legal/privacy" target="_blank" className="text-[#22D3EE] hover:underline">Privacy Policy</Link>
                {' '}of Momentum Playbook.
              </span>
            </label>
            {fieldErrors.terms && (
              <p className="text-[11px] text-[#FF3B5C] mt-0.5 pl-6">{fieldErrors.terms}</p>
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
                ? 'bg-[var(--bg-elevated)] text-[var(--text-faint)] cursor-not-allowed'
                : 'bg-gradient-to-br from-[#22D3EE] to-[#10F088] text-black shadow-[0_0_20px_rgba(34,211,238,0.3)] hover:brightness-110',
            )}
          >
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {submitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>
      )}

      {!message && (
        <p className="mt-5 text-center text-xs text-[var(--text-muted)]">
          Have an account?{' '}
          <Link href="/login" className="text-[#22D3EE] hover:underline font-semibold">
            Sign in
          </Link>
        </p>
      )}
    </div>
  );
}
