// app/onboarding/page.tsx
//
// Runs once after signup to collect display name + account/risk parameters.
// Creates the user_profiles row. If profile already exists, redirects immediately.

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, TrendingUp } from 'lucide-react';
import { supabase } from '@/lib/supabase-client';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';

export default function OnboardingPage() {
  const router = useRouter();
  const { user, profile, loading, refreshProfile } = useAuth();

  // Redirect if profile already exists
  useEffect(() => {
    if (!loading && profile) router.replace('/');
  }, [loading, profile, router]);

  const [displayName, setDisplayName] = useState('');
  const [accountSize, setAccountSize] = useState('');
  const [maxRisk,     setMaxRisk]     = useState('2.5');
  const [maxStop,     setMaxStop]     = useState('10');
  const [error,       setError]       = useState<string | null>(null);
  const [submitting,  setSubmitting]  = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !user) return;

    const size = parseFloat(accountSize);
    if (!Number.isFinite(size) || size <= 0) {
      setError('Enter a valid account size greater than 0.');
      return;
    }

    const risk = parseFloat(maxRisk);
    const stop = parseFloat(maxStop);
    if (!Number.isFinite(risk) || risk <= 0 || risk > 10) {
      setError('Max risk per trade must be between 0.1% and 10%.');
      return;
    }
    if (!Number.isFinite(stop) || stop <= 0 || stop > 25) {
      setError('Max stop distance must be between 0.5% and 25%.');
      return;
    }

    setError(null);
    setSubmitting(true);

    const { error: dbError } = await supabase.from('user_profiles').insert({
      id: user.id,
      display_name: displayName.trim() || null,
      account_size: size,
      max_risk_per_trade_pct: risk,
      max_stop_distance_pct: stop,
    });

    if (dbError) {
      setError(dbError.message);
      setSubmitting(false);
      return;
    }

    await refreshProfile();
    router.push('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#22D3EE]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-4 font-[Manrope,ui-sans-serif,system-ui,sans-serif]">
      <GridOverlay />
      <div className="relative z-10 w-full max-w-[440px]">
        <div className="rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-surface)] backdrop-blur p-8">

          {/* Logo + welcome */}
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#22D3EE] to-[#10F088] flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-black" strokeWidth={3.5} />
            </div>
            <span className="text-[15px] font-extrabold tracking-tight text-[var(--text-primary)]">
              Momentum Playbook
            </span>
          </div>

          <h1 className="text-[20px] font-extrabold tracking-tight text-[var(--text-primary)] mb-1 mt-6">
            Set up your account
          </h1>
          <p className="text-[12px] text-[var(--text-muted)] mb-6 leading-relaxed">
            These parameters drive the position sizer and risk engine. You can change them later in Settings.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">

            {/* Display name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase tracking-[0.14em] font-semibold text-[var(--text-secondary)]">
                Display Name <span className="text-[var(--text-faint)] normal-case tracking-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Asaf"
                className="bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-[8px] px-3 py-2.5 text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[#22D3EE] focus:ring-[3px] focus:ring-[#22D3EE]/15 transition"
              />
            </div>

            {/* Account size */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase tracking-[0.14em] font-semibold text-[#22D3EE]">
                Account Size ($) <span className="text-[#FF3B5C]">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] font-mono text-[14px]">$</span>
                <input
                  type="number"
                  value={accountSize}
                  onChange={e => setAccountSize(e.target.value)}
                  required
                  min="100"
                  step="100"
                  placeholder="25000"
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-[8px] pl-7 pr-3 py-2.5 font-mono text-[15px] font-semibold text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[#22D3EE] focus:ring-[3px] focus:ring-[#22D3EE]/15 transition"
                />
              </div>
            </div>

            {/* Risk params side by side */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase tracking-[0.14em] font-semibold text-[var(--text-secondary)]">
                  Max Risk / Trade
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={maxRisk}
                    onChange={e => setMaxRisk(e.target.value)}
                    min="0.1"
                    max="10"
                    step="0.1"
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-[8px] px-3 pr-7 py-2.5 font-mono text-[14px] text-[var(--text-primary)] focus:outline-none focus:border-[#22D3EE] focus:ring-[3px] focus:ring-[#22D3EE]/15 transition"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] font-mono text-[13px]">%</span>
                </div>
                <span className="text-[9px] text-[var(--text-faint)]">Minervini default: 2.5%</span>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase tracking-[0.14em] font-semibold text-[var(--text-secondary)]">
                  Max Stop Distance
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={maxStop}
                    onChange={e => setMaxStop(e.target.value)}
                    min="0.5"
                    max="25"
                    step="0.5"
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-[8px] px-3 pr-7 py-2.5 font-mono text-[14px] text-[var(--text-primary)] focus:outline-none focus:border-[#22D3EE] focus:ring-[3px] focus:ring-[#22D3EE]/15 transition"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] font-mono text-[13px]">%</span>
                </div>
                <span className="text-[9px] text-[var(--text-faint)]">O'Neil hard cap: 10%</span>
              </div>
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
                  ? 'bg-[var(--bg-elevated)] text-[var(--text-faint)] cursor-not-allowed'
                  : 'bg-gradient-to-br from-[#22D3EE] to-[#10F088] text-black shadow-[0_0_20px_rgba(34,211,238,0.3)] hover:brightness-110',
              )}
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {submitting ? 'Saving…' : 'Start trading →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function GridOverlay() {
  return (
    <div
      className="fixed inset-0 pointer-events-none z-0 opacity-[0.18]"
      style={{
        backgroundImage:
          'linear-gradient(rgba(34,211,238,0.06) 1px, transparent 1px), ' +
          'linear-gradient(90deg, rgba(34,211,238,0.06) 1px, transparent 1px)',
        backgroundSize: '48px 48px',
        maskImage: 'radial-gradient(ellipse at top, black 30%, transparent 80%)',
        WebkitMaskImage: 'radial-gradient(ellipse at top, black 30%, transparent 80%)',
      }}
    />
  );
}
