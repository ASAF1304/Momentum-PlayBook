// app/api/journal/reset/route.ts
//
// POST /api/journal/reset
//
// Deletes ALL trades for the authenticated user. Called by the broker import
// modal when the user explicitly chooses "Delete all & re-import from scratch"
// AND types the exact confirmation string "DELETE MY TRADES".
//
// Server-side auth check prevents CSRF or accidental bulk deletion.

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { getServiceClient } from '@/lib/supabase-service';

export async function POST() {
  const cookieStore = await cookies();

  const userClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  );

  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = getServiceClient() as unknown as ReturnType<typeof import('@supabase/supabase-js').createClient<any>>;

  const { error } = await db.from('trades').delete().eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
