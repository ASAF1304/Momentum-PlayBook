// tests/e2e/grandfather.spec.ts
//
// Verifies the 30-day grace period behaviour:
//
//   Case 1 — grace user with 20 days left → can access /journal (dashboard)
//   Case 2 — grace user with -1 day (expired_grace) → redirected to /billing

import { test, expect } from '@playwright/test';

const SUPABASE_PROJECT_REF = 'xioitkanzawmouiiwhqs';
const COOKIE_NAME          = `sb-${SUPABASE_PROJECT_REF}-auth-token`;
const USER_ID              = '00000000-0000-0000-0000-000000000077';

function makeSessionCookie(): string {
  const session = {
    access_token:  `fake.access.${USER_ID}`,
    token_type:    'bearer',
    expires_in:    3600,
    expires_at:    Math.floor(Date.now() / 1000) + 3600,
    refresh_token: 'fake-refresh',
    user: {
      id:                 USER_ID,
      aud:                'authenticated',
      role:               'authenticated',
      email:              `${USER_ID}@example.com`,
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

const PROFILE = {
  id:                      USER_ID,
  display_name:            'BetaUser',
  account_size:            50000,
  max_risk_per_trade_pct:  2,
  max_stop_distance_pct:   8,
  accepted_terms_at:       '2026-01-01T00:00:00Z',
  dismissed_onboarding_at: '2026-01-01T00:00:00Z',
  created_at:              '2026-01-01T00:00:00Z',
};

async function setupSession(page: import('@playwright/test').Page) {
  await page.addCookies([{
    name: COOKIE_NAME, value: makeSessionCookie(),
    domain: 'localhost', path: '/', httpOnly: false, secure: false, sameSite: 'Lax',
  }]);
  await page.route('**/rest/v1/user_profiles*', r => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(PROFILE),
  }));
  await page.route('**/rest/v1/trades*', r => r.fulfill({
    status: 200, contentType: 'application/json',
    body: '[]', headers: { 'content-range': '0-0/0' },
  }));
  await page.route('**/api/live-prices', r => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ prices: {}, fetchedAt: new Date().toISOString() }),
  }));
  await page.route('**/rest/v1/stage2_leaders*', r => r.fulfill({
    status: 200, contentType: 'application/json', body: '[]',
  }));
  await page.route('**/auth/v1/token*', r => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({
      access_token: 'fake', token_type: 'bearer', expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r',
      user: { id: USER_ID },
    }),
  }));
}

// Case 1: grace user with 20 days left → full app access
test('grace user with 20 days remaining can access /journal', async ({ page }) => {
  await setupSession(page);

  const trialEndsAt = new Date(Date.now() + 20 * 86_400_000).toISOString();
  await page.route('**/rest/v1/subscriptions*', r => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ status: 'grace', trial_ends_at: trialEndsAt }),
  }));

  await page.goto('/journal');

  // Should NOT be redirected — stays on /journal
  await expect(page).toHaveURL(/\/journal/, { timeout: 15_000 });
});

// Case 2: expired_grace → redirected to /billing (not /onboarding/checkout)
test('expired_grace user is redirected to /billing', async ({ page }) => {
  await setupSession(page);

  const trialEndsAt = new Date(Date.now() - 86_400_000).toISOString(); // yesterday
  await page.route('**/rest/v1/subscriptions*', r => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ status: 'expired_grace', trial_ends_at: trialEndsAt }),
  }));

  await page.goto('/journal');

  // middleware should redirect expired_grace to /billing
  await expect(page).toHaveURL(/\/billing/, { timeout: 15_000 });
});
