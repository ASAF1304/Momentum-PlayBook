// tests/e2e/forgot-password.spec.ts
// Tests the password reset UI flow.

import { test, expect } from '@playwright/test';

test('Login page → forgot-password link navigates to /auth/forgot-password', async ({ page }) => {
  await page.goto('/login');
  await expect(page.locator('text=שכחתי סיסמה')).toBeVisible({ timeout: 10_000 });
  await page.locator('text=שכחתי סיסמה').click();
  await expect(page).toHaveURL('/auth/forgot-password', { timeout: 5_000 });
});

test('/auth/forgot-password — submit email shows vague success message', async ({ page }) => {
  // Stub the Supabase auth password recovery endpoint so we don't hit real Supabase
  await page.route('**/auth/v1/recover*', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.goto('/auth/forgot-password');
  await expect(page.locator('text=שלח לי קישור לאיפוס')).toBeVisible({ timeout: 10_000 });

  await page.fill('input[type="email"]', 'test@example.com');
  await page.locator('text=שלח לי קישור לאיפוס').click();

  // Should show the deliberately vague success message — same regardless of whether email exists
  await expect(page.locator('text=אם הכתובת קיימת במערכת, שלחנו אליה קישור לאיפוס')).toBeVisible({ timeout: 8_000 });

  await page.screenshot({ path: 'tests/e2e/screenshots/forgot-password-sent.png' });
});

test('/auth/forgot-password — back to login link works', async ({ page }) => {
  await page.goto('/auth/forgot-password');
  const backLink = page.locator('text=← חזרה להתחברות');
  await expect(backLink).toBeVisible({ timeout: 10_000 });
  await backLink.click();
  await expect(page).toHaveURL('/login', { timeout: 5_000 });
});

test('/auth/reset-password — page renders with loading state', async ({ page }) => {
  await page.goto('/auth/reset-password');
  // Should show the logo and either the loading state or the password form
  await expect(page.locator('text=Momentum Playbook').first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('heading', { name: 'סיסמה חדשה' })).toBeVisible({ timeout: 5_000 });
  await page.screenshot({ path: 'tests/e2e/screenshots/reset-password-page.png' });
});
