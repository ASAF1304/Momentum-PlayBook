// app/api/admin/users/[userId]/extend/route.ts
// POST /api/admin/users/[userId]/extend  Body: { days: number }
// Adds N days to trial_ends_at (or from now() if expired/null).

import { NextRequest, NextResponse } from 'next/server';
import { guardAdmin } from '@/lib/auth/require-admin';
import { getServiceClient } from '@/lib/supabase-service';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = ReturnType<typeof import('@supabase/supabase-js').createClient<any>>;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const denied = await guardAdmin();
  if (denied) return denied;

  const { userId } = await params;
  const body = await request.json().catch(() => ({})) as { days?: number };
  const days = Number(body.days);

  if (!Number.isFinite(days) || days < 1 || days > 3650) {
    return NextResponse.json({ error: 'days must be 1–3650' }, { status: 400 });
  }

  const db = getServiceClient() as unknown as AnyDb;

  const { data: sub } = await db
    .from('subscriptions')
    .select('trial_ends_at, status')
    .eq('user_id', userId)
    .maybeSingle();

  const base = sub?.trial_ends_at && new Date(sub.trial_ends_at) > new Date()
    ? new Date(sub.trial_ends_at)
    : new Date();
  base.setDate(base.getDate() + days);

  await db.from('subscriptions').upsert({
    user_id:       userId,
    status:        sub?.status === 'blocked' ? 'grace' : (sub?.status ?? 'grace'),
    trial_ends_at: base.toISOString(),
    updated_at:    new Date().toISOString(),
  }, { onConflict: 'user_id' });

  return NextResponse.json({ ok: true, trial_ends_at: base.toISOString() });
}
