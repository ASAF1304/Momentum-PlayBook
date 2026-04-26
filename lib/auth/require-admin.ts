// lib/auth/require-admin.ts
//
// Server-side admin guard for API route handlers.
// Uses the anon key + session cookie to verify the caller is an admin.
// The actual DB mutations use the service role key (bypasses RLS).

import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

async function getAdminClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    },
  );
}

/** Returns null if the caller is an admin; returns a 403 Response otherwise. */
export async function guardAdmin(): Promise<NextResponse | null> {
  try {
    const supabase = await getAdminClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return null;
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
}
