// app/admin/gate/page.tsx
//
// Password gate shown when accessing /admin/* without a valid gate cookie.
// On success, sets the cookie (via /api/admin/gate) and redirects to /admin/users.

'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

function GateForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('next') || '/admin/users';

  const [password,   setPassword]   = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);

    const res = await fetch('/api/admin/gate', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ password }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || 'Incorrect password');
      setSubmitting(false);
      return;
    }

    router.replace(redirectTo);
    router.refresh();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--bg-primary)] text-[var(--text-primary)] font-[Manrope,ui-sans-serif,system-ui,sans-serif]">
      <div
        className="w-full max-w-[420px] rounded-[16px] border border-[var(--border-strong)] bg-[var(--bg-surface)] overflow-hidden"
        style={{ boxShadow: 'var(--shadow-modal)' }}
      >
        <div className="h-[3px] w-full bg-gradient-to-r from-[#FF3B5C] to-[#F59E0B]" />

        <form onSubmit={handleSubmit} className="p-7">
          <div className="flex items-start gap-4 mb-5">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 border"
              style={{ background: '#FF3B5C14', borderColor: '#FF3B5C40' }}
            >
              <ShieldAlert className="w-6 h-6 text-[#FF3B5C]" strokeWidth={2} />
            </div>
            <div className="flex-1">
              <div className="text-[10px] uppercase tracking-[0.2em] font-extrabold text-[#FF3B5C] mb-1">
                Restricted Area
              </div>
              <h2 className="text-[18px] font-extrabold tracking-tight text-[var(--text-primary)] leading-tight">
                Admin gate
              </h2>
              <p className="text-[12px] text-[var(--text-muted)] mt-1 leading-snug">
                Enter the admin password to continue. Session lasts 8 hours.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 mb-4">
            <label className="text-[10px] uppercase tracking-[0.16em] font-bold text-[var(--text-muted)]">
              Admin password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(null); }}
              autoFocus
              autoComplete="off"
              className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[10px] px-4 py-3 text-[15px] font-mono text-[var(--text-primary)] placeholder:text-[var(--text-faint)] focus:outline-none focus:border-[#22D3EE] focus:ring-[3px] focus:ring-[#22D3EE]/15 transition"
              placeholder="••••••••"
            />
            {error && (
              <p className="text-[11.5px] text-[#FF3B5C] mt-1">{error}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting || !password}
            className={cn(
              'w-full py-3 rounded-[10px] text-[12px] font-extrabold uppercase tracking-[0.05em] transition-all flex items-center justify-center gap-2',
              submitting || !password
                ? 'bg-[var(--bg-elevated)] text-[var(--text-faint)] cursor-not-allowed'
                : 'bg-gradient-to-br from-[#22D3EE] to-[#10F088] text-black shadow-[0_0_24px_rgba(34,211,238,0.3)] hover:brightness-110',
            )}
          >
            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {submitting ? 'Verifying…' : 'Unlock admin'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AdminGatePage() {
  return (
    <Suspense>
      <GateForm />
    </Suspense>
  );
}
