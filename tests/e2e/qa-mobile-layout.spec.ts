// tests/e2e/qa-mobile-layout.spec.ts
//
// QA Audit — Mobile viewport layout (390px wide, iPhone 14 dimensions)
//
// KNOWN BUGS FOUND BY THESE TESTS:
//   - Dashboard: has horizontal overflow at 390px (real CSS bug)
//   - Journal: trade ticker text (NVDA) is "hidden" at 390px — the ticker column
//     may collapse to zero width or be clipped by overflow:hidden at mobile breakpoint
//
// Tests that detect real bugs are intentionally left as FAILING to document findings.
// Tests that check test-infrastructure issues (wrong selectors) have been fixed.

import { test, expect } from '@playwright/test';

const SUPABASE_PROJECT_REF = 'xioitkanzawmouiiwhqs';
const COOKIE_NAME          = `sb-${SUPABASE_PROJECT_REF}-auth-token`;
const USER_ID              = '00000000-0000-0000-0000-000000000501';
const MOBILE_WIDTH         = 390;
const MOBILE_HEIGHT        = 844;

function makeSessionCookie(): string {
  const session = {
    access_token: `fake.access.${USER_ID}`,
    token_type: 'bearer', expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: 'fake-refresh',
    user: {
      id: USER_ID, aud: 'authenticated', role: 'authenticated',
      email: 'qa-mobile@example.com', email_confirmed_at: '2026-01-01T00:00:00.000Z',
      app_metadata: { provider: 'email' }, user_metadata: {},
      created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
    },
  };
  const b64 = Buffer.from(JSON.stringify(session))
    .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return `base64-${b64}`;
}

const MOCK_TRADES = [
  {
    id: 'mob-1', created_at: '2026-01-01T00:00:00Z', ticker: 'NVDA',
    setup_type: null, phase1_date: '2026-01-05T12:00:00Z', phase1_price: 500,
    phase1_shares: 5, phase2_date: null, phase2_price: null, phase2_shares: null,
    initial_stop: 460, current_stop: 460, risk_dollars: 200,
    stop_distance_pct: 8, rs_rating: null, trend_template_passed: false,
    exit_date: '2026-01-20T12:00:00Z', exit_price: 550,
    status: 'closed', outcome: 'winner', pnl_dollars: 250, pnl_pct: 10,
    r_multiple: 1.25, notes: null, lesson_learned: null, screenshot_url: null,
    partials: [], current_shares: 0, is_what_if: false, failed_gates: null,
    what_if_reason: null, is_short: false,
  },
  {
    id: 'mob-2', created_at: '2026-02-01T00:00:00Z', ticker: 'AAPL',
    setup_type: null, phase1_date: '2026-02-01T12:00:00Z', phase1_price: 220,
    phase1_shares: 10, phase2_date: null, phase2_price: null, phase2_shares: null,
    initial_stop: 200, current_stop: 200, risk_dollars: 200,
    stop_distance_pct: 9, rs_rating: null, trend_template_passed: true,
    exit_date: null, exit_price: null,
    status: 'open', outcome: null, pnl_dollars: null, pnl_pct: null,
    r_multiple: null, notes: null, lesson_learned: null, screenshot_url: null,
    partials: [], current_shares: 10, is_what_if: false, failed_gates: null,
    what_if_reason: null, is_short: false,
  },
];

async function setupMobile(page: import('@playwright/test').Page) {
  await page.setViewportSize({ width: MOBILE_WIDTH, height: MOBILE_HEIGHT });
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
      id: USER_ID, display_name: 'Mobile QA', account_size: 50000,
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
    body: JSON.stringify(MOCK_TRADES),
    headers: { 'content-range': '0-1/2' },
  }));
  await page.route('**/api/live-prices*', r => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ prices: {}, fetchedAt: new Date().toISOString() }),
  }));
  await page.route('**/rest/v1/stage2_leaders*', r => r.fulfill({
    status: 200, contentType: 'application/json', body: '[]',
  }));
  await page.route('**/rest/v1/watchlist_items*', r => r.fulfill({
    status: 200, contentType: 'application/json', body: '[]',
  }));
}

async function hasHorizontalOverflow(page: import('@playwright/test').Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
}

// ── Tests ────────────────────────────────────────────────────────────────────

test('Journal page: no horizontal overflow on 390px mobile', async ({ page }) => {
  await setupMobile(page);
  await page.goto('/journal');
  // Wait for the stat cards which are always visible (not the trade rows which may hide)
  await expect(page.getByText('Win Rate', { exact: true })).toBeVisible({ timeout: 15_000 });

  const overflows = await hasHorizontalOverflow(page);
  expect(overflows, 'Journal has horizontal overflow on mobile').toBe(false);
});

test('Dashboard page: no horizontal overflow on 390px mobile', async ({ page }) => {
  // BUG: This test documents a known overflow issue on the dashboard at 390px.
  // The dashboard has stat tiles that may overflow horizontally on narrow screens.
  await setupMobile(page);
  await page.goto('/');
  await expect(page.getByText('Realized PnL', { exact: true })).toBeVisible({ timeout: 15_000 });

  const overflows = await hasHorizontalOverflow(page);
  expect(overflows, 'Dashboard has horizontal overflow on mobile').toBe(false);
});

test('Login page: no horizontal overflow on 390px mobile', async ({ page }) => {
  await page.setViewportSize({ width: MOBILE_WIDTH, height: MOBILE_HEIGHT });
  await page.goto('/login');
  await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10_000 });

  const overflows = await hasHorizontalOverflow(page);
  expect(overflows, 'Login page has horizontal overflow on mobile').toBe(false);
});

test('Watchlist page: no horizontal overflow on 390px mobile', async ({ page }) => {
  await setupMobile(page);
  await page.goto('/watchlist');
  // Wait for nav (always visible regardless of auth state)
  await expect(page.locator('nav').first()).toBeVisible({ timeout: 15_000 });

  const overflows = await hasHorizontalOverflow(page);
  expect(overflows, 'Watchlist has horizontal overflow on mobile').toBe(false);
});

test('Navigation links are visible at 390px', async ({ page }) => {
  await setupMobile(page);
  await page.goto('/');
  await expect(page.getByText('Realized PnL', { exact: true })).toBeVisible({ timeout: 15_000 });

  await expect(page.locator('nav').first()).toBeVisible();
  const navLinkCount = await page.locator('nav a').count();
  expect(navLinkCount).toBeGreaterThan(0);
});

test('Journal trade ticker text is visible at 390px (BUG if fails: column hidden at mobile)', async ({ page }) => {
  // If this test fails, it means the ticker column collapses to zero at 390px mobile,
  // making the key trade information invisible. This is a mobile layout bug.
  await setupMobile(page);
  await page.goto('/journal');
  await expect(page.getByText('Win Rate', { exact: true })).toBeVisible({ timeout: 15_000 });

  // Check ticker text is visible in the trade rows
  const nvdaEl = page.locator('text=NVDA').first();
  const bbox = await nvdaEl.boundingBox();
  expect(bbox, 'NVDA ticker has no bounding box at 390px — column is collapsed').not.toBeNull();
  expect(bbox!.width, 'NVDA ticker column has zero width at 390px').toBeGreaterThan(0);
});
