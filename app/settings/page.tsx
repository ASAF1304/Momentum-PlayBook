// app/settings/page.tsx
//
// Edit account parameters. Pre-fills from user_profiles row.

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { AppNav } from '@/components/nav/app-nav';
import { GridOverlay } from '@/components/ui/grid-overlay';
import { supabase } from '@/lib/supabase-client';
import { useAuth } from '@/lib/auth-context';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';

export default function SettingsPage() {
  const router = useRouter();
  const { user, profile, loading, refreshProfile } = useAuth();

  const [displayName, setDisplayName] = useState('');
  const [accountSize, setAccountSize] = useState('');
  const [maxRisk,     setMaxRisk]     = useState('');
  const [maxStop,     setMaxStop]     = useState('');
  const [saving,      setSaving]      = useState(false);
  const [errors, setErrors] = useState({ accountSize: '', maxRisk: '', maxStop: '' });

  // Pre-fill form once profile loads
  useEffect(() => {
    if (!loading && !profile && user) {
      // No profile yet — redirect to onboarding
      router.replace('/onboarding');
      return;
    }
    if (profile) {
      setDisplayName(profile.display_name ?? '');
      setAccountSize(String(profile.account_size));
      setMaxRisk(String(profile.max_risk_per_trade_pct));
      setMaxStop(String(profile.max_stop_distance_pct));
    }
  }, [profile, loading, user, router]);

  const validateAccountSize = () => {
    const v = parseFloat(accountSize);
    const msg = !Number.isFinite(v) || v <= 0 ? 'Enter a positive dollar amount' : '';
    setErrors(prev => ({ ...prev, accountSize: msg }));
    return !msg;
  };

  const validateMaxRisk = () => {
    const v = parseFloat(maxRisk);
    const msg = !Number.isFinite(v) || v <= 0 || v > 10 ? 'Must be between 0.1% and 10%' : '';
    setErrors(prev => ({ ...prev, maxRisk: msg }));
    return !msg;
  };

  const validateMaxStop = () => {
    const v = parseFloat(maxStop);
    const msg = !Number.isFinite(v) || v <= 0 || v > 25 ? 'Must be between 0.5% and 25%' : '';
    setErrors(prev => ({ ...prev, maxStop: msg }));
    return !msg;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || !user) return;
    const okSize = validateAccountSize();
    const okRisk = validateMaxRisk();
    const okStop = validateMaxStop();
    if (!okSize || !okRisk || !okStop) return;

    const size = parseFloat(accountSize);
    const risk = parseFloat(maxRisk);
    const stop = parseFloat(maxStop);

    setSaving(true);

    const { error } = await supabase
      .from('user_profiles')
      .update({
        display_name: displayName.trim() || null,
        account_size: size,
        max_risk_per_trade_pct: risk,
        max_stop_distance_pct: stop,
      })
      .eq('id', user.id);

    if (error) {
      toast({ title: 'Save failed', body: error.message, variant: 'error' });
    } else {
      await refreshProfile();
      toast({ title: 'Settings saved', variant: 'success' });
    }

    setSaving(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#22D3EE]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] font-[Manrope,ui-sans-serif,system-ui,sans-serif]">
      <GridOverlay />
      <AppNav />

      <main className="max-w-[520px] mx-auto px-6 py-10 relative">
        <div className="mb-6">
          <h1 className="text-[20px] font-extrabold tracking-tight mb-1">Settings</h1>
          <p className="text-xs text-[var(--text-muted)]">
            Account size and risk parameters used by the position sizer.
          </p>
        </div>

        <form onSubmit={handleSave} className="flex flex-col gap-4">

          <div className="p-5 rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] flex flex-col gap-4">
            <div className="text-xs uppercase tracking-[0.18em] font-bold text-[var(--text-muted)]">
              Profile
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs uppercase tracking-[0.14em] font-semibold text-[var(--text-secondary)]">
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Your name"
                className="bg-[var(--bg-input)] border border-[var(--border-subtle)] rounded-[8px] px-3 py-2.5 text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-placeholder)] focus:outline-none focus:border-[#22D3EE] focus:ring-[3px] focus:ring-[#22D3EE]/15 transition"
              />
            </div>
          </div>

          <div className="p-5 rounded-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] flex flex-col gap-4">
            <div className="text-xs uppercase tracking-[0.18em] font-bold text-[var(--text-muted)]">
              Risk Engine
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs uppercase tracking-[0.14em] font-semibold text-[#22D3EE]">
                Account Size ($)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] font-mono text-[14px]">$</span>
                <input
                  type="number"
                  value={accountSize}
                  onChange={e => { setAccountSize(e.target.value); if (errors.accountSize) setErrors(p => ({ ...p, accountSize: '' })); }}
                  onBlur={validateAccountSize}
                  min="100"
                  max="50000000"
                  step="100"
                  className={cn(
                    'w-full bg-[var(--bg-input)] border rounded-[8px] pl-7 pr-3 py-2.5 font-mono text-[15px] font-semibold text-[var(--text-primary)] focus:outline-none focus:ring-[3px] transition',
                    errors.accountSize
                      ? 'border-[#FF3B5C] focus:border-[#FF3B5C] focus:ring-[#FF3B5C]/15'
                      : 'border-[var(--border-subtle)] focus:border-[#22D3EE] focus:ring-[#22D3EE]/15',
                  )}
                />
              </div>
              {errors.accountSize && <p className="text-[11px] text-[#FF3B5C] mt-0.5">{errors.accountSize}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs uppercase tracking-[0.14em] font-semibold text-[var(--text-secondary)]">
                  Max Risk / Trade
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={maxRisk}
                    onChange={e => { setMaxRisk(e.target.value); if (errors.maxRisk) setErrors(p => ({ ...p, maxRisk: '' })); }}
                    onBlur={validateMaxRisk}
                    min="0.1"
                    max="10"
                    step="0.1"
                    className={cn(
                      'w-full bg-[var(--bg-input)] border rounded-[8px] px-3 pr-7 py-2.5 font-mono text-[14px] text-[var(--text-primary)] focus:outline-none focus:ring-[3px] transition',
                      errors.maxRisk
                        ? 'border-[#FF3B5C] focus:border-[#FF3B5C] focus:ring-[#FF3B5C]/15'
                        : 'border-[var(--border-subtle)] focus:border-[#22D3EE] focus:ring-[#22D3EE]/15',
                    )}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] font-mono text-xs">%</span>
                </div>
                {errors.maxRisk && <p className="text-[11px] text-[#FF3B5C] mt-0.5">{errors.maxRisk}</p>}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs uppercase tracking-[0.14em] font-semibold text-[var(--text-secondary)]">
                  Max Stop Distance
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={maxStop}
                    onChange={e => { setMaxStop(e.target.value); if (errors.maxStop) setErrors(p => ({ ...p, maxStop: '' })); }}
                    onBlur={validateMaxStop}
                    min="0.5"
                    max="25"
                    step="0.5"
                    className={cn(
                      'w-full bg-[var(--bg-input)] border rounded-[8px] px-3 pr-7 py-2.5 font-mono text-[14px] text-[var(--text-primary)] focus:outline-none focus:ring-[3px] transition',
                      errors.maxStop
                        ? 'border-[#FF3B5C] focus:border-[#FF3B5C] focus:ring-[#FF3B5C]/15'
                        : 'border-[var(--border-subtle)] focus:border-[#22D3EE] focus:ring-[#22D3EE]/15',
                    )}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] font-mono text-xs">%</span>
                </div>
                {errors.maxStop && <p className="text-[11px] text-[#FF3B5C] mt-0.5">{errors.maxStop}</p>}
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className={cn(
              'w-full py-3 rounded-[10px] text-[13px] font-extrabold uppercase tracking-[0.05em] transition-all flex items-center justify-center gap-2',
              saving
                ? 'bg-[var(--bg-elevated)] text-[var(--text-faint)] cursor-not-allowed'
                : 'bg-gradient-to-br from-[#22D3EE] to-[#10F088] text-black shadow-[0_0_20px_rgba(34,211,238,0.3)] hover:brightness-110',
            )}
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      </main>
    </div>
  );
}
