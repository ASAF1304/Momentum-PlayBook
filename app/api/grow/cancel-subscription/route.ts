// app/api/grow/cancel-subscription/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { getGrowClient } from '@/lib/grow/client';

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
  if (!client) return NextResponse.json({ error: 'Payment provider not configured' }, { status: 503 });

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('grow_subscription_id')
    .eq('user_id', user.id)
    .maybeSingle();

  const growSubId = (sub as { grow_subscription_id?: string | null } | null)?.grow_subscription_id;
  if (!growSubId) return NextResponse.json({ error: 'No active subscription found' }, { status: 404 });

  try {
    await client.cancelSubscription(growSubId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[GROW] cancelSubscription failed:', err);
    return NextResponse.json({ error: 'Failed to cancel subscription' }, { status: 502 });
  }
}
