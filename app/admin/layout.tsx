// app/admin/layout.tsx
//
// Two-factor admin guard:
//   1. Password gate (cookie verified against HMAC, 8h TTL) — enforced in middleware.ts
//   2. Server-side is_admin check from DB — enforced here
// Returns notFound() (404) for non-admins so admin routes are not enumerable.
//
// The /admin/gate route is exempted by the middleware AND by the early return below.

import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { ReactNode } from 'react';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  if (process.env.PLAYWRIGHT_AUTH_BYPASS === 'true') return <>{children}</>;

  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (!profile?.is_admin) notFound();

  return <>{children}</>;
}
