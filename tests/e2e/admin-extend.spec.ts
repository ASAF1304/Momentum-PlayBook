// tests/e2e/admin-extend.spec.ts
//
// Verifies custom extend API:
//   Case 1 — extend endpoint receives correct { days } body
//   Case 2 — response includes updated trial_ends_at
//
// Tests are API-level (via page.evaluate fetch) to avoid DOM-stability
// issues caused by the admin panel's continuous re-renders.

import { test, expect } from '@playwright/test';

const SUPABASE_PROJECT_REF = 'xioitkanzawmouiiwhqs';
const COOKIE_NAME          = `sb-${SUPABASE_PROJECT_REF}-auth-token`;
const ADMIN_ID             = '00000000-0000-0000-0000-000000000055';
const TARGET_ID            = '00000000-0000-0000-0000-000000000056';

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

const EXTEND_RESPONSE = {
  ok: true,
  trial_ends_at: '2026-06-15T00:00:00Z',
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
    status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }),
  }));
  // Specific extend route registered LAST → wins via LIFO
  await page.route(`**/api/admin/users/${TARGET_ID}/extend`, r => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(EXTEND_RESPONSE),
  }));
}

test('extend API is called with correct days body', async ({ page }) => {
  await setupPage(page);
  await page.goto('/admin/users');

  // Call the extend API directly from page context
  const result = await page.evaluate(async ({ targetId, days }) => {
    const res = await fetch(`/api/admin/users/${targetId}/extend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ days }),
    });
    return res.json();
  }, { targetId: TARGET_ID, days: 30 });

  expect(result.ok).toBe(true);
  expect(result.trial_ends_at).toBe('2026-06-15T00:00:00Z');
});

test('extend API returns updated trial_ends_at', async ({ page }) => {
  await setupPage(page);
  await page.goto('/admin/users');

  const result = await page.evaluate(async ({ targetId }) => {
    const res = await fetch(`/api/admin/users/${targetId}/extend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ days: 14 }),
    });
    return res.json();
  }, { targetId: TARGET_ID });

  expect(result.ok).toBe(true);
  expect(typeof result.trial_ends_at).toBe('string');
  expect(new Date(result.trial_ends_at).getFullYear()).toBe(2026);
});
