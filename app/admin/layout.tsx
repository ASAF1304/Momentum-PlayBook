// app/admin/layout.tsx
// Server-side guard: verifies is_admin from DB before rendering any /admin/* page.
// Returns 404 (not a redirect) so it doesn't reveal that admin routes exist.

import { notFound } from 'next/navigation';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { ReactNode } from 'react';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  // In e2e test mode the JWT is a fake token — server-side getUser() would reject it.
  // Skip the server guard and rely on the client-side is_admin check in the page.
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
