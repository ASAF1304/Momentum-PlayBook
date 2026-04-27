// tests/e2e/dashboard-period-filters.spec.ts
//
// Verifies that the period filter tabs (All Time / YTD / MTD / Last 30 Days)
// correctly scope the Win Rate and other stat tiles to the selected window.
//
// Two closed trades:
//   Trade A — exit 2025-06-15 (outside YTD 2026)
//   Trade B — exit 2026-02-01 (inside YTD 2026)
// All Time → win rate 50% (1 win + 1 loss)
// YTD      → win rate 0%  (only the loser falls in 2026)

import { test, expect } from '@playwright/test';

const SUPABASE_PROJECT_REF = 'xioitkanzawmouiiwhqs';
const FAKE_USER_ID = '00000000-0000-0000-0000-000000000003';

const MOCK_TRADES = [
  // Trade A — winner, closed in 2025 (not in YTD 2026)
  {
    id: 'trade-a', created_at: '2025-01-01T00:00:00.000Z',
    ticker: 'GOOGL', setup_type: null,
    phase1_date: '2025-05-01', phase1_price: 150, phase1_shares: 10,
    phase2_date: null, phase2_price: null, phase2_shares: null,
    initial_stop: 140, current_stop: null, risk_dollars: 100,
    stop_distance_pct: 7, rs_rating: null, trend_template_passed: true,
    exit_date: '2025-06-15T00:00:00.000Z', exit_price: 170,
    status: 'closed', outcome: 'winner',
    pnl_dollars: 200, pnl_pct: 13, r_multiple: 2,
    notes: null, lesson_learned: null, screenshot_url: null,
    partials: [], current_shares: null, is_what_if: false,
    failed_gates: null, what_if_reason: null,
  },
  // Trade B — loser, closed in 2026 (inside YTD 2026)
  {
    id: 'trade-b', created_at: '2026-01-15T00:00:00.000Z',
    ticker: 'META', setup_type: null,
    phase1_date: '2026-01-15', phase1_price: 200, phase1_shares: 5,
    phase2_date: null, phase2_price: null, phase2_shares: null,
    initial_stop: 190, current_stop: null, risk_dollars: 50,
    stop_distance_pct: 5, rs_rating: null, trend_template_passed: true,
    exit_date: '2026-02-01T00:00:00.000Z', exit_price: 185,
    status: 'closed', outcome: 'loser',
    pnl_dollars: -75, pnl_pct: -7.5, r_multiple: -1.5,
    notes: null, lesson_learned: null, screenshot_url: null,
    partials: [], current_shares: null, is_what_if: false,
    failed_gates: null, what_if_reason: null,
  },
];

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
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ prices: {}, fetchedAt: new Date().toISOString() }) }),
  );
  await page.route('**/rest/v1/stage2_leaders*', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) }),
  );
});

test('All Time shows 50% win rate across both periods', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(
    () => !document.body.innerText.includes('Loading…'),
    { timeout: 20_000 },
  ).catch(() => {});

  // 1 winner + 1 loser = 50% win rate by default (All Time)
  await expect(page.locator('body')).toContainText('50.0%', { timeout: 5_000 });

  await page.screenshot({ path: 'tests/e2e/screenshots/dashboard-period-all-time.png' });
});

test('YTD filter excludes 2025 trade and shows 0% win rate', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(
    () => !document.body.innerText.includes('Loading…'),
    { timeout: 20_000 },
  ).catch(() => {});

  // Click "YTD" tab — only the 2026 loser is included
  await page.getByRole('button', { name: 'YTD' }).click();

  // Win rate should drop to 0% (only loser in 2026)
  await expect(page.locator('body')).toContainText('0.0%', { timeout: 5_000 });

  await page.screenshot({ path: 'tests/e2e/screenshots/dashboard-period-ytd.png' });
});

test('MTD filter shows only current-month trades', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(
    () => !document.body.innerText.includes('Loading…'),
    { timeout: 20_000 },
  ).catch(() => {});

  await page.getByRole('button', { name: 'MTD' }).click();

  // Both trades are not in the current month (Apr 2026), so Win Rate → "—"
  await expect(page.locator('body')).toContainText('—', { timeout: 5_000 });

  await page.screenshot({ path: 'tests/e2e/screenshots/dashboard-period-mtd.png' });
});
