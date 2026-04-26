// app/onboarding/checkout/page.tsx
//
// Step 2 of signup: opens the Paddle checkout overlay.
// User arrives here after creating their account and completing the profile form.
// Paddle collects card details and starts the 30-day free trial.
// On checkout success Paddle redirects to /dashboard (/).

'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, TrendingUp, CreditCard, ShieldCheck } from 'lucide-react';
import { initializePaddle, type Paddle } from '@paddle/paddle-js';
import { useAuth } from '@/lib/auth-context';

export default function CheckoutPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const paddleRef = useRef<Paddle | null>(null);
  const [paddleReady, setPaddleReady] = useState(false);
  const [opened, setOpened] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }

    const clientToken = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
    if (!clientToken) {
      // Paddle not configured — skip straight to dashboard (dev / test mode)
      router.replace('/');
      return;
    }

    const env = process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT === 'sandbox' ? 'sandbox' : 'production';
    initializePaddle({ environment: env, token: clientToken })
      .then(instance => {
        paddleRef.current = instance ?? null;
        setPaddleReady(true);
        setStatus('idle');
      })
      .catch(err => {
        console.error('[CHECKOUT] Paddle init failed:', err);
        setStatus('error');
        setErrorMsg('Failed to load payment provider. Please refresh.');
      });
  }, [user, loading, router]);

  useEffect(() => {
    if (!paddleReady || opened || !user) return;
    const priceId = process.env.NEXT_PUBLIC_PADDLE_PRICE_ID;
    if (!priceId) return;

    setOpened(true);
    paddleRef.current?.Checkout.open({
      items: [{ priceId, quantity: 1 }],
      customer: { email: user.email ?? '' },
      customData: { user_id: user.id },
      settings: {
        successUrl: `${window.location.origin}/`,
        allowLogout: false,
      },
    });
  }, [paddleReady, opened, user]);

  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#22D3EE]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-4 font-[Manrope,ui-sans-serif,system-ui,sans-serif]">
      <div className="w-full max-w-[440px] space-y-6">

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
            <div className="px-4 py-3 rounded-[10px] bg-[#FF3B5C]/[0.06] border border-[#FF3B5C]/30 text-sm text-[#FF3B5C]">
              {errorMsg}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm text-[var(--text-secondary)]">
                <CreditCard className="w-4 h-4 text-[#22D3EE] shrink-0" />
                <span>נדרש כרטיס אשראי — לא יחויב במהלך תקופת הניסיון</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-[var(--text-secondary)]">
                <ShieldCheck className="w-4 h-4 text-[#10F088] shrink-0" />
                <span>תשלום מאובטח דרך Paddle — לא מאחסנים פרטי כרטיס</span>
              </div>
              <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
                <p className="text-xs text-[var(--text-faint)] leading-relaxed">
                  חלון התשלום אמור להיפתח אוטומטית. אם לא, לחץ על הכפתור למטה.
                </p>
                <button
                  onClick={() => {
                    setOpened(false);
                  }}
                  className="mt-3 w-full py-3 rounded-[10px] text-[13px] font-extrabold uppercase tracking-[0.05em] bg-gradient-to-br from-[#22D3EE] to-[#10F088] text-black shadow-[0_0_20px_rgba(34,211,238,0.3)] hover:brightness-110 transition-all"
                >
                  פתח חלון תשלום
                </button>
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
