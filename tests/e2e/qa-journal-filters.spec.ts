// tests/e2e/qa-journal-filters.spec.ts
//
// QA Audit — Journal page
//   1. Loads and shows stat cards
//   2. "Open" filter → only open trades in list
//   3. "Closed" filter → only closed trades in list
//   4. "Closed" filter with no closed trades → empty state shown
//   5. Clicking a trade row opens the detail panel
//   6. Empty state shown when no trades at all
//   7. Win Rate stat shows correct percentage

import { test, expect } from '@playwright/test';

const SUPABASE_PROJECT_REF = 'xioitkanzawmouiiwhqs';
const COOKIE_NAME          = `sb-${SUPABASE_PROJECT_REF}-auth-token`;
const USER_ID              = '00000000-0000-0000-0000-000000000201';

function makeSessionCookie(): string {
  const session = {
    access_token: `fake.access.${USER_ID}`,
    token_type: 'bearer', expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: 'fake-refresh',
    user: {
      id: USER_ID, aud: 'authenticated', role: 'authenticated',
      email: 'qa-journal@example.com', email_confirmed_at: '2026-01-01T00:00:00.000Z',
      app_metadata: { provider: 'email' }, user_metadata: {},
      created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
    },
  };
  const b64 = Buffer.from(JSON.stringify(session))
    .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return `base64-${b64}`;
}

const makeTrade = (i: number, status: 'open' | 'closed', outcome: 'winner' | 'loser' | null = null, ticker = `TICK${i}`) => ({
  id:                   `qa-trade-${i}`,
  created_at:           '2026-01-01T00:00:00Z',
  ticker,
  setup_type:           null,
  phase1_date:          '2026-01-05T12:00:00Z',
  phase1_price:         100,
  phase1_shares:        10,
  phase2_date: null, phase2_price: null, phase2_shares: null,
  initial_stop: 92, current_stop: 92, risk_dollars: 80,
  stop_distance_pct: 8, rs_rating: null, trend_template_passed: false,
  exit_date:   status === 'closed' ? '2026-02-15T12:00:00Z' : null,
  exit_price:  status === 'closed' ? (outcome === 'winner' ? 120 : 85) : null,
  status,
  outcome:     status === 'closed' ? (outcome ?? 'winner') : null,
  pnl_dollars: status === 'closed' ? (outcome === 'winner' ? 200 : -150) : null,
  pnl_pct: null, r_multiple: null, notes: null, lesson_learned: null,
  screenshot_url: null, partials: [], current_shares: 10,
  is_what_if: false, failed_gates: null, what_if_reason: null, is_short: false,
});

async function setupJournal(
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

test('Journal loads trades and shows stat cards', async ({ page }) => {
  const trades = [
    makeTrade(1, 'closed', 'winner'),
    makeTrade(2, 'closed', 'loser'),
    makeTrade(3, 'open', null),
  ];
  await setupJournal(page, trades);
  await page.goto('/journal');

  await expect(page.getByText('Win Rate').first()).toBeVisible({ timeout: 15_000 });
});

test('Journal "Open" filter shows only open trades', async ({ page }) => {
  const trades = [
    makeTrade(1, 'closed', 'winner', 'AAPL'),
    makeTrade(2, 'closed', 'loser',  'MSFT'),
    makeTrade(3, 'open',   null,     'NVDA'),
    makeTrade(4, 'open',   null,     'TSLA'),
  ];
  await setupJournal(page, trades);
  await page.goto('/journal');
  await expect(page.locator('text=NVDA').first()).toBeVisible({ timeout: 15_000 });

  // Filter tab buttons include a count badge (e.g. "Open 3"), so use hasText
  await page.locator('button').filter({ hasText: /^Open/ }).first().click();

  await expect(page.locator('text=NVDA').first()).toBeVisible({ timeout: 5_000 });
  await expect(page.locator('text=TSLA').first()).toBeVisible();
  await expect(page.locator('text=AAPL')).not.toBeVisible();
  await expect(page.locator('text=MSFT')).not.toBeVisible();
});

test('Journal "Closed" filter shows only closed trades', async ({ page }) => {
  const trades = [
    makeTrade(1, 'closed', 'winner', 'GOOG'),
    makeTrade(2, 'open',   null,     'AMZN'),
  ];
  await setupJournal(page, trades);
  await page.goto('/journal');
  await expect(page.locator('text=GOOG').first()).toBeVisible({ timeout: 15_000 });

  await page.locator('button').filter({ hasText: /^Closed/ }).first().click();

  await expect(page.locator('text=GOOG').first()).toBeVisible({ timeout: 5_000 });
  await expect(page.locator('text=AMZN')).not.toBeVisible();
});

test('Journal "Closed" filter with no closed trades shows empty state', async ({ page }) => {
  const trades = [
    makeTrade(1, 'open', null, 'NVDA'),
  ];
  await setupJournal(page, trades);
  await page.goto('/journal');
  await expect(page.locator('text=NVDA').first()).toBeVisible({ timeout: 15_000 });

  await page.locator('button').filter({ hasText: /^Closed/ }).first().click();

  await expect(page.locator('text=/No closed trades|Switch to/i').first()).toBeVisible({ timeout: 5_000 });
});

test('Clicking a trade row opens the detail panel with correct ticker', async ({ page }) => {
  const trades = [
    makeTrade(1, 'closed', 'winner', 'META'),
    makeTrade(2, 'open',   null,     'SNAP'),
  ];
  await setupJournal(page, trades);
  await page.goto('/journal');

  await expect(page.locator('text=META').first()).toBeVisible({ timeout: 15_000 });

  // Click the first trade row
  await page.locator('text=META').first().click();

  // Detail panel opens — ticker appears in the modal header
  await expect(page.locator('text=META').nth(1)).toBeVisible({ timeout: 5_000 });
});

test('Journal empty state shows helpful message when no trades exist', async ({ page }) => {
  await setupJournal(page, []);
  await page.goto('/journal');

  await expect(page.getByText('No trades logged yet')).toBeVisible({ timeout: 15_000 });
});

test('Win Rate stat card shows correct percentage for 3 closed trades (2W 1L = 66.7%)', async ({ page }) => {
  const trades = [
    makeTrade(1, 'closed', 'winner'),
    makeTrade(2, 'closed', 'winner'),
    makeTrade(3, 'closed', 'loser'),
  ];
  await setupJournal(page, trades);
  await page.goto('/journal');

  await expect(page.locator('text=/66\\.7%|66\\.6%/').first()).toBeVisible({ timeout: 15_000 });
});
