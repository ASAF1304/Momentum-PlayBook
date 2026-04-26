// app/api/admin/users/[userId]/route.ts
//
// POST /api/admin/users/[userId]
// Body: { action: 'comp' | 'extend' | 'revoke' }
//
// comp   → sets status='comp', no trial_ends_at
// extend → adds 30 days to trial_ends_at (or from NOW() if null/expired)
// revoke → sets status='grace', trial_ends_at = NOW() + 30d (re-grants grace period)

import { NextRequest, NextResponse } from 'next/server';
import { guardAdmin } from '@/lib/auth/require-admin';
import { getServiceClient } from '@/lib/supabase-service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const denied = await guardAdmin();
  if (denied) return denied;

  const { userId } = await params;
  const body = await request.json().catch(() => ({})) as { action?: string };
  const action = body.action;

  if (!['comp', 'extend', 'revoke'].includes(action ?? '')) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  const db = getServiceClient();

  if (action === 'comp') {
    await db.from('subscriptions').upsert({
      user_id:       userId,
      status:        'comp',
      trial_ends_at: null,
      updated_at:    new Date().toISOString(),
    }, { onConflict: 'user_id' });

  } else if (action === 'extend') {
    // Read current trial_ends_at to extend from
    const { data: sub } = await db
      .from('subscriptions')
      .select('trial_ends_at')
      .eq('user_id', userId)
      .maybeSingle();

    const base = sub?.trial_ends_at && new Date(sub.trial_ends_at) > new Date()
      ? new Date(sub.trial_ends_at)
      : new Date();
    base.setDate(base.getDate() + 30);

    await db.from('subscriptions').upsert({
      user_id:       userId,
      status:        'grace',
      trial_ends_at: base.toISOString(),
      updated_at:    new Date().toISOString(),
    }, { onConflict: 'user_id' });

  } else if (action === 'revoke') {
    const thirtyDaysOut = new Date();
    thirtyDaysOut.setDate(thirtyDaysOut.getDate() + 30);

    await db.from('subscriptions').upsert({
      user_id:       userId,
      status:        'grace',
      trial_ends_at: thirtyDaysOut.toISOString(),
      updated_at:    new Date().toISOString(),
    }, { onConflict: 'user_id' });
  }

  return NextResponse.json({ ok: true });
}
