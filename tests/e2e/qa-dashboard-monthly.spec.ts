// tests/e2e/qa-dashboard-monthly.spec.ts
//
// QA Audit — Dashboard stats + Monthly Performance chart
//   1. Realized PNL tile shows correct sum
//   2. Win Rate tile shows correct percentage
//   3. Monthly Performance section renders when trades span 2+ months
//   4. Monthly Performance does NOT render when there are no trades
//   5. "Closed trades" sublabel shows correct count
//   6. Win Rate shows no sublabel when no closed trades
//   7. All 6 key stat tile labels are present

import { test, expect } from '@playwright/test';

const SUPABASE_PROJECT_REF = 'xioitkanzawmouiiwhqs';
const COOKIE_NAME          = `sb-${SUPABASE_PROJECT_REF}-auth-token`;
const USER_ID              = '00000000-0000-0000-0000-000000000301';

function makeSessionCookie(): string {
  const session = {
    access_token: `fake.access.${USER_ID}`,
    token_type: 'bearer', expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: 'fake-refresh',
    user: {
      id: USER_ID, aud: 'authenticated', role: 'authenticated',
      email: 'qa-dashboard@example.com', email_confirmed_at: '2026-01-01T00:00:00.000Z',
      app_metadata: { provider: 'email' }, user_metadata: {},
      created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
    },
  };
  const b64 = Buffer.from(JSON.stringify(session))
    .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return `base64-${b64}`;
}

const makeTrade = (
  id: string,
  exitDate: string | null,
  pnl: number | null,
  outcome: 'winner' | 'loser' | 'breakeven' | null,
  status: 'open' | 'closed',
  ticker = 'AAPL',
) => ({
  id,
  created_at: '2026-01-01T00:00:00Z',
  ticker,
  setup_type: null,
  phase1_date: '2026-01-01T12:00:00Z',
  phase1_price: 100,
  phase1_shares: 10,
  phase2_date: null, phase2_price: null, phase2_shares: null,
  initial_stop: 92, current_stop: 92, risk_dollars: 80,
  stop_distance_pct: 8, rs_rating: null, trend_template_passed: false,
  exit_date:  exitDate,
  exit_price: status === 'closed' ? (pnl && pnl > 0 ? 110 : 90) : null,
  status,
  outcome,
  pnl_dollars: pnl,
  pnl_pct: null, r_multiple: null, notes: null, lesson_learned: null,
  screenshot_url: null, partials: [], current_shares: 10,
  is_what_if: false, failed_gates: null, what_if_reason: null, is_short: false,
});

async function setupDashboard(
  page: import('@playwright/test').Page,
  trades: ReturnType<typeof makeTrade>[],
) {
  await page.context().addCookies([{
    name: COOKIE_NAME, value: makeSessionCookie(),
    domain: 'localhost', path: '/', httpOnly: false, secure: false, sameSite: 'Lax',
  }]);
  await page.route('**/auth/v1/token*', r => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({
      access_token: 'fake', token_type: 'bearer', expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r',
      user: { id: USER_ID },
    }),
  }));
  await page.route('**/rest/v1/user_profiles*', r => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({
      id: USER_ID, display_name: 'QA Dash', account_size: 100000,
      max_risk_per_trade_pct: 2, max_stop_distance_pct: 8,
      accepted_terms_at: '2026-01-01T00:00:00Z', dismissed_onboarding_at: '2026-01-01T00:00:00Z',
      created_at: '2026-01-01T00:00:00Z', is_admin: false,
    }),
  }));
  await page.route('**/rest/v1/subscriptions*', r => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ status: 'active', trial_ends_at: null }),
  }));
  await page.route('**/rest/v1/trades*', r => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify(trades),
    headers: { 'content-range': `0-${Math.max(0, trades.length - 1)}/${trades.length}` },
  }));
  await page.route('**/api/live-prices*', r => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ prices: {}, fetchedAt: new Date().toISOString() }),
  }));
  await page.route('**/rest/v1/stage2_leaders*', r => r.fulfill({
    status: 200, contentType: 'application/json', body: '[]',
  }));
}

// ── Tests ────────────────────────────────────────────────────────────────────

test('Dashboard Realized PNL tile sums closed trade P&L correctly (+$700)', async ({ page }) => {
  const trades = [
    makeTrade('d1', '2026-01-10T00:00:00Z', 500,  'winner', 'closed', 'AAPL'),
    makeTrade('d2', '2026-01-20T00:00:00Z', 300,  'winner', 'closed', 'MSFT'),
    makeTrade('d3', '2026-02-01T00:00:00Z', -100, 'loser',  'closed', 'META'),
    makeTrade('d4', null, null, null, 'open', 'NVDA'),
  ];
  await setupDashboard(page, trades);
  await page.goto('/');

  await expect(page.getByText('Realized PnL', { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('text=/\\$700/').first()).toBeVisible({ timeout: 10_000 });
});

test('Dashboard Win Rate tile shows correct percentage (2W 1L = 66.7%)', async ({ page }) => {
  const trades = [
    makeTrade('w1', '2026-01-10T00:00:00Z', 200,  'winner', 'closed', 'AAPL'),
    makeTrade('w2', '2026-01-20T00:00:00Z', 150,  'winner', 'closed', 'GOOG'),
    makeTrade('w3', '2026-02-01T00:00:00Z', -100, 'loser',  'closed', 'META'),
  ];
  await setupDashboard(page, trades);
  await page.goto('/');

  await expect(page.getByText('Win Rate', { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('text=/66\\.7%|66\\.6%/').first()).toBeVisible({ timeout: 10_000 });
});

test('Dashboard Win Rate sublabel shows closed trade count (3)', async ({ page }) => {
  const trades = [
    makeTrade('c1', '2026-01-10T00:00:00Z', 200, 'winner', 'closed', 'A'),
    makeTrade('c2', '2026-01-20T00:00:00Z', 100, 'winner', 'closed', 'B'),
    makeTrade('c3', '2026-02-01T00:00:00Z', -50, 'loser',  'closed', 'C'),
    makeTrade('c4', null, null, null, 'open', 'D'),
  ];
  await setupDashboard(page, trades);
  await page.goto('/');

  await expect(page.getByText('Win Rate', { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('text=/3 closed trades?/').first()).toBeVisible({ timeout: 10_000 });
});

test('Dashboard shows Monthly Performance chart when trades span 2+ months', async ({ page }) => {
  const trades = [
    makeTrade('m1', '2026-01-15T00:00:00Z', 400,  'winner', 'closed', 'AAPL'),
    makeTrade('m2', '2026-01-25T00:00:00Z', -100, 'loser',  'closed', 'MSFT'),
    makeTrade('m3', '2026-02-10T00:00:00Z', 300,  'winner', 'closed', 'GOOG'),
    makeTrade('m4', '2026-03-05T00:00:00Z', -200, 'loser',  'closed', 'META'),
  ];
  await setupDashboard(page, trades);
  await page.goto('/');

  await expect(page.locator('text=Monthly Performance').first()).toBeVisible({ timeout: 15_000 });
});

test('Dashboard does NOT show Monthly Performance when no trades', async ({ page }) => {
  await setupDashboard(page, []);
  await page.goto('/');

  await expect(page.getByText('Realized PnL', { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('text=Monthly Performance')).not.toBeVisible();
});

test('Dashboard Win Rate shows no closed-count sublabel when no closed trades', async ({ page }) => {
  const trades = [
    makeTrade('o1', null, null, null, 'open', 'NVDA'),
    makeTrade('o2', null, null, null, 'open', 'AMD'),
  ];
  await setupDashboard(page, trades);
  await page.goto('/');

  await expect(page.getByText('Win Rate', { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('text=/closed trades/')).not.toBeVisible();
});

test('Dashboard shows all key stat tile labels', async ({ page }) => {
  const trades = [
    makeTrade('s1', '2026-01-10T00:00:00Z', 300, 'winner', 'closed', 'AAPL'),
  ];
  await setupDashboard(page, trades);
  await page.goto('/');

  const expectedLabels = ['Realized PnL', 'Win Rate', 'Avg R', 'Max Drawdown', 'Avg Win', 'Avg Loss'];
  for (const label of expectedLabels) {
    await expect(page.getByText(label, { exact: true })).toBeVisible({ timeout: 15_000 });
  }
});
