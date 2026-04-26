// tests/e2e/multi-device-login.spec.ts
// Verifies that signing out from one browser context does NOT affect a second
// context that's logged in simultaneously (multi-device isolation).
//
// Each browser context gets its own cookie jar — they are fully independent,
// matching the real multi-device scenario (each device has its own session).

import { test, expect, chromium } from '@playwright/test';

const SUPABASE_PROJECT_REF = 'xioitkanzawmouiiwhqs';

function makeSessionCookie(userId: string, expiresIn = 3600): string {
  const session = {
    access_token:  `fake.access.${userId}`,
    token_type:    'bearer',
    expires_in:    expiresIn,
    expires_at:    Math.floor(Date.now() / 1000) + expiresIn,
    refresh_token: `fake-refresh-${userId}`,
    user: {
      id:              userId,
      aud:             'authenticated',
      role:            'authenticated',
      email:           `${userId}@example.com`,
      email_confirmed_at: '2026-01-01T00:00:00.000Z',
      app_metadata:    { provider: 'email' },
      user_metadata:   {},
      created_at:      '2026-01-01T00:00:00.000Z',
      updated_at:      '2026-01-01T00:00:00.000Z',
    },
  };
  const b64 = Buffer.from(JSON.stringify(session))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  return `base64-${b64}`;
}

const COOKIE_NAME = `sb-${SUPABASE_PROJECT_REF}-auth-token`;
const USER_ID = '00000000-0000-0000-0000-000000000002';

async function mockStubs(page: import('@playwright/test').Page) {
  await page.route('**/rest/v1/trades*', r => r.fulfill({ status: 200, body: '[]', contentType: 'application/json', headers: { 'content-range': '0-0/0' } }));
  await page.route('**/rest/v1/user_profiles*', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: USER_ID, display_name: 'Test', account_size: 10000, max_risk_per_trade_pct: 1, max_stop_distance_pct: 8, created_at: '2026-01-01T00:00:00.000Z' }) }));
  await page.route('**/api/live-prices', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ prices: {}, fetchedAt: new Date().toISOString() }) }));
  await page.route('**/rest/v1/stage2_leaders*', r => r.fulfill({ status: 200, body: '[]', contentType: 'application/json' }));
  await page.route('**/auth/v1/token*', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'fake', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r', user: { id: USER_ID } }) }));
}

test('Multi-device: both contexts stay authenticated independently', async () => {
  const browser = await chromium.launch();

  // ── Context A (Device A) ────────────────────────────────────────────────────
  const ctxA = await browser.newContext();
  const pageA = await ctxA.newPage();

  await ctxA.addCookies([{
    name: COOKIE_NAME, value: makeSessionCookie(USER_ID),
    domain: 'localhost', path: '/', httpOnly: false, secure: false, sameSite: 'Lax',
  }]);
  await mockStubs(pageA);
  await pageA.goto('http://localhost:3000/');
  // Dashboard should load (not redirect to /login)
  await expect(pageA).not.toHaveURL(/\/login/, { timeout: 10_000 });

  // ── Context B (Device B) ────────────────────────────────────────────────────
  const ctxB = await browser.newContext();
  const pageB = await ctxB.newPage();

  await ctxB.addCookies([{
    name: COOKIE_NAME, value: makeSessionCookie(USER_ID),
    domain: 'localhost', path: '/', httpOnly: false, secure: false, sameSite: 'Lax',
  }]);
  await mockStubs(pageB);
  await pageB.goto('http://localhost:3000/');
  await expect(pageB).not.toHaveURL(/\/login/, { timeout: 10_000 });

  // ── Simulate sign-out on Device A (scope: 'local') ─────────────────────────
  // Stub Supabase's signOut endpoint to succeed (scope=local)
  await pageA.route('**/auth/v1/logout*', r => r.fulfill({ status: 200, body: '{}', contentType: 'application/json' }));
  // Remove cookie from context A to simulate local sign-out
  await ctxA.clearCookies();

  // ── Device B cookie is untouched — context B should still have its session ──
  const cookiesB = await ctxB.cookies('http://localhost:3000');
  const authCookieB = cookiesB.find(c => c.name === COOKIE_NAME);
  expect(authCookieB, 'Device B session cookie must still exist after Device A signs out').toBeTruthy();

  // Navigate Device B — should NOT be redirected to login.
  // Route stubs from earlier mockStubs() call are still active; don't re-register.
  await pageB.goto('http://localhost:3000/');
  await expect(pageB).not.toHaveURL(/\/login/, { timeout: 10_000 });

  await pageA.screenshot({ path: 'tests/e2e/screenshots/multi-device-ctxA-signout.png' });
  await pageB.screenshot({ path: 'tests/e2e/screenshots/multi-device-ctxB-still-in.png' });

  await browser.close();
});
