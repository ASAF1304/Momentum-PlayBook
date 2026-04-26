// tests/e2e/playbook-live-pnl.spec.ts
// Visual verification: Playbook open-position cards show current price + P&L.

import { test } from '@playwright/test';

test('Playbook live P&L — screenshot open-position cards', async ({ page }) => {
  await page.goto('/playbook');
  // Wait for trade cards or empty state
  await page.waitForSelector('[class*="rounded-[12px]"]', { timeout: 20_000 }).catch(() => {});
  // Extra time for live-prices API round-trip (60s poll — first fetch fires immediately)
  await page.waitForTimeout(5_000);
  await page.screenshot({ path: 'tests/e2e/screenshots/playbook-live-pnl.png', fullPage: true });
});
