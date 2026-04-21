// middleware.ts
//
// Runs on every request (except static files and API routes).
// Refreshes the Supabase session cookie and enforces auth redirects.

import { NextResponse, type NextRequest } from 'next/server';
import { createMiddlewareClient } from '@/lib/supabase-server';

const PUBLIC_PATHS = ['/login', '/signup'];

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createMiddlewareClient(request, response);

  // getUser() refreshes the session cookie on every request — required.
  // DIAGNOSTIC: timer appears in Vercel/server edge logs, not browser console.
  const _t0 = Date.now();
  const { data: { user } } = await supabase.auth.getUser();
  console.log(`[MIDDLEWARE] getUser() ${Date.now() - _t0}ms — path: ${request.nextUrl.pathname}`);

  const path = request.nextUrl.pathname;

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
