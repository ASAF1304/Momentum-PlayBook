// app/api/admin/users/[userId]/stats/route.ts
// GET /api/admin/users/[userId]/stats — returns aggregate trade stats for a user.
// Requires is_admin = true.

import { NextRequest, NextResponse } from 'next/server';
import { guardAdmin } from '@/lib/auth/require-admin';
import { getUserStats } from '@/lib/admin/user-stats';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const denied = await guardAdmin();
  if (denied) return denied;

  const { userId } = await params;
  const stats = await getUserStats(userId);
  return NextResponse.json(stats);
}
