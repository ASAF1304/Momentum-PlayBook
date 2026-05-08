// lib/supabase-server.ts
//
// Creates a Supabase server client configured for Next.js middleware.
// Follows the canonical @supabase/ssr pattern: cookies are set on both
// request (for Server Components) and response (persisted to browser).
// Only import this file in middleware.ts — never in client components.

import { createServerClient } from '@supabase/ssr';
import type { NextRequest, NextResponse } from 'next/server';

export function createMiddlewareClient(request: NextRequest, response: NextResponse) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          // Update request cookies for downstream Server Components
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          // Persist to browser via response
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );
}
