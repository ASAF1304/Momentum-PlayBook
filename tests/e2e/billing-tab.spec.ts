// tests/e2e/billing-tab.spec.ts
//
// Verifies the billing tab in /settings:
//   Case 1 — grace user sees the "תקופת חסד" banner
//   Case 2 — active user sees the "מנוי פעיל" banner and Manage button
//   Case 3 — expired_grace user sees the add-card CTA
//   Case 4 — billing tab is accessible via ?tab=billing URL param

import { test, expect } from '@playwright/test';

const SUPABASE_PROJECT_REF = 'xioitkanzawmouiiwhqs';
const COOKIE_NAME          = `sb-${SUPABASE_PROJECT_REF}-auth-token`;
const USER_ID              = '00000000-0000-0000-0000-000000000077';

function makeSessionCookie(): string {
  const session = {
    access_token:  `fake.access.${USER_ID}`,
    token_type:    'bearer',
    expires_in:    3600,
    expires_at:    Math.floor(Date.now() / 1000) + 3600,
    refresh_token: 'fake-refresh',
    user: {
      id: USER_ID, aud: 'authenticated', role: 'authenticated',
      email: `${USER_ID}@example.com`, email_confirmed_at: '2026-01-01T00:00:00.000Z',
      app_metadata: { provider: 'email' }, user_metadata: {},
      created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
    },
  };
  const b64 = Buffer.from(JSON.stringify(session))
    .toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  return `base64-${b64}`;
}

async function setupSession(page: import('@playwright/test').Page, subStatus: string, trialEnd?: string) {
  await page.context().addCookies([{
    name: COOKIE_NAME, value: makeSessionCookie(),
    domain: 'localhost', path: '/', httpOnly: false, secure: false, sameSite: 'Lax',
  }]);
  await page.route('**/auth/v1/token*', r => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ access_token: 'fake', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r', user: { id: USER_ID } }),
  }));
  await page.route('**/auth/v1/user', r => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({
      id: USER_ID, aud: 'authenticated', role: 'authenticated',
      email: `${USER_ID}@example.com`, email_confirmed_at: '2026-01-01T00:00:00.000Z',
      app_metadata: { provider: 'email' }, user_metadata: {},
      created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
    }),
  }));
  await page.route('**/rest/v1/user_profiles*', r => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({
      id: USER_ID, display_name: 'Test User', account_size: 50000,
      max_risk_per_trade_pct: 2, max_stop_distance_pct: 8,
      accepted_terms_at: '2026-01-01T00:00:00Z', dismissed_onboarding_at: '2026-01-01T00:00:00Z',
      created_at: '2026-01-01T00:00:00Z', is_admin: false,
    }),
  }));
  await page.route('**/rest/v1/subscriptions*', r => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({
      id: 'sub-1', user_id: USER_ID,
      status: subStatus,
      trial_ends_at: trialEnd ?? null,
      current_period_end: null,
      paddle_customer_id: null, paddle_sub_id: null,
      created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
    }),
  }));
  await page.route('**/api/live-prices', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ prices: {}, fetchedAt: new Date().toISOString() }) }));
  await page.route('**/rest/v1/stage2_leaders*', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/rest/v1/trades*', r => r.fulfill({ status: 200, contentType: 'application/json', body: '[]', headers: { 'content-range': '0-0/0' } }));
}

// Case 1: grace user sees the grace banner
test('grace user sees "תקופת חסד" banner in billing tab', async ({ page }) => {
  const trialEnd = new Date(Date.now() + 20 * 86_400_000).toISOString();
  await setupSession(page, 'grace', trialEnd);

  await page.goto('/settings?tab=billing');

  await expect(page.getByText('תקופת חסד')).toBeVisible({ timeout: 15_000 });
});

// Case 2: active user sees "מנוי פעיל" banner
test('active user sees "מנוי פעיל" banner in billing tab', async ({ page }) => {
  await setupSession(page, 'active');

  await page.goto('/settings?tab=billing');

  await expect(page.getByText('מנוי פעיל')).toBeVisible({ timeout: 15_000 });
});

// Case 3: expired_grace user sees add-card CTA
test('expired_grace user sees "הוסף כרטיס" CTA in billing tab', async ({ page }) => {
  await setupSession(page, 'expired_grace');

  await page.goto('/settings?tab=billing');

  await expect(page.getByText('תקופת החסד הסתיימה')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: /הוסף כרטיס/i })).toBeVisible();
});

// Case 4: billing tab accessible via ?tab=billing URL param
test('settings?tab=billing loads billing tab directly', async ({ page }) => {
  const trialEnd = new Date(Date.now() + 10 * 86_400_000).toISOString();
  await setupSession(page, 'grace', trialEnd);

  await page.goto('/settings?tab=billing');

  // Wait for auth to complete + billing tab content to appear
  await expect(page.getByText('תקופת חסד')).toBeVisible({ timeout: 15_000 });
});
