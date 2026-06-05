// app/onboarding/checkout/page.tsx
//
// Step 2 of signup: opens the Grow (Meshulam) checkout iframe.
// User arrives here after creating their account and completing the profile form.
// Grow collects card details and starts the free trial.
// On checkout success we redirect to / (dashboard).

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, TrendingUp, CreditCard, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export default function CheckoutPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);
  const [devMode,   setDevMode]   = useState(false);
  const [status, setStatus]   = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMsg,  setErrorMsg]  = useState('');

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace('/login'); return; }

    fetch('/api/grow/create-checkout-session', { method: 'POST' })
      .then(async res => {
        const json = await res.json() as { iframeUrl?: string; sessionId?: string; dev?: boolean; error?: string };
        if (!res.ok || json.error) throw new Error(json.error ?? 'Failed to create session');
        if (json.dev) { setDevMode(true); setStatus('ready'); return; }
        setIframeUrl(json.iframeUrl ?? null);
        setStatus('ready');
      })
      .catch(err => {
        console.error('[CHECKOUT] session fetch failed:', err);
        setErrorMsg((err as Error).message || 'Failed to load payment provider. Please refresh.');
        setStatus('error');
      });
  }, [user, loading, router]);

  // Dev-mode: simulate payment success
  async function simulateSuccess() {
    setStatus('loading');
    await fetch('/api/grow/dev-activate', { method: 'POST' }).catch(() => null);
    router.replace('/');
  }

  // Listen for postMessage from Grow iframe
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (typeof e.data !== 'object' || !e.data) return;
      const { type } = e.data as { type?: string };
      if (type === 'grow:success' || type === 'payment:success') router.replace('/');
      if (type === 'grow:failure' || type === 'payment:failure') {
        setErrorMsg('Payment failed. Please try again or contact support.');
        setStatus('error');
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [router]);

  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#22D3EE]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-4 font-[Manrope,ui-sans-serif,system-ui,sans-serif]">
      <div className="w-full max-w-[520px] space-y-6">

        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#22D3EE] to-[#10F088] flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-black" strokeWidth={3.5} />
          </div>
          <span className="text-[15px] font-extrabold tracking-tight text-[var(--text-primary)]">
            Momentum Playbook
          </span>
        </div>

        <div className="rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-surface)] backdrop-blur p-8">
          <h1 className="text-[20px] font-extrabold tracking-tight text-[var(--text-primary)] mb-2">
            30 ימים חינם, ללא מחויבות
          </h1>
          <p className="text-sm text-[var(--text-muted)] mb-6 leading-relaxed">
            לאחר תקופת הניסיון: 50 ₪ / חודש. ניתן לבטל בכל עת.
          </p>

          {status === 'error' ? (
            <div className="space-y-4">
              <div className="px-4 py-3 rounded-[10px] bg-[#FF3B5C]/[0.06] border border-[#FF3B5C]/30 text-sm text-[#FF3B5C]">
                {errorMsg}
              </div>
              <button
                onClick={() => { setErrorMsg(''); setStatus('loading'); router.refresh(); }}
                className="w-full py-3 rounded-[10px] text-[13px] font-extrabold uppercase tracking-[0.05em] border border-[var(--border-strong)] text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-all"
              >
                נסה שוב
              </button>
            </div>
          ) : devMode ? (
            <div className="space-y-4">
              <div className="px-4 py-3 rounded-[10px] bg-[#FF9F0A]/[0.08] border border-[#FF9F0A]/30 text-sm text-[#FF9F0A]">
                ⚠️ Dev mode — GROW_API_KEY not configured. Simulate payment below.
              </div>
              <button
                onClick={() => void simulateSuccess()}
                className="w-full py-3 rounded-[10px] text-[13px] font-extrabold uppercase tracking-[0.05em] bg-gradient-to-br from-[#22D3EE] to-[#10F088] text-black shadow-[0_0_20px_rgba(34,211,238,0.3)] hover:brightness-110 transition-all"
              >
                Simulate Payment Success
              </button>
            </div>
          ) : iframeUrl ? (
            <iframe
              src={iframeUrl}
              className="w-full h-[560px] border-0 rounded-xl"
              title="Checkout"
            />
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm text-[var(--text-secondary)]">
                <CreditCard className="w-4 h-4 text-[#22D3EE] shrink-0" />
                <span>נדרש כרטיס אשראי — לא יחויב במהלך תקופת הניסיון</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-[var(--text-secondary)]">
                <ShieldCheck className="w-4 h-4 text-[#10F088] shrink-0" />
                <span>תשלום מאובטח — לא מאחסנים פרטי כרטיס</span>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-[var(--text-faint)]">
          כבר יש לך מנוי?{' '}
          <button onClick={() => router.push('/')} className="text-[#22D3EE] hover:underline">
            כניסה לאפליקציה
          </button>
        </p>
      </div>
    </div>
  );
}
