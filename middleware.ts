// middleware.ts
//
// Runs on every request (except static files and API routes).
// Refreshes the Supabase session cookie and enforces auth redirects.

import { NextResponse, type NextRequest } from 'next/server';
import { createMiddlewareClient } from '@/lib/supabase-server';

const PUBLIC_PATHS = ['/login', '/signup'];

// Allow Playwright e2e tests to bypass auth. Set PLAYWRIGHT_AUTH_BYPASS=true
// on the test dev-server process only — never set in production.
const E2E_BYPASS = process.env.PLAYWRIGHT_AUTH_BYPASS === 'true';

export async function middleware(request: NextRequest) {
  if (E2E_BYPASS) return NextResponse.next({ request: { headers: request.headers } });
  const response = NextResponse.next({
    request: { headers: request.headers },
  });

  const path = request.nextUrl.pathname;
  let user = null;

  try {
    const supabase = createMiddlewareClient(request, response);

    // getSession() reads the JWT from the cookie — no network round-trip (~0ms).
    // getUser() was a ~779ms network call to Supabase Auth on every navigation.
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) console.error('[MIDDLEWARE-FAIL] getSession() error:', error.message);
    user = session?.user ?? null;
  } catch (err) {
    // Corrupted cookie or unexpected error — treat as unauthenticated rather
    // than crashing into a 500. The client-side auth context will handle cleanup.
    console.error('[MIDDLEWARE-FAIL] getSession() threw:', err);
  }

  // Unauthenticated + protected route → send to /login
  if (!user && !PUBLIC_PATHS.includes(path)) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Authenticated + auth page → send to dashboard
  if (user && PUBLIC_PATHS.includes(path)) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    // Skip Next.js internals, static assets, API routes, and common binary file extensions
    '/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|eot|otf|mp4|mp3|pdf)$).*)',
  ],
};
