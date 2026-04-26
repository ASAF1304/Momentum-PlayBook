// tests/e2e/win-rate-consistency.spec.ts
//
// Verifies that /journal and /playbook show the same Win Rate for the same
// set of 10 mocked trades (7 closed: 4 winners + 2 losers + 1 breakeven).
// Expected Win Rate: 4/7 = 57.1%

import { test, expect } from '@playwright/test';

const SUPABASE_PROJECT_REF = 'xioitkanzawmouiiwhqs';
const COOKIE_NAME          = `sb-${SUPABASE_PROJECT_REF}-auth-token`;
const USER_ID              = '00000000-0000-0000-0000-000000000099';

function makeSessionCookie(): string {
  const session = {
    access_token: `fake.access.${USER_ID}`,
    token_type:   'bearer',
    expires_in:   3600,
    expires_at:   Math.floor(Date.now() / 1000) + 3600,
    refresh_token: 'fake-refresh',
    user: {
      id: USER_ID,
      aud: 'authenticated',
      role: 'authenticated',
      email: `${USER_ID}@example.com`,
      email_confirmed_at: '2026-01-01T00:00:00.000Z',
      app_metadata: { provider: 'email' },
      user_metadata: {},
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
    },
  };
  const b64 = Buffer.from(JSON.stringify(session))
    .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return `base64-${b64}`;
}

const makeTrade = (i: number, outcome: 'winner' | 'loser' | 'breakeven' | null, status: 'open' | 'closed') => ({
  id: `trade-${i}`,
  created_at: '2026-01-01T00:00:00Z',
  ticker: `TICK${i}`,
  setup_type: null,
  phase1_date: '2026-01-01T00:00:00Z',
  phase1_price: 100,
  phase1_shares: 10,
  phase2_date: null, phase2_price: null, phase2_shares: null,
  initial_stop: 92, current_stop: 92, risk_dollars: 80,
  stop_distance_pct: 8, rs_rating: null, trend_template_passed: false,
  exit_date: status === 'closed' ? '2026-02-01T00:00:00Z' : null,
  exit_price: status === 'closed' ? (outcome === 'winner' ? 120 : outcome === 'loser' ? 85 : 100) : null,
  status,
  outcome,
  pnl_dollars: status === 'closed' ? (outcome === 'winner' ? 200 : outcome === 'loser' ? -150 : 0) : null,
  pnl_pct: null, r_multiple: null, notes: null, lesson_learned: null, screenshot_url: null,
  partials: [], current_shares: 10, is_what_if: false, failed_gates: null, what_if_reason: null,
});

// 4 winners, 2 losers, 1 breakeven, 3 open = 7 closed, Win Rate = 57.1%
const MOCK_TRADES = [
  makeTrade(1, 'winner',    'closed'),
  makeTrade(2, 'winner',    'closed'),
  makeTrade(3, 'winner',    'closed'),
  makeTrade(4, 'winner',    'closed'),
  makeTrade(5, 'loser',     'closed'),
  makeTrade(6, 'loser',     'closed'),
  makeTrade(7, 'breakeven', 'closed'),
  makeTrade(8, null,  'open'),
  makeTrade(9, null,  'open'),
  makeTrade(10, null, 'open'),
];

const PROFILE = {
  id: USER_ID,
  display_name: 'Test',
  account_size: 50000,
  max_risk_per_trade_pct: 2,
  max_stop_distance_pct: 8,
  accepted_terms_at: '2026-01-01T00:00:00Z',
  dismissed_onboarding_at: '2026-01-01T00:00:00Z',
  created_at: '2026-01-01T00:00:00Z',
};

async function setupMocks(page: import('@playwright/test').Page) {
  await page.context().addCookies([{
    name: COOKIE_NAME, value: makeSessionCookie(),
    domain: 'localhost', path: '/', httpOnly: false, secure: false, sameSite: 'Lax',
  }]);
  await page.route('**/rest/v1/trades*', r => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify(MOCK_TRADES),
    headers: { 'content-range': `0-9/${MOCK_TRADES.length}` },
  }));
  await page.route('**/rest/v1/user_profiles*', r => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(PROFILE),
  }));
  await page.route('**/rest/v1/subscriptions*', r => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ status: 'active', trial_ends_at: null }),
  }));
  await page.route('**/api/live-prices', r => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ prices: {}, fetchedAt: new Date().toISOString() }),
  }));
  await page.route('**/rest/v1/stage2_leaders*', r => r.fulfill({
    status: 200, contentType: 'application/json', body: '[]',
  }));
  await page.route('**/auth/v1/token*', r => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ access_token: 'fake', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r', user: { id: USER_ID } }),
  }));
}

test('Win Rate is identical between /journal and /playbook', async ({ page }) => {
  await setupMocks(page);

  // Check /journal Win Rate
  await page.goto('/journal');
  // Wait for trades to load (look for a stat card with %)
  const journalWinRate = page.locator('text=/\\d+\\.\\d+%/').first();
  await expect(journalWinRate).toBeVisible({ timeout: 15_000 });
  const journalText = await journalWinRate.textContent();

  // Check /playbook Win Rate
  await page.goto('/playbook');
  const playbookWinRate = page.locator('text=/\\d+\\.\\d+%/').first();
  await expect(playbookWinRate).toBeVisible({ timeout: 15_000 });
  const playbookText = await playbookWinRate.textContent();

  expect(journalText).toBe(playbookText);
  // Both should show 57.1% (4/7 closed trades are winners)
  expect(journalText).toContain('57.1');
});
