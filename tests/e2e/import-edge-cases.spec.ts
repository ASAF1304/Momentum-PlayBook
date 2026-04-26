// tests/e2e/import-edge-cases.spec.ts
//
// Verifies that broker-imported trades with edge-case data are handled
// correctly in the journal stats:
//
//   Case 1 – Empty exit fields: imported trades with exit_price=null and
//             exit_date=null should remain status='open' and not count toward
//             Win Rate.
//
//   Case 2 – DD/MM/YYYY dates stored correctly: phase1_date should arrive in
//             ISO format (2026-03-05, not 2026-05-03). Test indirectly via
//             the broker-parser-internal groupToTrades function to ensure
//             correct date sorting preserves correct buy-before-sell order.
//
//   Case 3 – Open trades with null outcome excluded: status='open', outcome=null
//             trades must not count toward Win Rate denominator.
//
//   Case 4 – Mixed open + closed: Win Rate = winners / closed only.
//             3 closed (2 winners, 1 loser) + 3 open → 66.7% Win Rate.

import { test, expect } from '@playwright/test';
import { groupToTrades } from '../../lib/broker-parser-internal';
import type { RawTransaction } from '../../lib/broker-parser';

// ── Shared session helpers ────────────────────────────────────────────────────

const SUPABASE_PROJECT_REF = 'xioitkanzawmouiiwhqs';
const COOKIE_NAME          = `sb-${SUPABASE_PROJECT_REF}-auth-token`;
const USER_ID              = '00000000-0000-0000-0000-000000000088';

function makeSessionCookie(): string {
  const session = {
    access_token:  `fake.access.${USER_ID}`,
    token_type:    'bearer',
    expires_in:    3600,
    expires_at:    Math.floor(Date.now() / 1000) + 3600,
    refresh_token: 'fake-refresh',
    user: {
      id:                 USER_ID,
      aud:                'authenticated',
      role:               'authenticated',
      email:              `${USER_ID}@example.com`,
      email_confirmed_at: '2026-01-01T00:00:00.000Z',
      app_metadata:       { provider: 'email' },
      user_metadata:      {},
      created_at:         '2026-01-01T00:00:00.000Z',
      updated_at:         '2026-01-01T00:00:00.000Z',
    },
  };
  const b64 = Buffer.from(JSON.stringify(session))
    .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return `base64-${b64}`;
}

const PROFILE = {
  id:                      USER_ID,
  display_name:            'ImportTest',
  account_size:            50000,
  max_risk_per_trade_pct:  2,
  max_stop_distance_pct:   8,
  accepted_terms_at:       '2026-01-01T00:00:00Z',
  dismissed_onboarding_at: '2026-01-01T00:00:00Z',
  created_at:              '2026-01-01T00:00:00Z',
};

const makeTrade = (
  i: number,
  outcome: 'winner' | 'loser' | 'breakeven' | null,
  status:  'open' | 'closed',
  overrides: Record<string, unknown> = {},
) => ({
  id:                   `itrade-${i}`,
  created_at:           '2026-01-01T00:00:00Z',
  ticker:               `IT${i}`,
  setup_type:           null,
  phase1_date:          '2026-01-05T12:00:00Z',
  phase1_price:         100,
  phase1_shares:        10,
  phase2_date: null, phase2_price: null, phase2_shares: null,
  initial_stop: 92, current_stop: 92, risk_dollars: 80,
  stop_distance_pct: 8, rs_rating: null, trend_template_passed: false,
  exit_date:   status === 'closed' ? '2026-02-01T00:00:00Z' : null,
  exit_price:  status === 'closed' ? (outcome === 'winner' ? 120 : outcome === 'loser' ? 85 : 100) : null,
  status,
  outcome,
  pnl_dollars: status === 'closed'
    ? (outcome === 'winner' ? 200 : outcome === 'loser' ? -150 : 0)
    : null,
  pnl_pct: null, r_multiple: null, notes: null, lesson_learned: null, screenshot_url: null,
  partials: [], current_shares: 10, is_what_if: true, failed_gates: null, what_if_reason: null,
  ...overrides,
});

async function setupMocks(
  page: import('@playwright/test').Page,
  trades: ReturnType<typeof makeTrade>[],
) {
  await page.addCookies([{
    name: COOKIE_NAME, value: makeSessionCookie(),
    domain: 'localhost', path: '/', httpOnly: false, secure: false, sameSite: 'Lax',
  }]);
  await page.route('**/rest/v1/trades*', r => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify(trades),
    headers: { 'content-range': `0-${trades.length - 1}/${trades.length}` },
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
    body: JSON.stringify({
      access_token: 'fake', token_type: 'bearer', expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r',
      user: { id: USER_ID },
    }),
  }));
}

// ── Case 1: empty exit fields stay 'open' ─────────────────────────────────────

test('Case 1 — imported trades with null exit_price remain open and are excluded from Win Rate', async ({ page }) => {
  // 2 winners (closed) + 1 imported trade with exit_price=null (should stay open)
  const trades = [
    makeTrade(1, 'winner', 'closed'),
    makeTrade(2, 'winner', 'closed'),
    // Simulates a corrupt row that migration 002 would have fixed on production,
    // but in test env we verify the app ignores it from Win Rate if status='open'.
    makeTrade(3, null, 'open', { exit_price: null, exit_date: null }),
  ];
  await setupMocks(page, trades);
  await page.goto('/journal');

  // Should show 100% (2 winners / 2 closed), not 66.7% if open trade were counted
  const winRateEl = page.locator('text=/\\d+\\.\\d+%|\\d+%/').first();
  await expect(winRateEl).toBeVisible({ timeout: 15_000 });
  const text = await winRateEl.textContent();
  expect(text).toContain('100');
});

// ── Case 2: date order preserved (DD/MM/YYYY parsed correctly by groupToTrades) ──

test('Case 2 — groupToTrades processes transactions in correct date order (buy before sell)', () => {
  // Simulate the Israeli date bug: if dates are WRONG (sell date < buy date),
  // the sell becomes an orphan. If dates are CORRECT, trade closes properly.
  const transactions: RawTransaction[] = [
    // Correct order: buy on Jan 5, sell on Feb 1
    { ticker: 'AAPL', action: 'buy',  quantity: 100, price: 150, date: '2026-01-05', fees: 1, currency: 'USD', isShort: false },
    { ticker: 'AAPL', action: 'sell', quantity: 100, price: 165, date: '2026-02-01', fees: 1, currency: 'USD', isShort: false },
  ];

  const { newTrades } = groupToTrades(transactions, 'ibi');
  expect(newTrades).toHaveLength(1);
  const trade = newTrades[0];
  expect(trade.status).toBe('closed');
  expect(trade.outcome).toBe('winner');
  expect(trade.pnl_dollars).toBeCloseTo(1500, 0); // (165-150)*100
});

test('Case 2b — swapped DD/MM/YYYY dates (sell before buy) produce orphan not closed trade', () => {
  // This reproduces the bug that migration 002 fixes: when dates are swapped,
  // the sell comes first, becomes an orphan, and the buy opens a new position.
  const transactions: RawTransaction[] = [
    // Swapped: "sell" date is earlier than "buy" date (the bug)
    { ticker: 'TEVA', action: 'sell', quantity: 100, price: 165, date: '2026-01-05', fees: 1, currency: 'USD', isShort: false },
    { ticker: 'TEVA', action: 'buy',  quantity: 100, price: 150, date: '2026-02-01', fees: 1, currency: 'USD', isShort: false },
  ];

  const { newTrades } = groupToTrades(transactions, 'ibi');
  // The sell with no prior buy becomes an orphan, and the buy opens a new position → 2 trades
  expect(newTrades).toHaveLength(2);
  const orphan = newTrades.find(t => t.isOrphan);
  expect(orphan).toBeTruthy();
  const openTrade = newTrades.find(t => t.status === 'open' && !t.isOrphan);
  expect(openTrade).toBeTruthy();
});

// ── Case 3: open trades with null outcome excluded from Win Rate ───────────────

test('Case 3 — open imported trades with null outcome do not count in Win Rate', async ({ page }) => {
  // 1 winner (closed) + 2 open imported trades with outcome=null
  const trades = [
    makeTrade(1, 'winner',  'closed'),
    makeTrade(2, null,      'open'),
    makeTrade(3, null,      'open'),
  ];
  await setupMocks(page, trades);
  await page.goto('/journal');

  // Win Rate = 1/1 = 100% (only 1 closed trade)
  const winRateEl = page.locator('text=/\\d+\\.\\d+%|\\d+%/').first();
  await expect(winRateEl).toBeVisible({ timeout: 15_000 });
  const text = await winRateEl.textContent();
  expect(text).toContain('100');
});

// ── Case 4: mixed open + closed — Win Rate = winners / closed only ─────────────

test('Case 4 — mixed open/closed: Win Rate uses only closed trades (66.7%)', async ({ page }) => {
  // 3 closed (2 winners, 1 loser) + 3 open = Win Rate 2/3 = 66.7%
  const trades = [
    makeTrade(1, 'winner', 'closed'),
    makeTrade(2, 'winner', 'closed'),
    makeTrade(3, 'loser',  'closed'),
    makeTrade(4, null,     'open'),
    makeTrade(5, null,     'open'),
    makeTrade(6, null,     'open'),
  ];
  await setupMocks(page, trades);
  await page.goto('/journal');

  const winRateEl = page.locator('text=/\\d+\\.\\d+%/').first();
  await expect(winRateEl).toBeVisible({ timeout: 15_000 });
  const text = await winRateEl.textContent();
  // 2/3 = 66.666...% rounded to 66.7
  expect(text).toContain('66.7');
});
