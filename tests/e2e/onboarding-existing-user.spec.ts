// tests/e2e/onboarding-existing-user.spec.ts
//
// Verifies that an existing user (already has a user_profiles row) can
// re-submit the onboarding form without crashing with a duplicate-key error.
// The fix: .insert() → .upsert({ onConflict: 'id' }).

import { test, expect } from '@playwright/test';

const SUPABASE_PROJECT_REF = 'xioitkanzawmouiiwhqs';
const COOKIE_NAME          = `sb-${SUPABASE_PROJECT_REF}-auth-token`;
const USER_ID              = '00000000-0000-0000-0000-000000000099';

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

// Existing profile — user already completed onboarding once before.
const EXISTING_PROFILE = {
  id:                      USER_ID,
  display_name:            'Returning User',
  account_size:            75000,
  max_risk_per_trade_pct:  2,
  max_stop_distance_pct:   8,
  accepted_terms_at:       '2026-01-01T00:00:00Z',
  dismissed_onboarding_at: '2026-01-01T00:00:00Z',
  created_at:              '2026-01-01T00:00:00Z',
};

test('existing user can submit onboarding without duplicate-key crash', async ({ page }) => {
  await page.context().addCookies([{
    name: COOKIE_NAME, value: makeSessionCookie(),
    domain: 'localhost', path: '/', httpOnly: false, secure: false, sameSite: 'Lax',
  }]);

  // Auth token endpoint
  await page.route('**/auth/v1/token*', r => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({
      access_token: 'fake', token_type: 'bearer', expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r',
      user: { id: USER_ID },
    }),
  }));

  // First profile fetch returns null (simulates landing on /onboarding before
  // auth-context has loaded the profile — the race condition that lets existing
  // users reach the form submit before the redirect useEffect fires).
  let profileCallCount = 0;
  await page.route('**/rest/v1/user_profiles*', r => {
    profileCallCount++;
    if (profileCallCount === 1) {
      // First call (auth-context bootstrap): return empty so useEffect doesn't redirect
      return r.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
    }
    // Subsequent calls (after upsert + refreshProfile): return the profile
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(EXISTING_PROFILE) });
  });

  // The upsert call — must return 200/204 (no duplicate-key error)
  await page.route('**/rest/v1/user_profiles', r => {
    if (r.request().method() === 'POST') {
      // upsert uses POST with Prefer: resolution=merge-duplicates
      return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    }
    return r.continue();
  });

  await page.route('**/rest/v1/subscriptions*', r => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ status: 'active', trial_ends_at: null }),
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

  await page.goto('/onboarding');

  // Fill in account size (required field)
  await page.fill('input[type="number"][placeholder="100000"]', '50000');

  // Submit the form
  await page.click('button[type="submit"]');

  // Should NOT show a duplicate-key error message
  await expect(page.locator('text=/duplicate key|unique constraint/i')).not.toBeVisible({ timeout: 5_000 });

  // Should navigate away from /onboarding (to / or /onboarding/checkout)
  await expect(page).not.toHaveURL(/\/onboarding$/, { timeout: 15_000 });
});
