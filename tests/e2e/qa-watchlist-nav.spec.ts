// tests/e2e/qa-watchlist-nav.spec.ts
//
// QA Audit — Watchlist CRUD + Navigation links
//
// Watchlist:
//   1. Watchlist renders with items from the DB
//   2. Watchlist shows add-ticker input when empty
//   3. Theme toggle button is visible in nav
//
// Navigation:
//   4. All nav links (Dashboard, Journal, Watchlist, Playbook) respond (no 404)
//   5. Public pages (pricing, legal) respond without auth
//   6. Settings page accessible when authenticated
//   7. Legal footer links on login page are all clickable

import { test, expect } from '@playwright/test';

const SUPABASE_PROJECT_REF = 'xioitkanzawmouiiwhqs';
const COOKIE_NAME          = `sb-${SUPABASE_PROJECT_REF}-auth-token`;
const USER_ID              = '00000000-0000-0000-0000-000000000401';

function makeSessionCookie(): string {
  const session = {
    access_token: `fake.access.${USER_ID}`,
    token_type: 'bearer', expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: 'fake-refresh',
    user: {
      id: USER_ID, aud: 'authenticated', role: 'authenticated',
      email: 'qa-watchlist@example.com', email_confirmed_at: '2026-01-01T00:00:00.000Z',
      app_metadata: { provider: 'email' }, user_metadata: {},
      created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
    },
  };
  const b64 = Buffer.from(JSON.stringify(session))
    .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return `base64-${b64}`;
}

async function setupSession(
  page: import('@playwright/test').Page,
  watchlistItems: unknown[] = [],
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
      id: USER_ID, display_name: 'QA User', account_size: 50000,
      max_risk_per_trade_pct: 2, max_stop_distance_pct: 8,
      accepted_terms_at: '2026-01-01T00:00:00Z', dismissed_onboarding_at: '2026-01-01T00:00:00Z',
      created_at: '2026-01-01T00:00:00Z', is_admin: false,
    }),
  }));
  await page.route('**/rest/v1/subscriptions*', r => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ status: 'active', trial_ends_at: null }),
  }));
  await page.route('**/rest/v1/watchlist_items*', r => {
    if (r.request().method() === 'GET') {
      return r.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify(watchlistItems),
      });
    }
    return r.fulfill({ status: 201, contentType: 'application/json', body: '{}' });
  });
  await page.route('**/rest/v1/trades*', r => r.fulfill({
    status: 200, contentType: 'application/json',
    body: '[]',
    headers: { 'content-range': '0-0/0' },
  }));
  await page.route('**/api/live-prices*', r => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ prices: {}, fetchedAt: new Date().toISOString() }),
  }));
  await page.route('**/rest/v1/stage2_leaders*', r => r.fulfill({
    status: 200, contentType: 'application/json', body: '[]',
  }));
}

// ── Watchlist tests ──────────────────────────────────────────────────────────

test('Watchlist renders items from the database', async ({ page }) => {
  const items = [
    { id: 'w1', user_id: USER_ID, ticker: 'NVDA', created_at: '2026-01-01T00:00:00Z' },
    { id: 'w2', user_id: USER_ID, ticker: 'AAPL', created_at: '2026-01-02T00:00:00Z' },
  ];
  await setupSession(page, items);
  await page.route('**/api/ticker/**', r => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ ticker: 'NVDA', price: 900, trend_template: true }),
  }));

  await page.goto('/watchlist');

  await expect(page.locator('text=NVDA').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('text=AAPL').first()).toBeVisible();
});

test('Watchlist shows add-ticker input when list is empty', async ({ page }) => {
  await setupSession(page, []);
  await page.goto('/watchlist');

  await expect(page.locator('input').first()).toBeVisible({ timeout: 15_000 });
});

// ── Navigation tests ─────────────────────────────────────────────────────────

test('Nav links: Dashboard, Journal, Watchlist, Playbook all respond (no 404)', async ({ page }) => {
  await setupSession(page, []);
  await page.route('**/api/ticker/**', r => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ ticker: 'AAPL', price: 200 }),
  }));

  const routes = ['/', '/journal', '/watchlist', '/playbook'];

  for (const route of routes) {
    await page.goto(route);
    await expect(page.locator('text=/404|not found/i').first()).not.toBeVisible({ timeout: 8_000 });
    await expect(page.locator('nav').first()).toBeVisible({ timeout: 8_000 });
  }
});

test('Public pages accessible without auth: /pricing, /legal/terms, /legal/privacy', async ({ page }) => {
  const publicRoutes = ['/pricing', '/legal/terms', '/legal/privacy', '/legal/disclaimer'];

  for (const route of publicRoutes) {
    const response = await page.goto(route);
    expect(response?.status()).not.toBe(404);
    await expect(page.locator('text=/404|not found/i').first()).not.toBeVisible({ timeout: 5_000 });
  }
});

test('Settings page accessible when authenticated', async ({ page }) => {
  await setupSession(page, []);
  await page.goto('/settings');

  // Settings page is in Hebrew — "הגדרות" is the page heading, tabs are "חשבון" and "חיוב"
  await expect(page.locator('text=הגדרות').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('text=/404|not found/i').first()).not.toBeVisible();
});

test('Legal footer links on login page are all clickable', async ({ page }) => {
  await page.goto('/login');

  await expect(page.locator('a[href="/legal/disclaimer"]').first()).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('a[href="/legal/terms"]').first()).toBeVisible();
  await expect(page.locator('a[href="/legal/privacy"]').first()).toBeVisible();
});

test('Theme toggle button is visible in nav', async ({ page }) => {
  await setupSession(page, []);
  await page.goto('/');

  await expect(page.getByText('Realized PnL', { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('nav button').first()).toBeVisible();
});
