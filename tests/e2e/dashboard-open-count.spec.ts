// tests/e2e/dashboard-open-count.spec.ts
// Verifies that the Dashboard "Open" stat card counts ALL open trades,
// including broker-imported ones that carry is_what_if = true.
//
// Auth strategy: inject a real-looking Supabase session cookie so the client-
// side auth context picks up a user, allowing fetchTrades() to fire. Session
// data is base64url-encoded with the "base64-" prefix that @supabase/ssr uses.

import { test, expect } from '@playwright/test';

const SUPABASE_PROJECT_REF = 'xioitkanzawmouiiwhqs';
const FAKE_USER_ID = '00000000-0000-0000-0000-000000000001';

// 28 open trades — half broker-imported (is_what_if = true).
// Before the fix, the Dashboard excluded all is_what_if trades and showed 0.
const MOCK_TRADES = Array.from({ length: 28 }, (_, i) => ({
  id:                    `trade-${i}`,
  created_at:            '2026-01-01T00:00:00.000Z',
  ticker:                `T${i}`,
  setup_type:            null,
  phase1_date:           '2026-01-01',
  phase1_price:          100,
  phase1_shares:         10,
  phase2_date:           null,
  phase2_price:          null,
  phase2_shares:         null,
  initial_stop:          95,
  current_stop:          null,
  risk_dollars:          50,
  stop_distance_pct:     5,
  rs_rating:             null,
  trend_template_passed: true,
  exit_date:             null,
  exit_price:            null,
  status:                'open',
  outcome:               null,
  pnl_dollars:           null,
  pnl_pct:               null,
  r_multiple:            null,
  notes:                 null,
  lesson_learned:        null,
  screenshot_url:        null,
  partials:              [],
  current_shares:        10,
  is_what_if:            i % 2 === 0,    // half broker-imported (what-if)
  failed_gates:          null,
  what_if_reason:        i % 2 === 0 ? 'Imported from Interactive Brokers' : null,
}));

function makeSessionCookie(): string {
  const session = {
    access_token:  'fake.access.token',
    token_type:    'bearer',
    expires_in:    3600,
    expires_at:    Math.floor(Date.now() / 1000) + 3600,
    refresh_token: 'fake-refresh-token',
    user: {
      id:              FAKE_USER_ID,
      aud:             'authenticated',
      role:            'authenticated',
      email:           'test@example.com',
      email_confirmed_at: '2026-01-01T00:00:00.000Z',
      app_metadata:    { provider: 'email' },
      user_metadata:   {},
      created_at:      '2026-01-01T00:00:00.000Z',
      updated_at:      '2026-01-01T00:00:00.000Z',
    },
  };
  const b64 = Buffer.from(JSON.stringify(session))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  return `base64-${b64}`;
}

test('Dashboard Open stat counts all open trades including broker-imported (is_what_if)', async ({ page }) => {
  // 1. Set the Supabase session cookie before navigation so the client-side
  //    auth context picks up a user and fetchTrades() actually runs.
  await page.context().addCookies([{
    name:     `sb-${SUPABASE_PROJECT_REF}-auth-token`,
    value:    makeSessionCookie(),
    domain:   'localhost',
    path:     '/',
    httpOnly: false,
    secure:   false,
    sameSite: 'Lax',
  }]);

  // 2. Intercept Supabase REST: trades → return 28 mock open trades
  await page.route(`**/rest/v1/trades*`, async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'content-range': '0-27/28' },
      body: JSON.stringify(MOCK_TRADES),
    });
  });

  // 3. Intercept Supabase REST: user_profiles → return fake profile
  await page.route(`**/rest/v1/user_profiles*`, async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id:                      FAKE_USER_ID,
        display_name:            'Test User',
        account_size:            50000,
        max_risk_per_trade_pct:  1,
        max_stop_distance_pct:   8,
        created_at:              '2026-01-01T00:00:00.000Z',
      }),
    });
  });

  // 4. Stub Supabase auth token-refresh (fake token would fail on a real call)
  await page.route(`**/auth/v1/token*`, async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        access_token:  'fake.access.token',
        token_type:    'bearer',
        expires_in:    3600,
        expires_at:    Math.floor(Date.now() / 1000) + 3600,
        refresh_token: 'fake-refresh-token',
        user: { id: FAKE_USER_ID, email: 'test@example.com' },
      }),
    });
  });

  // 5. Stub live-prices so it returns instantly
  await page.route('**/api/live-prices', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ prices: {}, fetchedAt: new Date().toISOString() }),
    });
  });

  // 6. Stub Stage 2 leaders
  await page.route(`**/rest/v1/stage2_leaders*`, async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });

  await page.goto('/');

  // Wait for the trades to load (spinner disappears) — up to 20s
  await page.waitForFunction(
    () => !document.body.innerText.includes('Loading…') && !document.body.innerText.includes('Open…'),
    { timeout: 20_000 },
  ).catch(() => {});  // continue even if still loading; assertion below will catch it

  await page.screenshot({ path: 'tests/e2e/screenshots/dashboard-open-count.png' });

  // The "Open" stat should display 28 (not 0, not 14)
  await expect(page.locator('body')).toContainText('28', { timeout: 5_000 });
});
