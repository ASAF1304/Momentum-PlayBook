// app/api/grow/dev-activate/route.ts
//
// Dev-only endpoint: manually sets subscription to 'trialing' so the
// "Simulate Payment Success" button works without a real Grow API key.
// Blocked in production (when GROW_API_KEY is set).

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

export async function POST(_request: NextRequest) {
  if (process.env.GROW_API_KEY) {
    // Real Grow is configured — this endpoint must not be used
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const trial_ends_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  await admin.from('subscriptions').upsert(
    {
      user_id:       user.id,
      status:        'trialing',
      trial_ends_at,
      updated_at:    new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );

  return NextResponse.json({ ok: true });
}
