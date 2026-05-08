// tests/e2e/admin-access.spec.ts
//
// Verifies admin panel access control:
//   Case 1 — non-admin user visiting /admin/users is redirected to /
//   Case 2 — admin user can access /admin/users and sees the user table

import { test, expect } from '@playwright/test';

const SUPABASE_PROJECT_REF = 'xioitkanzawmouiiwhqs';
const COOKIE_NAME          = `sb-${SUPABASE_PROJECT_REF}-auth-token`;
const USER_ID              = '00000000-0000-0000-0000-000000000066';

function makeSessionCookie(userId = USER_ID): string {
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

async function setupSession(
  page: import('@playwright/test').Page,
  is_admin: boolean,
) {
  await page.context().addCookies([{
    name: COOKIE_NAME, value: makeSessionCookie(),
    domain: 'localhost', path: '/', httpOnly: false, secure: false, sameSite: 'Lax',
  }]);

  const profile = {
    id:                      USER_ID,
    display_name:            is_admin ? 'Admin' : 'Regular User',
    account_size:            50000,
    max_risk_per_trade_pct:  2,
    max_stop_distance_pct:   8,
    accepted_terms_at:       '2026-01-01T00:00:00Z',
    dismissed_onboarding_at: '2026-01-01T00:00:00Z',
    created_at:              '2026-01-01T00:00:00Z',
    is_admin,
  };

  await page.route('**/rest/v1/user_profiles*', r => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(profile),
  }));
  await page.route('**/rest/v1/trades*', r => r.fulfill({
    status: 200, contentType: 'application/json',
    body: '[]', headers: { 'content-range': '0-0/0' },
  }));
  await page.route('**/rest/v1/subscriptions*', r => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ status: 'active', trial_ends_at: null }),
  }));
  await page.route('**/rest/v1/stage2_leaders*', r => r.fulfill({
    status: 200, contentType: 'application/json', body: '[]',
  }));
  await page.route('**/api/live-prices', r => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ prices: {}, fetchedAt: new Date().toISOString() }),
  }));
  await page.route('**/auth/v1/token*', r => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({
      access_token: 'fake', token_type: 'bearer', expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r',
      user: { id: USER_ID },
    }),
  }));
  await page.route('**/auth/v1/user', r => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({
      id: USER_ID, aud: 'authenticated', role: 'authenticated',
      email: `${USER_ID}@example.com`, email_confirmed_at: '2026-01-01T00:00:00.000Z',
      app_metadata: { provider: 'email' }, user_metadata: {},
      created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
    }),
  }));
}

// Case 1: non-admin → redirected to /
test('non-admin user is redirected away from /admin/users', async ({ page }) => {
  await setupSession(page, false);

  await page.goto('/admin/users');

  // Should NOT stay on /admin/users — client-side redirect to /
  await expect(page).not.toHaveURL(/\/admin\/users/, { timeout: 15_000 });
});

// Case 2: admin → can see the user table
test('admin user can access /admin/users and sees the user list', async ({ page }) => {
  await setupSession(page, true);

  // Mock the admin API endpoint
  await page.route('**/api/admin/users', r => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify([
      {
        id:           USER_ID,
        email:        'admin@example.com',
        display_name: 'Admin',
        is_admin:     true,
        created_at:   '2026-01-01T00:00:00Z',
        sub:          { status: 'active', trial_ends_at: null, current_period_end: null },
      },
      {
        id:           '00000000-0000-0000-0000-000000000001',
        email:        'user@example.com',
        display_name: 'Beta User',
        is_admin:     false,
        created_at:   '2026-01-02T00:00:00Z',
        sub:          { status: 'grace', trial_ends_at: '2026-05-01T00:00:00Z', current_period_end: null },
      },
    ]),
  }));

  await page.goto('/admin/users');

  // Should stay on /admin/users
  await expect(page).toHaveURL(/\/admin\/users/, { timeout: 15_000 });

  // Should show user data
  await expect(page.getByText('user@example.com')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('grace')).toBeVisible();
});
