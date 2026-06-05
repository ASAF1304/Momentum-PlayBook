// app/api/grow/create-checkout-session/route.ts
//
// Creates a Grow (Meshulam) checkout session for the authenticated user.
// If GROW_API_KEY is not set, returns a dev-mode mock so the app still works.

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { getGrowClient } from '@/lib/grow/client';

const PLAN_ID = process.env.GROW_PLAN_ID ?? 'momentum-monthly';

export async function POST(_request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const client = getGrowClient();

  // Dev mode: GROW_API_KEY not configured
  if (!client) {
    return NextResponse.json({
      iframeUrl: '/dev/mock-checkout',
      sessionId: 'dev-session',
      dev:       true,
    });
  }

  try {
    const session = await client.createCheckoutSession(user.id, PLAN_ID, user.email ?? '');
    return NextResponse.json(session);
  } catch (err) {
    console.error('[GROW] createCheckoutSession failed:', err);
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 502 });
  }
}
