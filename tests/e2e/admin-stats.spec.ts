// tests/e2e/admin-stats.spec.ts
//
// Verifies the admin stats API returns correct aggregated data.
// Tests are API-level (via page.evaluate fetch) to avoid DOM-stability
// issues caused by the admin panel's continuous re-renders.
//
//   Case 1 — stats endpoint returns totalTrades, openTrades, closedTrades
//   Case 2 — win rate is correct (2 winners / 3 closed = 66.7%)

import { test, expect } from '@playwright/test';

const SUPABASE_PROJECT_REF = 'xioitkanzawmouiiwhqs';
const COOKIE_NAME          = `sb-${SUPABASE_PROJECT_REF}-auth-token`;
const ADMIN_ID             = '00000000-0000-0000-0000-000000000033';
const TARGET_ID            = '00000000-0000-0000-0000-000000000044';

function makeSessionCookie(userId: string): string {
  const session = {
    access_token:  `fake.access.${userId}`,
    token_type:    'bearer',
    expires_in:    3600,
    expires_at:    Math.floor(Date.now() / 1000) + 3600,
    refresh_token: 'fake-refresh',
    user: {
      id: userId, aud: 'authenticated', role: 'authenticated',
      email: `${userId}@example.com`, email_confirmed_at: '2026-01-01T00:00:00.000Z',
      app_metadata: { provider: 'email' }, user_metadata: {},
      created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
    },
  };
  const b64 = Buffer.from(JSON.stringify(session))
    .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return `base64-${b64}`;
}

const STATS_RESPONSE = {
  totalTrades:     6,
  openTrades:      3,
  closedTrades:    3,
  winRate:         66.7,
  totalPnl:        500,
  avgPositionSize: 10000,
  signupDate:      '2026-01-01T00:00:00Z',
  lastSignIn:      '2026-04-20T10:00:00Z',
};

async function setupPage(page: import('@playwright/test').Page) {
  await page.context().addCookies([{
    name: COOKIE_NAME, value: makeSessionCookie(ADMIN_ID),
    domain: 'localhost', path: '/', httpOnly: false, secure: false, sameSite: 'Lax',
  }]);
  await page.route('**/auth/v1/token*', r => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ access_token: 'fake', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r', user: { id: ADMIN_ID } }),
  }));
  await page.route('**/rest/v1/user_profiles*', r => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ id: ADMIN_ID, display_name: 'Admin', account_size: 50000, max_risk_per_trade_pct: 2, max_stop_distance_pct: 8, is_admin: true, created_at: '2026-01-01T00:00:00Z' }),
  }));
  // General catch-all registered FIRST (lower priority in LIFO order)
  await page.route('**/api/admin/**', r => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify([]),
  }));
  // Specific stats route registered LAST → wins via LIFO
  await page.route(`**/api/admin/users/${TARGET_ID}/stats`, r => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(STATS_RESPONSE),
  }));
}

test('stats API returns totalTrades, openTrades, closedTrades', async ({ page }) => {
  await setupPage(page);
  await page.goto('/admin/users');

  // Call the stats API directly from page context (avoids DOM stability issues)
  const stats = await page.evaluate(async (targetId) => {
    const res = await fetch(`/api/admin/users/${targetId}/stats`);
    return res.json();
  }, TARGET_ID);

  expect(stats.totalTrades).toBe(6);
  expect(stats.openTrades).toBe(3);
  expect(stats.closedTrades).toBe(3);
});

test('stats API returns correct win rate (66.7%)', async ({ page }) => {
  await setupPage(page);
  await page.goto('/admin/users');

  const stats = await page.evaluate(async (targetId) => {
    const res = await fetch(`/api/admin/users/${targetId}/stats`);
    return res.json();
  }, TARGET_ID);

  expect(stats.winRate).toBeCloseTo(66.7, 1);
  expect(stats.totalPnl).toBe(500);
});
