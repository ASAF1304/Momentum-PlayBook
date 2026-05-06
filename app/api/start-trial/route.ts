// app/api/start-trial/route.ts
//
// Called once after onboarding completes.
// Creates a 14-day grace-period subscription row (no CC required).
// Uses the service-role key to bypass RLS.

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function POST() {
  const cookieStore = await cookies();
  const userClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  );

  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Idempotent — do nothing if subscription already exists
  const { data: existing } = await admin
    .from('subscriptions')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) return NextResponse.json({ ok: true, existing: true });

  const trial_ends_at = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await admin.from('subscriptions').insert({
    user_id:            user.id,
    paddle_customer_id: '',
    status:             'grace',
    trial_ends_at,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
