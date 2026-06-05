# Bug Audit Report — 2026-05-08

## Summary
- **Total issues found:** 27
- **Critical:** 4
- **High:** 7
- **Medium:** 9
- **Low:** 7

---

## Critical Bugs (block production use)

### [CRIT-1] Stage 2 Leaders cron silently fails — no write RLS policy exists
- **File:** `app/api/cron/scan-leaders/route.ts:297–334`
- **Symptom:** Users always see stale / empty Stage 2 Leaders data. The cron runs on schedule but inserts nothing.
- **Root cause:** The cron uses `supabaseAnon` (anon key). Migration 001 explicitly states "only service_role may write" and creates **no** anon INSERT/DELETE policy on `stage2_leaders`. Every DELETE + INSERT is silently rejected by RLS. The route's comment (`"RLS policies must allow anon INSERT"`) directly contradicts the migration — they are out of sync.
- **Reproduction:** Run the cron endpoint manually; check Supabase logs — all writes return RLS violations. The `data` array shows new leaders but the table remains empty.
- **Suggested fix:** Either (a) switch the cron client to `getServiceClient()` (service role bypasses RLS — matches every other write path), or (b) add explicit anon write policies in the migration. Option (a) is simpler.

---

### [CRIT-2] `start-trial` route has a race condition; duplicate grace subscriptions possible
- **File:** `app/api/start-trial/route.ts:29–44`
- **Symptom:** In a rare race, a user gets two `grace` subscription rows, causing confusing UI state and potentially doubling the trial period.
- **Root cause:** The idempotency check (`maybeSingle()` → if exists return early → else insert) is **not atomic**. Two concurrent requests race past the existence check. The `subscriptions` table has no `UNIQUE (user_id)` constraint (only an index), so both inserts succeed. Also: no CSRF protection — any authenticated page can trigger a POST to this endpoint cross-origin.
- **Reproduction:** Send two simultaneous `POST /api/start-trial` requests from the same session.
- **Suggested fix:** Add `UNIQUE (user_id)` constraint to `subscriptions` table and use `INSERT … ON CONFLICT (user_id) DO NOTHING`. Add an `Origin` header check in the route.

---

### [CRIT-3] Admin page is gated client-side only; `is_admin` can be stale (5-min cache)
- **File:** `app/admin/users/page.tsx:70–75`; `lib/auth-context.tsx` (5-min cache)
- **Symptom:** A user whose admin rights were just revoked can still access the admin UI for up to 5 minutes. A user who inspects/modifies React state can bypass the redirect entirely.
- **Root cause:** The redirect `router.replace('/')` fires client-side using the cached `profile?.is_admin` flag. The cache TTL is 5 minutes. There is no `app/admin/layout.tsx` with a server-side auth check.
- **Reproduction:** Log in as admin. Revoke `is_admin` in DB. Admin page still accessible for up to 5 minutes.
- **Suggested fix:** Add `app/admin/layout.tsx` as a Server Component that calls `getUser()` + checks `is_admin` from DB before rendering children. Return `notFound()` or redirect if not admin.

---

### [CRIT-4] Personal email hardcoded in production RLS policy (PII in source code)
- **File:** `supabase/migrations/005_asaf_thoughts.sql:22,26,30`
- **Symptom:** `asaf.abllin@gmail.com` is burned into version-controlled SQL migrations forever. Cannot be changed without a new migration that exposes the new email.
- **Root cause:** `(auth.jwt() ->> 'email') = 'asaf.abllin@gmail.com'` used as the write guard instead of the existing `is_admin` flag in `user_profiles`.
- **Reproduction:** `git log --all -S "abllin"` — email is in commit history permanently.
- **Suggested fix:** Replace the email check with `(SELECT is_admin FROM public.user_profiles WHERE id = auth.uid()) = true` — identical to the pattern in migrations 003/004. Write a new migration 006 to drop and recreate these policies.

---

## High Bugs (degrade key flows)

### [HIGH-1] `blocked` users bypass the /blocked redirect when Paddle is disabled
- **File:** `middleware.ts:84–97`
- **Symptom:** In non-Paddle environments (or when `NEXT_PUBLIC_PADDLE_PRICE_ID` is unset), blocked users land on the dashboard instead of `/blocked`.
- **Root cause:** The `if (status === 'blocked') return redirect('/blocked')` check (line 85) is **inside** the `if (PADDLE_ENABLED)` block. When Paddle is not configured, the subscription guard is skipped entirely, so blocked users pass through.
- **Suggested fix:** Move the `blocked` → `/blocked` redirect **outside** the `PADDLE_ENABLED` guard. It should fire unconditionally for any authenticated user with `status = 'blocked'`.

---

### [HIGH-2] Password reset form activates for already-logged-in users (wrong auth event)
- **File:** `app/auth/reset-password/page.tsx:31–39`
- **Symptom:** Any logged-in user who navigates to `/auth/reset-password` directly (without a reset link) sees the password change form immediately and can change their password without email confirmation.
- **Root cause:** The `onAuthStateChange` listener sets `ready = true` on `event === 'SIGNED_IN'` (too broad). A `SIGNED_IN` event fires immediately from the existing session. The fallback `getSession()` check (line 37–39) also always enables the form for any authenticated session.
- **Suggested fix:** Only set `ready = true` on `event === 'PASSWORD_RECOVERY'`. Remove the `getSession()` fallback.

---

### [HIGH-3] Unrealized PnL uses `phase1_price` instead of weighted average entry
- **File:** `lib/stats/dashboard-stats.ts:104–113`
- **Symptom:** Scaled-in positions (e.g. bought 100 @ $100 then 100 @ $120) show incorrect unrealized PnL. Users see inflated gains.
- **Root cause:** `computeUnrealizedPnL` calculates `(livePrice - trade.phase1_price) × shares`. For any scale-in buy, `phase1_price` is the first lot only, not the average cost basis. `computeAvgEntry()` already exists in `lib/trade-utils.ts` but is not called here.
- **Suggested fix:** Import and call `computeAvgEntry(trade)` from `lib/trade-utils.ts` instead of `trade.phase1_price`.

---

### [HIGH-4] Current R-multiple uses `phase1_price` instead of average entry (same root cause as HIGH-3)
- **File:** `lib/stats/dashboard-stats.ts:122–128`
- **Symptom:** R-multiple shown on open positions is wrong for any position with scale-in buys.
- **Root cause:** `computeCurrentR` uses `trade.phase1_price` as the entry for the `risk = entry - stop` calculation.
- **Suggested fix:** Use `computeAvgEntry(trade)` from `lib/trade-utils.ts`.

---

### [HIGH-5] Admin "Extend" action always adds 30 days, ignores the `days` input field
- **File:** `app/api/admin/users/[userId]/route.ts:54`
- **Symptom:** Admin enters "7 days" or "90 days" in the extend dialog — but the user always gets exactly 30 days.
- **Root cause:** The body is destructured as `{ action?: string }` only. The `days` field from the request body is never read. The code hard-codes `base.getDate() + 30` on line 54.
- **Suggested fix:** Destructure `days` from the body: `const { action, days = 30 } = await req.json()`, clamp to `[1, 365]`, and use `days` in the date calculation.

---

### [HIGH-6] Screenshot upload has client-only file-type check; SVG/HTML upload possible (stored XSS)
- **File:** `components/journal/add-trade-modal.tsx:62–85`
- **Symptom:** An attacker can upload an SVG with embedded `<script>` to the public Storage bucket. Anyone who accesses the direct URL (visible in the journal) executes the script.
- **Root cause:** File-type check is `file.type.startsWith('image/')` on the client only. Nothing validates the actual file bytes server-side. The Storage bucket is public.
- **Suggested fix:** Route the upload through an API endpoint that reads the first 12 bytes (magic bytes) to confirm PNG/JPEG/WEBP. Alternatively, add a Supabase Storage policy that restricts MIME types, or enable virus/content scanning.

---

### [HIGH-7] Broker import "Delete all & re-import" runs irreversible bulk-delete from the browser
- **File:** `components/journal/import-excel-modal.tsx:294–301`
- **Symptom:** One misclick permanently deletes all trades. No server-side gate, no audit log, no recovery.
- **Root cause:** `supabase.from('trades').delete().eq('user_id', userId)` is called directly from client-side code with zero server-side confirmation, rate limiting, or rollback mechanism.
- **Suggested fix:** Move the delete to `POST /api/journal/reset` server route with auth verification. Add a mandatory 5-second countdown or typed confirmation (`"DELETE MY TRADES"`) before executing.

---

## Medium Bugs (edge cases, UX issues)

### [MED-1] `start-trial` inserts empty string `''` into `NOT NULL paddle_customer_id` column
- **File:** `app/api/start-trial/route.ts:41`
- **Symptom:** Admin Paddle customer link renders with empty ID. Downstream checks using `if (sub.paddle_customer_id)` return `true` even for trial users with no Paddle account.
- **Root cause:** Column is `NOT NULL`, but `''` satisfies the constraint. Semantics are broken — empty string ≠ NULL.
- **Suggested fix:** Change the column to `paddle_customer_id text DEFAULT NULL` and insert `null` instead of `''`.

---

### [MED-2] Win-rate denominator includes `null`-outcome closed trades (silent undercount)
- **File:** `lib/stats/win-rate.ts:25–38`
- **Symptom:** Win rate appears lower than reality for users with `stopped_out` trades that have `outcome = null`. Stats don't add up: `wins + losses + breakevens < closedCount`.
- **Root cause:** `closed = trades.filter(t => t.status !== 'open')` — includes trades with `outcome === null`. These count in the denominator but in no numerator bucket.
- **Suggested fix:** Add `&& t.outcome !== null` to the closed filter, or add an explicit `null` bucket and display it.

---

### [MED-3] Admin page renders briefly for non-admins before redirect fires
- **File:** `app/admin/users/page.tsx:70–75`
- **Symptom:** Non-admin users briefly see the admin UI structure before being redirected away.
- **Root cause:** `router.replace('/')` is async — the component renders one cycle before redirecting.
- **Suggested fix:** Return `null` or a loading spinner immediately when `!profile?.is_admin` instead of triggering a delayed redirect.

---

### [MED-4] FinViz scraping uses `isHuman=1` cookie — likely ToS violation and fragile
- **File:** `app/api/cron/scan-leaders/route.ts:258`
- **Symptom:** If FinViz updates bot detection, the cron IP gets banned. Also constitutes probable ToS violation.
- **Root cause:** Hardcoded `Cookie: isHuman=1` header to bypass FinViz anti-bot.
- **Suggested fix:** Use a licensed data source (FinViz Elite API, Polygon.io, etc.) or respect robots.txt and remove the bypass cookie.

---

### [MED-5] Two Supabase client instances created per request in middleware (cookie propagation risk)
- **File:** `middleware.ts:54,75`
- **Symptom:** Session cookies may not propagate correctly between the auth check and subscription check, potentially causing stale-session reads in downstream Server Components.
- **Root cause:** `createMiddlewareClient` is called twice. Each call creates a new cookie jar snapshot. The `@supabase/ssr` canonical pattern creates one client per request.
- **Suggested fix:** Create a single Supabase client at the top of the `middleware` function and reuse it for both calls.

---

### [MED-6] `computeMaxDrawdown` silently returns `null` when `accountSize = 0` (profile loading race)
- **File:** `lib/stats/dashboard-stats.ts:44–68`; `app/page.tsx:94–99`
- **Symptom:** Dashboard shows `—` for Max Drawdown even when trades exist, if the profile hasn't loaded yet or account size wasn't set.
- **Root cause:** `profile?.account_size ?? 0` passes 0 during profile loading. `computeMaxDrawdown(..., 0)` hits the `peak = 0` initial state, division is guarded but returns null for all periods.
- **Suggested fix:** Skip the call entirely if `accountSize === 0` or `profileLoading === true`; show a loading skeleton instead.

---

### [MED-7] `onboarding/page.tsx` silently ignores `/api/start-trial` failure
- **File:** `app/onboarding/page.tsx:73`
- **Symptom:** If the trial creation API fails (network error, DB error), the user is redirected to `/` and immediately bounced to `/billing`, with no explanation.
- **Root cause:** `await fetch('/api/start-trial', ...)` — response is never checked. Any non-200 status is ignored.
- **Suggested fix:** Check `res.ok`; if false, show a toast error and stay on the onboarding page with a "Try again" option.

---

### [MED-8] Period filter date comparisons use string comparison (timezone boundary issue)
- **File:** `lib/stats/dashboard-stats.ts:28`
- **Symptom:** Trades near midnight on period boundaries (YTD Jan 1, MTD 1st of month) may be incorrectly included/excluded for users in UTC+2/+3 (Israel).
- **Root cause:** `t.exit_date >= start` compares ISO timestamp strings. Supabase returns `timestamptz` in UTC; `getPeriodStart()` builds strings from `new Date()` in local time. The mismatch causes off-by-1-day errors at daylight saving transitions.
- **Suggested fix:** Parse both values with `new Date(...)` and compare `.getTime()` values.

---

### [MED-9] Manually-logged open positions excluded from broker-import merge map (causes duplicate trades)
- **File:** `components/journal/import-excel-modal.tsx:105–149`
- **Symptom:** A user who manually logged NVDA open, then imports their broker file, gets a second NVDA open trade instead of having the existing one updated.
- **Root cause:** The existing open-positions query filters `eq('is_what_if', true)`. Manually-logged positions have `is_what_if = false` and are excluded from the positions map used for merging.
- **Suggested fix:** Load **all** open positions (both `is_what_if` values) into `existingPositionsRef`. Keep signature dedup restricted to `is_what_if = true` to avoid false duplicates on system trades.

---

## Low Bugs (cosmetic, minor)

### [LOW-1] `getSession()` used instead of `getUser()` — JWT not verified server-side on init
- **File:** `lib/auth-context.tsx:148`
- **Symptom:** No immediate user-facing bug, but a tampered localStorage JWT could appear valid to the client.
- **Suggested fix:** Use `getUser()` for the initial auth check, or document this as an accepted risk (the current code has a comment acknowledging it).

---

### [LOW-2] `billing/page.tsx` defaults missing subscription status to `'cancelled'` (misleading label)
- **File:** `app/billing/page.tsx:72`
- **Symptom:** New users who never had a subscription see "Cancelled" as their status, implying they previously subscribed.
- **Suggested fix:** Add a `'none'` state for no-subscription users and display "No active subscription."

---

### [LOW-3] `settings/page.tsx` reads `window.location.search` instead of `useSearchParams()`
- **File:** `app/settings/page.tsx:241`
- **Symptom:** Will throw during any future SSR usage. Non-idiomatic Next.js App Router pattern.
- **Suggested fix:** Replace with `const params = useSearchParams()` from `next/navigation`.

---

### [LOW-4] Synthetic RS Rating (Yahoo fallback) not labeled as approximate in the UI
- **File:** `app/api/cron/scan-leaders/route.ts:187`
- **Symptom:** Users see RS ratings that look like IBD methodology values but are actually a rough formula: `(52wk_change + 50) * 0.99`. No market benchmark normalization.
- **Suggested fix:** Add an asterisk or tooltip in the UI: "RS*" with a note explaining it's an approximation when using Yahoo data.

---

### [LOW-5] `import-excel-modal.tsx` emoji icons lack `aria-label` (accessibility)
- **File:** `components/journal/import-excel-modal.tsx:609–639`
- **Symptom:** Screen readers announce emoji characters verbatim or skip them.
- **Suggested fix:** Wrap informational emojis in `<span role="img" aria-label="...">`.

---

### [LOW-6] `checkout/page.tsx` re-open logic depends on effect dependencies, fragile state
- **File:** `app/onboarding/checkout/page.tsx:118–123`
- **Symptom:** If Paddle fires an `onClose` event and state isn't reset, the "Open payment window" button may become a no-op.
- **Suggested fix:** Subscribe to Paddle's `checkout.closed` event and reset `opened = false` there; remove the manual button-click state reset.

---

### [LOW-7] Non-canonical `@supabase/ssr` cookie forwarding in middleware
- **File:** `middleware.ts:43`
- **Symptom:** Potential stale session state in Server Components on some edge deployments.
- **Suggested fix:** Follow the `@supabase/ssr` middleware documentation exactly: create response first, pass both `request` and `response` to `createServerClient`, then return the response with updated cookies.

---

## Areas Not Fully Audited

1. **`app/api/ticker/[symbol]/route.ts`** — Could not verify full EMA/Trend Template calculation logic depth; would need live market data to test boundary conditions.
2. **Supabase RLS policies for `trades`, `user_profiles`, `watchlist_items`** — Only migrations 001–005 read; runtime policies cannot be verified without DB access.
3. **Playwright E2E tests** — `tests/e2e/` directory exists; test execution not performed (read-only audit). Some test files reference `PLAYWRIGHT_AUTH_BYPASS=true` which bypasses middleware — tests do not cover the auth/subscription guard flows.
4. **Paddle webhook signature verification** — Could not find `app/api/webhooks/paddle/route.ts`; this file may not exist yet or may be at a different path. **If the webhook handler doesn't exist, subscription status never updates automatically from Paddle events — all status changes must be manual.**
5. **`lib/supabase-service.ts`** — Existence confirmed; singleton pattern audited but runtime behaviour in Vercel Edge Runtime not testable statically.
6. **Browser compatibility** — No cross-browser testing performed.
7. **Hebrew RTL rendering** — Logic only; visual RTL layout issues not testable without a browser.

---

## Top 5 Recommendations (fix first)

### 1. CRIT-1 — Fix cron write RLS (highest user-facing impact)
Stage 2 Leaders is a **live feature users see every day**. It is currently broken in production. Fix by switching `supabaseAnon` to `getServiceClient()` in the cron route. 30-minute fix.

### 2. HIGH-3 + HIGH-4 — Fix unrealized PnL and R-multiple to use `computeAvgEntry`
Both `computeUnrealizedPnL` and `computeCurrentR` in `lib/stats/dashboard-stats.ts` produce wrong numbers for any scaled-in position. These are **core financial calculations** — wrong data erodes user trust immediately. 1-hour fix.

### 3. CRIT-4 — Remove hardcoded personal email from RLS policies
Write migration 006 to replace the email check with `is_admin = true` from `user_profiles`. This is both a **security/PII issue** and a maintenance burden. 45-minute fix.

### 4. CRIT-2 — Add `UNIQUE (user_id)` to `subscriptions` and fix the start-trial race
Without the unique constraint, billing logic is structurally unsound. This is foundational. 30-minute migration + route fix.

### 5. HIGH-5 — Fix admin extend to read `days` from request body
Currently all admin trial extensions silently give 30 days regardless of input. This breaks a frequently-used admin workflow. 10-minute fix.

---

*Report generated by static code analysis. No code was modified.*
