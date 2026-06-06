// app/api/admin/gate/route.ts
//
// POST /api/admin/gate — verify password, set 8h httpOnly cookie session.
// DELETE /api/admin/gate — clear the gate cookie (sign-out of admin gate).

import { NextRequest, NextResponse } from 'next/server';
import {
  ADMIN_GATE_COOKIE, ADMIN_GATE_TTL_HOURS,
  makeGateToken, verifyGatePassword,
} from '@/lib/auth/admin-gate';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as { password?: string };
  const submitted = (body.password ?? '').toString();

  if (!verifyGatePassword(submitted)) {
    return NextResponse.json({ ok: false, error: 'Incorrect password' }, { status: 401 });
  }

  const token = makeGateToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_GATE_COOKIE, token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path:     '/',
    maxAge:   ADMIN_GATE_TTL_HOURS * 60 * 60,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_GATE_COOKIE, '', {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path:     '/',
    maxAge:   0,
  });
  return res;
}
