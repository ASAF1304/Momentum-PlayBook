// tests/e2e/dashboard-live-stats.spec.ts
//
// Verifies that the Dashboard Account Equity hero correctly adds realized PnL
// (from closed trades) and unrealized PnL (from live prices) to account size.
// Also checks that the Realized PnL and Unrealized PnL stat tiles appear.

import { test, expect } from '@playwright/test';

const SUPABASE_PROJECT_REF = 'xioitkanzawmouiiwhqs';
const FAKE_USER_ID = '00000000-0000-0000-0000-000000000002';

// accountSize=50000, realizedPnL=+2000 (closed winner), unrealizedPnL=+1500 (AAPL open)
// Expected account equity = 50000 + 2000 + 1500 = $53,500
const ACCOUNT_SIZE = 50_000;

const MOCK_TRADES = [
  // Closed winner — contributes to realizedPnL
  {
    id: 'closed-1', created_at: '2026-01-01T00:00:00.000Z',
    ticker: 'MSFT', setup_type: null,
    phase1_date: '2026-01-05', phase1_price: 200, phase1_shares: 20,
    phase2_date: null, phase2_price: null, phase2_shares: null,
    initial_stop: 190, current_stop: null, risk_dollars: 200,
    stop_distance_pct: 5, rs_rating: null, trend_template_passed: true,
    exit_date: '2026-01-20T00:00:00.000Z', exit_price: 300,
    status: 'closed', outcome: 'winner',
    pnl_dollars: 2000, pnl_pct: 50, r_multiple: 10,
    notes: null, lesson_learned: null, screenshot_url: null,
    partials: [], current_shares: null, is_what_if: false,
    failed_gates: null, what_if_reason: null,
  },
  // Open AAPL — contributes to unrealizedPnL via live price
  {
    id: 'open-1', created_at: '2026-04-01T00:00:00.000Z',
    ticker: 'AAPL', setup_type: null,
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

// Live price: AAPL at $115 → unrealized = (115-100)*100 = $1,500
const LIVE_PRICES = {
  prices: {
    AAPL: { ticker: 'AAPL', price: 115, changePct: 2.5, dayHigh: 116, dayLow: 114 },
  },
  fetchedAt: new Date().toISOString(),
};

function makeSessionCookie(): string {
  const session = {
    access_token:  'fake.access.token',
    token_type:    'bearer',
    expires_in:    3600,
    expires_at:    Math.floor(Date.now() / 1000) + 3600,
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

test.beforeEach(async ({ page }) => {
  await page.context().addCookies([{
    name: `sb-${SUPABASE_PROJECT_REF}-auth-token`, value: makeSessionCookie(),
    domain: 'localhost', path: '/', httpOnly: false, secure: false, sameSite: 'Lax',
  }]);

  await page.route('**/rest/v1/trades*', route =>
    route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-1/2' }, body: JSON.stringify(MOCK_TRADES) }),
  );
  await page.route('**/rest/v1/user_profiles*', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      id: FAKE_USER_ID, display_name: 'Test', account_size: ACCOUNT_SIZE,
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
  await page.route('**/auth/v1/user', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      id: FAKE_USER_ID, aud: 'authenticated', role: 'authenticated',
      email: 'test@example.com', email_confirmed_at: '2026-01-01T00:00:00.000Z',
      app_metadata: { provider: 'email' }, user_metadata: {},
      created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
    }) }),
  );
  await page.route('**/api/live-prices', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(LIVE_PRICES) }),
  );
  await page.route('**/rest/v1/stage2_leaders*', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }),
  );
});

test('Account Equity hero adds realized + unrealized PnL to account size', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(
    () => !document.body.innerText.includes('Loading…'),
    { timeout: 20_000 },
  ).catch(() => {});

  await page.screenshot({ path: 'tests/e2e/screenshots/dashboard-live-stats.png' });

  // Account equity = 50,000 + 2,000 (realized) + 1,500 (unrealized) = 53,500
  await expect(page.locator('body')).toContainText('53,500', { timeout: 5_000 });
});

test('Realized PnL tile shows closed trade profit', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(
    () => !document.body.innerText.includes('Loading…'),
    { timeout: 20_000 },
  ).catch(() => {});

  // Realized PnL tile: +$2,000
  await expect(page.locator('body')).toContainText('+$2,000', { timeout: 5_000 });
});

test('Unrealized PnL tile shows open position gain from live price', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(
    () => !document.body.innerText.includes('Loading…'),
    { timeout: 20_000 },
  ).catch(() => {});

  // Unrealized PnL = (115-100)*100 = $1,500
  await expect(page.locator('body')).toContainText('+$1,500', { timeout: 5_000 });
});
