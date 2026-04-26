// app/api/admin/users/[userId]/block/route.ts
// POST /api/admin/users/[userId]/block  → blocks the user
// POST /api/admin/users/[userId]/block with { unblock: true } → restores to grace

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
  const body = await request.json().catch(() => ({})) as { unblock?: boolean };

  const db = getServiceClient() as unknown as AnyDb;

  if (body.unblock) {
    // Restore to grace with 14-day window (soft default)
    const fourteenDays = new Date();
    fourteenDays.setDate(fourteenDays.getDate() + 14);
    await db.from('subscriptions').upsert({
      user_id:       userId,
      status:        'grace',
      trial_ends_at: fourteenDays.toISOString(),
      updated_at:    new Date().toISOString(),
    }, { onConflict: 'user_id' });
  } else {
    await db.from('subscriptions').upsert({
      user_id:    userId,
      status:     'blocked',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
  }

  return NextResponse.json({ ok: true });
}
