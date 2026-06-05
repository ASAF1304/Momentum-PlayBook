// app/api/grow/list-transactions/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { getGrowClient } from '@/lib/grow/client';

export async function GET(_request: NextRequest) {
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
  if (!growSubId) return NextResponse.json({ transactions: [] });

  try {
    const transactions = await client.listTransactions(growSubId);
    return NextResponse.json({ transactions });
  } catch (err) {
    console.error('[GROW] listTransactions failed:', err);
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 502 });
  }
}
