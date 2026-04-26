// tests/e2e/validator-trend-template.spec.ts
//
// End-to-end tests for the 3 new auto-computed Minervini gates:
//   above_ath_avwap, near_52wh, above_52wl
//
// Scenarios:
//   1. NVDA — live API, gates should show a value (not all gray)
//   2. LAGGARD_FIXTURE — mocked: all 3 auto gates fail (red)
//   3. NEW_IPO_FIXTURE — mocked: data_quality insufficient, all 3 gates gray
//   4. Ticker switch — stale gate state is cleared when ticker changes

import { test, expect } from '@playwright/test';
import laggardFixture from './fixtures/laggard-response.json';
import newIpoFixture  from './fixtures/new-ipo-response.json';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function waitForValidatorReady(page: import('@playwright/test').Page) {
  // Wait for auth loading spinner to disappear
  await page.waitForSelector('text=TICKER', { timeout: 20_000 });
}

async function fillTicker(page: import('@playwright/test').Page, symbol: string) {
  const input = page.locator('input[placeholder="TICKER"]');
  await input.clear();
  await input.fill(symbol);
}

// ── Test 1: NVDA live ─────────────────────────────────────────────────────────

test('NVDA live — auto gates show non-null values', async ({ page }) => {
  await page.goto('/');
  await waitForValidatorReady(page);
  await fillTicker(page, 'NVDA');

  // Wait for one of the auto gate rows to appear (API responds)
  const avwapGate = page.locator('[data-testid="gate-above_ath_avwap"]');
  await avwapGate.waitFor({ state: 'visible', timeout: 15_000 });

  // All 3 gates must have a state that is NOT 'insufficient' (data is available for NVDA)
  for (const key of ['above_ath_avwap', 'near_52wh', 'above_52wl']) {
    const gate  = page.locator(`[data-testid="gate-${key}"]`);
    const state = await gate.getAttribute('data-state');
    expect(['pass', 'fail'], `gate ${key} should be pass or fail, got: ${state}`).toContain(state);
  }

  await page.screenshot({ path: 'tests/e2e/screenshots/nvda.png' });
});

// ── Test 2: LAGGARD_FIXTURE — all auto gates fail ─────────────────────────────

test('LAGGARD fixture — all 3 auto gates are red (fail)', async ({ page }) => {
  await page.route('**/api/ticker/LAGGARD', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(laggardFixture) }),
  );

  await page.goto('/');
  await waitForValidatorReady(page);
  await fillTicker(page, 'LAGGARD');

  const avwapGate = page.locator('[data-testid="gate-above_ath_avwap"]');
  await avwapGate.waitFor({ state: 'visible', timeout: 10_000 });

  for (const key of ['above_ath_avwap', 'near_52wh', 'above_52wl']) {
    const gate  = page.locator(`[data-testid="gate-${key}"]`);
    const state = await gate.getAttribute('data-state');
    expect(state, `gate ${key} should be 'fail'`).toBe('fail');
  }
});

// ── Test 3: NEW_IPO_FIXTURE — all 3 auto gates gray (insufficient) ────────────

test('NEW_IPO fixture — all 3 auto gates are gray (insufficient)', async ({ page }) => {
  await page.route('**/api/ticker/NEWIPO', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(newIpoFixture) }),
  );

  await page.goto('/');
  await waitForValidatorReady(page);
  await fillTicker(page, 'NEWIPO');

  const avwapGate = page.locator('[data-testid="gate-above_ath_avwap"]');
  await avwapGate.waitFor({ state: 'visible', timeout: 10_000 });

  for (const key of ['above_ath_avwap', 'near_52wh', 'above_52wl']) {
    const gate  = page.locator(`[data-testid="gate-${key}"]`);
    const state = await gate.getAttribute('data-state');
    expect(state, `gate ${key} should be 'insufficient'`).toBe('insufficient');
  }

  // Insufficient data banner should be visible
  await expect(page.locator('text=Insufficient price history')).toBeVisible();
});

// ── Test 4: Ticker switch — stale state cleared ───────────────────────────────

test('Ticker switch — previous ticker gates cleared immediately', async ({ page }) => {
  // First mock LAGGARD (all fail) then switch to NEWIPO (all gray)
  await page.route('**/api/ticker/LAGGARD', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(laggardFixture) }),
  );
  await page.route('**/api/ticker/NEWIPO', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(newIpoFixture) }),
  );

  await page.goto('/');
  await waitForValidatorReady(page);

  // Load LAGGARD
  await fillTicker(page, 'LAGGARD');
  const avwapGate = page.locator('[data-testid="gate-above_ath_avwap"]');
  await avwapGate.waitFor({ state: 'visible', timeout: 10_000 });
  expect(await avwapGate.getAttribute('data-state')).toBe('fail');

  // Switch to NEWIPO — gates should immediately clear to 'insufficient'
  await fillTicker(page, 'NEWIPO');

  // After ticker change, the gates should reset to gray before new data arrives
  // (they may briefly disappear since data is null, then reappear)
  await avwapGate.waitFor({ state: 'visible', timeout: 10_000 });
  expect(await avwapGate.getAttribute('data-state')).toBe('insufficient');

  // Confirm no stale 'fail' state from previous ticker
  for (const key of ['above_ath_avwap', 'near_52wh', 'above_52wl']) {
    const gate  = page.locator(`[data-testid="gate-${key}"]`);
    const state = await gate.getAttribute('data-state');
    expect(state, `gate ${key} should not be stale 'fail' from LAGGARD`).toBe('insufficient');
  }
});
