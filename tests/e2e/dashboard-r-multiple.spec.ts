// tests/e2e/dashboard-r-multiple.spec.ts
//
// Verifies that the Dashboard PositionCard computes and renders the current
// R-Multiple for an open position using live price data.
//
// AAPL: entry=$100, stop=$90, live price=$120
// R = (120 - 100) / (100 - 90) = 20 / 10 = 2.0 → "+2.00R"

import { test, expect } from '@playwright/test';

const SUPABASE_PROJECT_REF = 'xioitkanzawmouiiwhqs';
const FAKE_USER_ID = '00000000-0000-0000-0000-000000000004';

const MOCK_TRADES = [
  {
    id: 'open-aapl', created_at: '2026-04-01T00:00:00.000Z',
    ticker: 'AAPL', setup_type: 'VCP',
    phase1_date: '2026-04-01', phase1_price: 100, phase1_shares: 100,
    phase2_date: null, phase2_price: null, phase2_shares: null,
    initial_stop: 90, current_stop: null, risk_dollars: 1000,
    stop_distance_pct: 10, rs_rating: null, trend_template_passed: true,
    exit_date: null, exit_price: null,
    status: 'open', outcome: null,
    pnl_dollars: null, pnl_pct: null, r_multiple: null,
    notes: null, lesson_learned: null, screenshot_url: null,
    partials: [], current_shares: 100, is_what_if: false,
    failed_gates: null, what_if_reason: null,
  },
];

// Live price: $120 → R = (120-100)/(100-90) = 2.0
const LIVE_PRICES = {
  prices: {
    AAPL: { ticker: 'AAPL', price: 120, changePct: 1.0, dayHigh: 121, dayLow: 119 },
  },
  fetchedAt: new Date().toISOString(),
};

function makeSessionCookie(): string {
  const session = {
    access_token: 'fake.access.token', token_type: 'bearer',
    expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: 'fake-refresh-token',
    user: {
      id: FAKE_USER_ID, aud: 'authenticated', role: 'authenticated',
      email: 'test@example.com', email_confirmed_at: '2026-01-01T00:00:00.000Z',
      app_metadata: { provider: 'email' }, user_metadata: {},
      created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
    },
  };
  const b64 = Buffer.from(JSON.stringify(session)).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return `base64-${b64}`;
}

test('PositionCard displays current R-Multiple from live price', async ({ page }) => {
  await page.context().addCookies([{
    name: `sb-${SUPABASE_PROJECT_REF}-auth-token`, value: makeSessionCookie(),
    domain: 'localhost', path: '/', httpOnly: false, secure: false, sameSite: 'Lax',
  }]);

  await page.route('**/rest/v1/trades*', route =>
    route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/1' }, body: JSON.stringify(MOCK_TRADES) }),
  );
  await page.route('**/rest/v1/user_profiles*', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      id: FAKE_USER_ID, display_name: 'Test', account_size: 50000,
      max_risk_per_trade_pct: 1, max_stop_distance_pct: 8,
      dismissed_onboarding_at: '2026-01-01T00:00:00.000Z',
      created_at: '2026-01-01T00:00:00.000Z',
    }) }),
  );
  await page.route('**/auth/v1/token*', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      access_token: 'fake.access.token', token_type: 'bearer',
      expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
      refresh_token: 'fake-refresh-token',
      user: { id: FAKE_USER_ID, email: 'test@example.com' },
    }) }),
  );
  await page.route('**/api/live-prices', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(LIVE_PRICES) }),
  );
  await page.route('**/rest/v1/stage2_leaders*', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }),
  );

  await page.goto('/');
  await page.waitForFunction(
    () => !document.body.innerText.includes('Loading…'),
    { timeout: 20_000 },
  ).catch(() => {});

  await page.screenshot({ path: 'tests/e2e/screenshots/dashboard-r-multiple.png' });

  // PositionCard risk line should show "+2.00R"
  await expect(page.locator('body')).toContainText('+2.00R', { timeout: 5_000 });
});

test('PositionCard shows negative R-Multiple when price is below entry', async ({ page }) => {
  // Override live price to below entry ($95 < $100)
  // R = (95 - 100) / (100 - 90) = -5/10 = -0.5 → "-0.50R"
  await page.context().addCookies([{
    name: `sb-${SUPABASE_PROJECT_REF}-auth-token`, value: makeSessionCookie(),
    domain: 'localhost', path: '/', httpOnly: false, secure: false, sameSite: 'Lax',
  }]);

  await page.route('**/rest/v1/trades*', route =>
    route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/1' }, body: JSON.stringify(MOCK_TRADES) }),
  );
  await page.route('**/rest/v1/user_profiles*', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      id: FAKE_USER_ID, display_name: 'Test', account_size: 50000,
      max_risk_per_trade_pct: 1, max_stop_distance_pct: 8,
      dismissed_onboarding_at: '2026-01-01T00:00:00.000Z',
      created_at: '2026-01-01T00:00:00.000Z',
    }) }),
  );
  await page.route('**/auth/v1/token*', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      access_token: 'fake.access.token', token_type: 'bearer',
      expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
      refresh_token: 'fake-refresh-token',
      user: { id: FAKE_USER_ID, email: 'test@example.com' },
    }) }),
  );
  await page.route('**/api/live-prices', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      prices: {
        AAPL: { ticker: 'AAPL', price: 95, changePct: -2.5, dayHigh: 98, dayLow: 93 },
      },
      fetchedAt: new Date().toISOString(),
    }) }),
  );
  await page.route('**/rest/v1/stage2_leaders*', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }),
  );

  await page.goto('/');
  await page.waitForFunction(
    () => !document.body.innerText.includes('Loading…'),
    { timeout: 20_000 },
  ).catch(() => {});

  // R = (95-100)/(100-90) = -0.5 → "-0.50R"
  await expect(page.locator('body')).toContainText('-0.50R', { timeout: 5_000 });
});
