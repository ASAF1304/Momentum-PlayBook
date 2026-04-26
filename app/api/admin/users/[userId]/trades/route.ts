// app/api/admin/users/[userId]/trades/route.ts
// GET /api/admin/users/[userId]/trades
// Returns all trades for a user using service-role client (bypasses RLS).

import { NextRequest, NextResponse } from 'next/server';
import { guardAdmin } from '@/lib/auth/require-admin';
import { getServiceClient } from '@/lib/supabase-service';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const denied = await guardAdmin();
  if (denied) return denied;

  const { userId } = await params;
  const db = getServiceClient();

  const { data, error } = await db
    .from('trades')
    .select('*')
    .eq('user_id', userId)
    .order('phase1_date', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}
