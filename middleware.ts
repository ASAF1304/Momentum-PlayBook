// middleware.ts
//
// Runs on every request (except static files and API routes).
// Refreshes the Supabase session cookie and enforces auth + subscription redirects.

import { NextResponse, type NextRequest } from 'next/server';
import { createMiddlewareClient } from '@/lib/supabase-server';

// Unauthenticated access is allowed on these paths.
const PUBLIC_PATHS = [
  '/login',
  '/signup',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/legal/disclaimer',
  '/legal/terms',
  '/legal/privacy',
  '/legal/refund',
  '/pricing',
  '/blocked',
];

// Authenticated but subscription-exempt paths (won't redirect to /onboarding/checkout)
const SUBSCRIPTION_EXEMPT = [
  '/onboarding',
  '/onboarding/checkout',
  '/billing',
  '/legal/disclaimer',
  '/legal/terms',
  '/legal/privacy',
];

// Allow Playwright e2e tests to bypass auth. Set PLAYWRIGHT_AUTH_BYPASS=true
// on the test dev-server process only — never set in production.
const E2E_BYPASS = process.env.PLAYWRIGHT_AUTH_BYPASS === 'true';

// Subscription guard only activates when Paddle is configured.
const PADDLE_ENABLED = !!process.env.NEXT_PUBLIC_PADDLE_PRICE_ID;

export async function middleware(request: NextRequest) {
  if (E2E_BYPASS) return NextResponse.next({ request: { headers: request.headers } });

  const response = NextResponse.next({ request: { headers: request.headers } });
  const path = request.nextUrl.pathname;

  // Public paths — skip any auth or subscription checks
  if (PUBLIC_PATHS.some(p => path === p || path.startsWith(p + '/'))) {
    return response;
  }

  let user = null;

  try {
    const supabase = createMiddlewareClient(request, response);
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) console.error('[MIDDLEWARE-FAIL] getSession() error:', error.message);
    user = session?.user ?? null;
  } catch (err) {
    console.error('[MIDDLEWARE-FAIL] getSession() threw:', err);
  }

  // Unauthenticated + protected route → send to /login
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Authenticated + auth page → send to dashboard
  if (user && PUBLIC_PATHS.includes(path)) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Subscription guard — only when Paddle is configured and path is not exempt
  if (PADDLE_ENABLED && !SUBSCRIPTION_EXEMPT.some(p => path === p || path.startsWith(p + '/'))) {
    try {
      const supabase = createMiddlewareClient(request, response);
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('status')
        .eq('user_id', user.id)
        .maybeSingle();

      const status = (sub as { status: string } | null)?.status;

      // Blocked users → /blocked immediately (don't expose billing)
      if (status === 'blocked') {
        return NextResponse.redirect(new URL('/blocked', request.url));
      }

      // grace + comp = free access; trialing + active + past_due + paused = paying
      const ACTIVE_STATUSES = ['trialing', 'active', 'past_due', 'paused', 'grace', 'comp'];
      const BILLING_REDIRECT_STATUSES = ['expired_grace', 'cancelled'];

      if (!ACTIVE_STATUSES.includes(status ?? '')) {
        const dest = BILLING_REDIRECT_STATUSES.includes(status ?? '') ? '/billing' : '/onboarding/checkout';
        return NextResponse.redirect(new URL(dest, request.url));
      }
    } catch (err) {
      // DB error — allow through rather than locking users out
      console.error('[MIDDLEWARE-FAIL] subscription check threw:', err);
    }
  }

  return response;
}

export const config = {
  matcher: [
    // Skip Next.js internals, static assets, API routes, and common binary file extensions
    '/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|eot|otf|mp4|mp3|pdf)$).*)',
  ],
};
