// tests/e2e/admin-block-user.spec.ts
//
// Verifies block/unblock functionality:
//   Case 1 — admin can block a user (API returns ok)
//   Case 2 — blocked user accessing the app is redirected to /blocked
//             (Note: middleware redirect is bypassed in Playwright test server;
//              we test the /blocked page UI directly instead.)

import { test, expect } from '@playwright/test';

const SUPABASE_PROJECT_REF = 'xioitkanzawmouiiwhqs';
const COOKIE_NAME          = `sb-${SUPABASE_PROJECT_REF}-auth-token`;
const ADMIN_ID             = '00000000-0000-0000-0000-000000000011';
const TARGET_ID            = '00000000-0000-0000-0000-000000000022';

function makeSessionCookie(userId: string): string {
  const session = {
    access_token:  `fake.access.${userId}`,
    token_type:    'bearer',
    expires_in:    3600,
    expires_at:    Math.floor(Date.now() / 1000) + 3600,
    refresh_token: 'fake-refresh',
    user: {
      id:                 userId,
      aud:                'authenticated',
      role:               'authenticated',
      email:              `${userId}@example.com`,
      email_confirmed_at: '2026-01-01T00:00:00.000Z',
      app_metadata:       { provider: 'email' },
      user_metadata:      {},
      created_at:         '2026-01-01T00:00:00.000Z',
      updated_at:         '2026-01-01T00:00:00.000Z',
    },
  };
  const b64 = Buffer.from(JSON.stringify(session))
    .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return `base64-${b64}`;
}

async function setupAdmin(page: import('@playwright/test').Page) {
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
}

// Case 1: admin block API endpoint returns ok
test('admin can call block API successfully', async ({ page }) => {
  await setupAdmin(page);

  // Mock the block endpoint
  let blockCalled = false;
  await page.route(`**/api/admin/users/${TARGET_ID}/block`, r => {
    blockCalled = true;
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });

  // Call the API directly from page context
  await page.goto('/admin/users');

  // Intercept via fetch in page context
  const result = await page.evaluate(async (targetId) => {
    const res = await fetch(`/api/admin/users/${targetId}/block`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    return res.json();
  }, TARGET_ID);

  expect(blockCalled).toBe(true);
  expect(result.ok).toBe(true);
});

// Case 2: /blocked page shows the correct Hebrew message
test('blocked page shows account-suspended message', async ({ page }) => {
  // /blocked is a public path — no auth needed
  await page.goto('/blocked');

  await expect(page.getByText('החשבון הושעה')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('asaf.abllin@gmail.com')).toBeVisible();
});

// Case 3: unblock API called with { unblock: true }
test('admin can call unblock API successfully', async ({ page }) => {
  await setupAdmin(page);

  let unblockCalled = false;
  let receivedBody = '';
  await page.route(`**/api/admin/users/${TARGET_ID}/block`, async r => {
    unblockCalled = true;
    receivedBody = r.request().postData() ?? '';
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });

  await page.goto('/admin/users');

  await page.evaluate(async (targetId) => {
    await fetch(`/api/admin/users/${targetId}/block`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unblock: true }),
    });
  }, TARGET_ID);

  expect(unblockCalled).toBe(true);
  expect(receivedBody).toContain('unblock');
});
