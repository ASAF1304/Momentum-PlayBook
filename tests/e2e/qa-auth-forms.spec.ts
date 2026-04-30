// tests/e2e/qa-auth-forms.spec.ts
//
// QA Audit — Auth form behavior
//   1. Login form renders with all expected fields
//   2. Wrong password → Supabase error shown in UI
//   3. Forgot password link visible
//   4. Signup link present on login page
//   5. Signup: passwords don't match → client validation error
//   6. Signup: password too short → client validation error
//   7. Signup: terms not accepted → client validation error
//   8. Signup: duplicate email → Supabase error shown

import { test, expect } from '@playwright/test';

// ── Login form tests ─────────────────────────────────────────────────────────

test('Login page renders email, password, and submit button', async ({ page }) => {
  await page.goto('/login');
  await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('input[type="password"]')).toBeVisible();
  await expect(page.locator('button[type="submit"]')).toBeVisible();
});

test('Login with wrong password shows error message', async ({ page }) => {
  await page.route('**/auth/v1/token*', r => r.fulfill({
    status:      400,
    contentType: 'application/json',
    body:        JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid login credentials' }),
  }));

  await page.goto('/login');
  await page.locator('input[type="email"]').fill('user@example.com');
  await page.locator('input[type="password"]').fill('wrongpassword');
  await page.locator('button[type="submit"]').click();

  await expect(page.locator('text=/invalid login credentials/i').first()).toBeVisible({ timeout: 10_000 });
});

test('Forgot password link is visible on login page', async ({ page }) => {
  await page.goto('/login');
  await expect(page.locator('a[href="/auth/forgot-password"]')).toBeVisible({ timeout: 10_000 });
});

test('Signup link leads to /signup on login page', async ({ page }) => {
  await page.goto('/login');
  await expect(page.locator('a[href="/signup"]')).toBeVisible({ timeout: 10_000 });
});

// ── Signup form validation ────────────────────────────────────────────────────

test('Signup: passwords do not match → client validation error', async ({ page }) => {
  await page.goto('/signup');
  await page.locator('input[type="email"]').fill('new@example.com');

  const pwdInputs = page.locator('input[type="password"]');
  await pwdInputs.nth(0).fill('password123');
  await pwdInputs.nth(1).fill('differentpassword');

  const checkbox = page.locator('input[type="checkbox"]');
  if (await checkbox.count() > 0) await checkbox.first().check();

  await page.locator('button[type="submit"]').click();
  await expect(page.locator('text=/do not match/i').first()).toBeVisible({ timeout: 5_000 });
});

test('Signup: password too short → client validation error', async ({ page }) => {
  await page.goto('/signup');
  await page.locator('input[type="email"]').fill('new@example.com');

  const pwdInputs = page.locator('input[type="password"]');
  await pwdInputs.nth(0).fill('abc');
  await pwdInputs.nth(1).fill('abc');

  const checkbox = page.locator('input[type="checkbox"]');
  if (await checkbox.count() > 0) await checkbox.first().check();

  await page.locator('button[type="submit"]').click();
  await expect(page.locator('text=/at least 6/i').first()).toBeVisible({ timeout: 5_000 });
});

test('Signup: terms not accepted → client validation error', async ({ page }) => {
  await page.goto('/signup');
  await page.locator('input[type="email"]').fill('new@example.com');

  const pwdInputs = page.locator('input[type="password"]');
  await pwdInputs.nth(0).fill('validpassword');
  await pwdInputs.nth(1).fill('validpassword');

  // Don't check the terms box — submit via Enter key (bypasses potential disabled state)
  await page.route('**/auth/v1/signup*', r => r.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ user: null, session: null }),
  }));

  await page.locator('input[type="email"]').press('Enter');
  await expect(page.locator('text=/תנאי|terms/i').first()).toBeVisible({ timeout: 5_000 });
});

test('Signup: duplicate email shows Supabase error', async ({ page }) => {
  await page.route('**/auth/v1/signup*', r => r.fulfill({
    status:      422,
    contentType: 'application/json',
    body:        JSON.stringify({ msg: 'User already registered', code: 'user_already_exists' }),
  }));

  await page.goto('/signup');
  await page.locator('input[type="email"]').fill('existing@example.com');

  const pwdInputs = page.locator('input[type="password"]');
  await pwdInputs.nth(0).fill('validpassword');
  await pwdInputs.nth(1).fill('validpassword');

  const checkbox = page.locator('input[type="checkbox"]');
  if (await checkbox.count() > 0) await checkbox.first().check();

  await page.locator('button[type="submit"]').click();
  await expect(page.locator('text=/already registered|already exists/i').first()).toBeVisible({ timeout: 10_000 });
});
