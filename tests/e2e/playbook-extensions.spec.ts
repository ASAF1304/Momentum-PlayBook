// tests/e2e/playbook-extensions.spec.ts
//
// Verifies additive changes to /playbook:
//   1. Stats strip has 4 tiles (Win Rate, Avg R, Total PnL, Unrealized PnL)
//   2. LiveTradeCard shows "Current R" row when live price is available
//   3. Live indicator appears in page header when open positions exist
//
// AAPL open: entry=$100, stop=$90, live price=$120 → R = 2.0 → "+2.00R"
// Unrealized PnL = (120-100)*100 = $2,000 → "+$2,000"

import { test, expect } from '@playwright/test';

const SUPABASE_PROJECT_REF = 'xioitkanzawmouiiwhqs';
const FAKE_USER_ID = '00000000-0000-0000-0000-000000000005';

const MOCK_TRADES = [
  // Closed winner — provides stats baseline
  {
    id: 'closed-1', created_at: '2026-01-01T00:00:00.000Z',
    ticker: 'NVDA', setup_type: null,
    phase1_date: '2026-01-10', phase1_price: 500, phase1_shares: 10,
    phase2_date: null, phase2_price: null, phase2_shares: null,
    initial_stop: 480, current_stop: null, risk_dollars: 200,
    stop_distance_pct: 4, rs_rating: null, trend_template_passed: true,
    exit_date: '2026-02-01T00:00:00.000Z', exit_price: 560,
    status: 'closed', outcome: 'winner',
    pnl_dollars: 600, pnl_pct: 12, r_multiple: 3,
    notes: null, lesson_learned: null, screenshot_url: null,
    partials: [], current_shares: null, is_what_if: false,
    failed_gates: null, what_if_reason: null,
  },
  // Open AAPL — shows in Live tab with R-Multiple
  {
    id: 'open-aapl', created_at: '2026-04-01T00:00:00.000Z',
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

// AAPL live price $120 → unrealized = (120-100)*100 = $2,000, R = 2.0
const LIVE_PRICES = {
  prices: {
    AAPL: { ticker: 'AAPL', price: 120, changePct: 3.0, dayHigh: 122, dayLow: 119 },
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
});

test('Stats strip shows 4 tiles including Unrealized PnL', async ({ page }) => {
  await page.goto('/playbook');
  await page.waitForFunction(
    () => !document.body.innerText.includes('Loading trades'),
    { timeout: 20_000 },
  ).catch(() => {});

  // All 4 tile labels should be present
  await expect(page.locator('body')).toContainText('Win Rate',       { timeout: 5_000 });
  await expect(page.locator('body')).toContainText('Avg R',          { timeout: 5_000 });
  await expect(page.locator('body')).toContainText('Total PnL',      { timeout: 5_000 });
  await expect(page.locator('body')).toContainText('Unrealized PnL', { timeout: 5_000 });

  // Unrealized PnL value: (120-100)*100 = +$2,000
  await expect(page.locator('body')).toContainText('+$2,000', { timeout: 5_000 });

  await page.screenshot({ path: 'tests/e2e/screenshots/playbook-stats-strip.png' });
});

test('Live tab header shows pulsing Live indicator', async ({ page }) => {
  await page.goto('/playbook');
  await page.waitForFunction(
    () => !document.body.innerText.includes('Loading trades'),
    { timeout: 20_000 },
  ).catch(() => {});

  // The Live badge appears in the page header when openTrades.length > 0
  // It has text "Live" and is near the "Playbook" h1
  const header = page.locator('h1:has-text("Playbook")');
  await expect(header).toBeVisible({ timeout: 5_000 });

  // The Live badge is a sibling span in the same flex row
  await expect(page.locator('text=Live').first()).toBeVisible({ timeout: 5_000 });

  await page.screenshot({ path: 'tests/e2e/screenshots/playbook-live-indicator.png' });
});

test('LiveTradeCard shows Current R from live price', async ({ page }) => {
  await page.goto('/playbook?filter=live');
  await page.waitForFunction(
    () => !document.body.innerText.includes('Loading trades'),
    { timeout: 20_000 },
  ).catch(() => {});

  await page.screenshot({ path: 'tests/e2e/screenshots/playbook-r-multiple.png' });

  // R = (120-100)/(100-90) = 2.0 → "+2.00R"
  await expect(page.locator('body')).toContainText('+2.00R', { timeout: 5_000 });
});

test('LiveTradeCard shows AAPL with live price and R-Multiple', async ({ page }) => {
  await page.goto('/playbook?filter=live');
  await page.waitForFunction(
    () => !document.body.innerText.includes('Loading trades'),
    { timeout: 20_000 },
  ).catch(() => {});

  // AAPL ticker visible
  await expect(page.locator('body')).toContainText('AAPL', { timeout: 5_000 });

  // Live price row visible
  await expect(page.locator('body')).toContainText('$120.00', { timeout: 5_000 });

  // Current R visible
  await expect(page.locator('body')).toContainText('Current R', { timeout: 5_000 });
  await expect(page.locator('body')).toContainText('+2.00R',    { timeout: 5_000 });
});
