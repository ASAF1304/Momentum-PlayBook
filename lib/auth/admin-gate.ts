// lib/auth/admin-gate.ts
//
// Password gate that sits BEFORE the existing is_admin DB check on /admin/*.
// Two-factor for admin: (1) you must be a DB-marked admin, (2) you must have
// entered the gate password within the last 8 hours.
//
// Token format: <expiryMs>.<hmacHex>
// HMAC = HMAC-SHA256(secret, expiryMs)
// Stored as httpOnly, secure, sameSite=strict cookie.

import { createHmac, timingSafeEqual } from 'crypto';

export const ADMIN_GATE_COOKIE = 'mp_admin_gate';
export const ADMIN_GATE_TTL_HOURS = 8;

function getSecret(): string {
  return process.env.ADMIN_GATE_SECRET || 'mp-default-admin-secret-please-change';
}

export function getAdminGatePassword(): string {
  return process.env.ADMIN_GATE_PASSWORD || 'idog2708';
}

export function makeGateToken(): string {
  const exp  = Date.now() + ADMIN_GATE_TTL_HOURS * 60 * 60 * 1000;
  const hmac = createHmac('sha256', getSecret()).update(String(exp)).digest('hex');
  return `${exp}.${hmac}`;
}

export function verifyGateToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const [expStr, sig] = token.split('.');
  if (!expStr || !sig) return false;
  const exp = parseInt(expStr, 10);
  if (!Number.isFinite(exp) || Date.now() > exp) return false;
  const expected = createHmac('sha256', getSecret()).update(String(exp)).digest('hex');
  try {
    return timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

export function verifyGatePassword(submitted: string): boolean {
  const expected = getAdminGatePassword();
  if (submitted.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(submitted), Buffer.from(expected));
  } catch {
    return false;
  }
}
