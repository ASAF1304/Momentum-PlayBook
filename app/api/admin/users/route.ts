// app/api/admin/users/route.ts
//
// GET /api/admin/users
// Returns all users with their profile + subscription data.
// Requires is_admin = true on the caller's profile.

import { NextResponse } from 'next/server';
import { guardAdmin } from '@/lib/auth/require-admin';
import { getServiceClient } from '@/lib/supabase-service';

export async function GET() {
  const denied = await guardAdmin();
  if (denied) return denied;

  const db = getServiceClient();

  const [profilesResult, subsResult, authResult] = await Promise.all([
    db.from('user_profiles').select('id, display_name, created_at, is_admin'),
    db.from('subscriptions').select('user_id, status, trial_ends_at, current_period_end'),
    // Supabase admin API to get emails — requires service role key
    db.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);

  const profiles = (profilesResult.data ?? []) as {
    id: string; display_name: string | null; created_at: string; is_admin: boolean;
  }[];
  const subs = (subsResult.data ?? []) as {
    user_id: string; status: string; trial_ends_at: string | null; current_period_end: string | null;
  }[];
  const authUsers = authResult.data?.users ?? [];

  const subByUser  = Object.fromEntries(subs.map(s => [s.user_id, s]));
  const emailByUser = Object.fromEntries(authUsers.map(u => [u.id, u.email ?? '']));

  const users = profiles.map(p => ({
    id:           p.id,
    email:        emailByUser[p.id] ?? '',
    display_name: p.display_name,
    is_admin:     p.is_admin,
    created_at:   p.created_at,
    sub:          subByUser[p.id] ?? null,
  }));

  // Sort: admins first, then by created_at DESC
  users.sort((a, b) => {
    if (a.is_admin !== b.is_admin) return a.is_admin ? -1 : 1;
    return b.created_at.localeCompare(a.created_at);
  });

  return NextResponse.json(users);
}
