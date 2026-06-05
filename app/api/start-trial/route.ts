// app/api/start-trial/route.ts
//
// Called once after onboarding completes.
// Creates a 14-day grace-period subscription row (no CC required).
// Uses service-role key to bypass RLS.
//
// After migration 006 adds UNIQUE (user_id) to subscriptions, the
// upsert with ignoreDuplicates:true becomes truly atomic — no race condition.

import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const ALLOWED_ORIGINS = [
  'https://momentum-playbook.vercel.app',
  'http://localhost:3000',
];

export async function POST(req: NextRequest) {
  // CSRF guard — reject cross-origin POSTs
  const origin = req.headers.get('origin');
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

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

  const trial_ends_at = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  // Atomic upsert — ON CONFLICT (user_id) DO NOTHING.
  // Requires migration 006 UNIQUE (user_id) constraint to be applied first.
  const { error } = await admin
    .from('subscriptions')
    .upsert(
      {
        user_id:       user.id,
        status:        'grace',
        trial_ends_at,
        updated_at:    new Date().toISOString(),
      },
      { onConflict: 'user_id', ignoreDuplicates: true },
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
