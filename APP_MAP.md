# APP_MAP.md — Momentum Playbook

מסמך זה נכתב על סמך קריאה ישירה של הקוד בריפו `ASAF1304/Momentum-PlayBook` (branch `master`, clone נקי תחת `~/Developer/Momentum-PlayBook`), **לא** על סמך README/CLAUDE.md/AGENTS.md/BUG_AUDIT_REPORT.md. כל טענה מלווה ב-file:line. איפה שמשהו לא ניתן לאימות מהקוד בלבד — כתוב "לא ודאי" עם הסבר.

---

## 1. API Routes

| Route | Method | מה הוא עושה | דורש אימות? | תפקיד נדרש |
|---|---|---|---|---|
| `/api/admin/gate` | POST | מאמת סיסמת admin-gate, קובע cookie httpOnly ל-8 שעות (`app/api/admin/gate/route.ts:12-30`) | לא (זה עצמו שער הכניסה) | אין — רק סיסמה משותפת |
| `/api/admin/gate` | DELETE | מנקה את cookie ה-admin-gate (`app/api/admin/gate/route.ts:32-42`) | לא | אין |
| `/api/admin/users` | GET | מחזיר את כל המשתמשים + פרופיל + מנוי + אימייל (`app/api/admin/users/route.ts:15-57`) | כן, `guardAdmin()` | `is_admin=true` בטבלת `user_profiles` |
| `/api/admin/users/[userId]` | POST | פעולות `comp`/`extend`/`revoke`/`setTier` על מנוי משתמש (`.../[userId]/route.ts:22-92`) | כן, `guardAdmin()` | `is_admin=true` |
| `/api/admin/users/[userId]/block` | POST | חוסם/משחרר משתמש (`.../block/route.ts:12-43`) | כן, `guardAdmin()` | `is_admin=true` |
| `/api/admin/users/[userId]/extend` | POST | מאריך `trial_ends_at` ב-N ימים (1–3650) (`.../extend/route.ts:12-48`) | כן, `guardAdmin()` | `is_admin=true` |
| `/api/admin/users/[userId]/stats` | GET | סטטיסטיקות מסחר מצטברות למשתמש (`.../stats/route.ts:9-19`) | כן, `guardAdmin()` | `is_admin=true` |
| `/api/admin/users/[userId]/trades` | GET | כל העסקאות של משתמש, service-role (עוקף RLS) (`.../trades/route.ts:9-28`) | כן, `guardAdmin()` | `is_admin=true` |
| `/api/cron/scan-leaders` | GET | סורק FinViz/Yahoo לפי קריטריוני Minervini, כותב ל-`stage2_leaders` (`app/api/cron/scan-leaders/route.ts:201-353`) | Bearer token מול `CRON_SECRET` (אם מוגדר — ראו סעיף 6) | אין (cron, לא משתמש אנושי) |
| `/api/grow/cancel-subscription` | POST | מבטל מנוי מול Grow (`app/api/grow/cancel-subscription/route.ts:8-38`) | כן (Supabase session) | משתמש מחובר בלבד |
| `/api/grow/create-checkout-session` | POST | יוצר סשן תשלום Grow, או fallback dev-mode (`.../create-checkout-session/route.ts:13-42`) | כן | משתמש מחובר בלבד |
| `/api/grow/dev-activate` | POST | **dev-only**: מפעיל trial ידנית (`.../dev-activate/route.ts:12-46`) — ראו סעיף 6 | כן | משתמש מחובר בלבד |
| `/api/grow/list-transactions` | GET | רשימת עסקאות תשלום מ-Grow (`.../list-transactions/route.ts:8-38`) | כן | משתמש מחובר בלבד |
| `/api/grow/update-payment-method` | POST | קישור לעדכון אמצעי תשלום ב-Grow (`.../update-payment-method/route.ts:8-38`) | כן | משתמש מחובר בלבד |
| `/api/grow/webhook` | POST | מקבל webhooks מ-Grow, מעדכן `subscriptions` (`app/api/grow/webhook/route.ts:21-88`) | חתימת HMAC (`x-grow-signature`), לא Supabase session | אין (שרת-לשרת) |
| `/api/import/ai-parse` | POST | מפענח קובץ ברוקר בכל פורמט באמצעות Claude Haiku 4.5 (`app/api/import/ai-parse/route.ts:68-156`) | **לא ודאי** — אין בדיקת `auth.getUser()` בקובץ (ראו סעיף "פערים") | — |
| `/api/journal/reset` | POST | מוחק את **כל** העסקאות של המשתמש המחובר (`app/api/journal/reset/route.ts:16-36`) | כן | משתמש מחובר בלבד (מוחק רק את שלו) |
| `/api/live-prices` | POST | מחירים חיים ל-batch של טיקרים (`app/api/live-prices/route.ts:38-115`) | כן | משתמש מחובר, + rate limit 60/60s |
| `/api/start-trial` | POST | יוצר שורת מנוי `status='grace'`, trial 14 יום (`app/api/start-trial/route.ts:20-61`) | כן | משתמש מחובר בלבד |
| `/api/ticker/[symbol]` | GET | ניתוח טכני מלא לטיקר בודד (EMA/Trend Template/Stops) (`app/api/ticker/[symbol]/route.ts:81-130`) | כן | משתמש מחובר, + rate limit 30/60s |

**הערה לגבי `/api/import/ai-parse`:** בניגוד לכל שאר ה-routes שקוראים ל-`supabase.auth.getUser()` במפורש, ב-`app/api/import/ai-parse/route.ts` **לא נמצאה שום בדיקת אימות** — הקובץ נבדק שורה־שורה (1–208) ואין בו import של Supabase כלל. כל מי שיודע לשלוח POST יכול לגרום לשרת לקרוא ל-Anthropic API על חשבון בעל האפליקציה, ללא הגבלת קצב. זו נקודה קונקרטית ומאומתת מהקוד, לא ניחוש.

---

## 2. מקור המידע לכל route

| Route | מקור מידע |
|---|---|
| `/api/admin/gate` | חישוב פנימי (HMAC) — `lib/auth/admin-gate.ts:24-42` |
| `/api/admin/users*` | טבלאות DB: `user_profiles`, `subscriptions`, `auth.users` (דרך Supabase Admin API `auth.admin.listUsers`/`getUserById`) |
| `/api/cron/scan-leaders` | **API חיצוני**: FinViz (scrape HTML, ראשי) → fallback **API חיצוני**: Yahoo Finance (`yahoo-finance2`); כתיבה לטבלת `stage2_leaders` |
| `/api/grow/*` (חוץ מ-webhook) | **API חיצוני**: Grow/Meshulam (`https://grow.meshulam.com/api`, `lib/grow/client.ts:20`) + טבלת `subscriptions` |
| `/api/grow/webhook` | Payload נכנס מ-Grow; כותב ל-`subscriptions` ול-`webhook_events` |
| `/api/import/ai-parse` | **קריאת LLM**: Anthropic Claude Haiku 4.5 (`app/api/import/ai-parse/route.ts:111-120`) |
| `/api/journal/reset` | טבלת DB: `trades` |
| `/api/live-prices` | **API חיצוני**: Yahoo Finance (`yahoo-finance2`, `app/api/live-prices/route.ts:91`) + cache פנימי בזיכרון (8 שניות) |
| `/api/start-trial` | טבלת DB: `subscriptions` (כתיבה) |
| `/api/ticker/[symbol]` | **API חיצוני**: Yahoo Finance (`lib/market-data.ts:102`) + חישוב פנימי (EMA/SMA/Trend Template/Stops) |

---

## 3. ספקים חיצוניים בפועל

| ספק | תפקיד | קבצים/שורות |
|---|---|---|
| **Supabase** | Auth, DB (Postgres), RLS | בכל מקום; ליבה: `lib/supabase-client.ts:154-157`, `lib/supabase-service.ts:15`, `lib/supabase-server.ts:12-28` |
| **Yahoo Finance** (`yahoo-finance2` npm) | נתוני שוק (מחירים, נרות, ממוצעים) | `lib/market-data.ts:9,102`; `app/api/live-prices/route.ts:13,91`; `app/api/cron/scan-leaders/route.ts:25,138` |
| **FinViz** (finviz.com — scrape HTML, ללא API רשמי/מפתח) | מקור ראשי לסריקת מנהיגי שוק | `app/api/cron/scan-leaders/route.ts:235-263` |
| **Anthropic** (Claude Haiku 4.5) | פענוח קבצי ברוקר בשפה חופשית | `app/api/import/ai-parse/route.ts:15,22,108,111` |
| **Grow / Meshulam** (ספק סליקה ישראלי) | תשלומים, מנוי, webhooks | `lib/grow/client.ts:20-81`; `app/api/grow/webhook/route.ts` |
| **Sentry** | ניטור שגיאות | `app/api/ticker/[symbol]/route.ts:9,123`; קבצי קונפיג `sentry.client.config.ts`/`sentry.server.config.ts`/`sentry.edge.config.ts` (לא נקראו לעומק — קונפיג סטנדרטי) |
| **Upstash Redis** | Rate limiting | `lib/rate-limit.ts:6-18` (no-op בשקט אם אין env vars) |

**לא ודאי — האם כל אלו פעילים בפועל ב-production:** לכל אחד מהספקים יש נתיב "graceful degradation" כשמפתח ה-API חסר (Grow מחזיר `null`/503, Sentry פשוט לא שולח, Upstash rate-limit no-ops ל-`allowed:true`, Anthropic מחזיר 500 מפורש). לא ניתן לדעת מתוך הקוד בלבד אילו env vars מוגדרים בפועל ב-Vercel production — זה תלוי בקונפיגורציה החיה, לא בקוד.

---

## 4. סכמת ה-DB כפי שמופיעה בקוד

מתוך `supabase/migrations/001`–`006` (שישה קבצים בלבד קיימים בריפו):

- **`user_profiles`**: `id`, `display_name`, `account_size`, `max_risk_per_trade_pct`, `max_stop_distance_pct`, `monthly_loss_limit_usd` (הקצה האחרון — **לא ודאי**, לא נמצא ב-migrations, רק ב-`lib/supabase-client.ts:16` ובתיעוד CLAUDE.md), `accepted_terms_at`, `dismissed_onboarding_at` (מיגרציה 001:34-36), `is_admin` (מיגרציה 004:8). RLS: owner-only select/insert/update/delete (מיגרציה 001:11-31) + מדיניות admin-read-all (מיגרציה 004:13-18).
- **`trades`**: RLS owner-only (מיגרציה 001:43-63). עמודות כפי שמופיעות ב-`lib/supabase-client.ts:64-114`: `ticker`, `phase1_*`, `phase2_*`, `initial_stop`, `current_stop`, `risk_dollars`, `stop_distance_pct`, `rs_rating`, `trend_template_passed`, `exit_*`, `status`, `outcome`, `pnl_*`, `notes`, `lesson_learned`, `screenshot_url`, `partials` (jsonb), `current_shares`, `is_what_if`, `failed_gates`, `what_if_reason`, `system_status`, `trend_checks`. **אף אחת מהעמודות האלה לא מופיעה כ-`ALTER TABLE`/`CREATE TABLE` בקבצי המיגרציה שבריפו** — כלומר הטבלה כבר הייתה קיימת לפני מיגרציה 001, או שהעמודות נוספו ידנית ב-Supabase SQL editor ולא הוזנו כמיגרציה מתועדת. **לא ודאי** אם סכמת ה-DB החיה תואמת בדיוק את הטיפוסים ב-`lib/supabase-client.ts`.
- **`watchlist_items`**: `user_id`, `ticker`, `notes`, `added_at`. RLS owner-only (מיגרציה 001:70-90).
- **`stage2_leaders`**: מיגרציה 001 (שורות 93-102) **רק מפעילה RLS ומגדירה policy** על הטבלה — **אין שום `CREATE TABLE public.stage2_leaders` בכל קובצי המיגרציה שבריפו.** העמודות ידועות רק מהקוד שכותב/קורא אליה: `id`, `rank`, `ticker`, `company`, `price`, `change_pct`, `volume`, `market_cap`, `rs_rating`, `scanned_at` (`app/api/cron/scan-leaders/route.ts:29-38`, `lib/supabase-client.ts:118-129`). RLS: קריאה ציבורית (`USING (true)`), כתיבה רק ל-service_role.
- **`subscriptions`**: **נמצא פער משמעותי.** מיגרציה 001 (שורות 109-120) יוצרת את הטבלה עם עמודות `paddle_customer_id text NOT NULL` ו-`paddle_sub_id text UNIQUE` — כלומר תוכננה במקור לספק **Paddle**. אבל כל הקוד החי (`lib/grow/client.ts`, `app/api/grow/webhook/route.ts:69`, `app/api/admin/users/route.ts:23`) קורא/כותב לעמודות `grow_subscription_id` ו-`tier` — **אף אחת מהן לא מופיעה בשום קובץ מיגרציה בריפו.** גם טבלת `webhook_events` (נכתבת ב-`app/api/grow/webhook/route.ts:42-47`) **אין לה `CREATE TABLE` בשום מיגרציה**. מיגרציה 006 מוסיפה רק `UNIQUE(user_id)`. **המסקנה: קובצי המיגרציה שבריפו אינם תמונה מלאה של סכמת ה-DB החיה** — כנראה בוצעו שינויי סכמה נוספים ישירות ב-Supabase SQL editor שלא הוזנו כקובצי מיגרציה (עקבי עם בלוק "Pending DB migrations" שמופיע ב-CLAUDE.md, שאותו הונחיתי במפורש לא להסתמך עליו כתיעוד — אך הוא כן מעיד שהמפתחים מודעים לפער בין קוד לסכמה מתועדת).
- **`asaf_thoughts`**: `id`, `ticker`, `notes`, `image_url`, `created_at`, `updated_at` (מיגרציה 005). RLS: קריאה לכולם, כתיבה רק ל-`is_admin=true` (מיגרציה 006 מחליפה בדיקת אימייל hardcoded בבדיקת `is_admin`).

**לסיכום סעיף 4:** קובצי המיגרציה בריפו **אינם** מקור אמת מלא לסכמת ה-DB החיה. לפחות שתי עמודות קריטיות לחיוב (`grow_subscription_id`, `tier`) וטבלה שלמה (`webhook_events`) וה-`CREATE TABLE` של `stage2_leaders` חסרים לחלוטין מהמיגרציות אך נחוצים לקוד לרוץ נכון.

---

## 5. Trial / מנוי / תמחור / חיוב

**אורך ה-trial — יש סתירה ממשית בין מה שמוצג למשתמש למה שנאכף בפועל:**

- קובץ ייעודי `lib/trial-config.ts:1` מגדיר `export const TRIAL_DAYS = 46;` — משתמש בכל דפי השיווק/מכירה: `app/welcome/page.tsx` (4 מופעים), `app/pricing/page.tsx` (5 מופעים), `app/billing/page.tsx` (2 מופעים) — כולם מציגים למשתמש **"46 ימי ניסיון חינם"**.
- אבל ה-route שבפועל **יוצר** את שורת ה-trial ב-DB, `app/api/start-trial/route.ts:42`, קובע `trial_ends_at = now + 14 * 24 * 60 * 60 * 1000` — **14 יום בלבד**, ללא שום import של `TRIAL_DAYS`.
- `app/api/grow/dev-activate/route.ts:33` (dev-only) מעניק 30 יום.
- מיגרציה 003 (grandfather grace ל-beta users קיימים) מעניקה 30 יום (`supabase/migrations/003_grandfather_grace.sql:20`).
- פעולות אדמין: `extend`/`revoke` ב-`.../[userId]/route.ts` וב-`.../extend/route.ts` — ברירת מחדל 30 יום, אך ניתנות לשינוי חופשי (1–3650 יום) על ידי אדמין.
- דף ה-checkout עצמו (`app/onboarding/checkout/page.tsx:88`) כתוב hardcoded **"30 ימים חינם"** — עוד ערך שלישי, שונה גם מ-46 וגם מ-14.

בפועל: **אין מקור אמת יחיד לאורך ה-trial.** שלושה ערכים שונים (46 / 30 / 14) מופיעים בקוד בו-זמנית, כאשר ה-DB בפועל מקבל 14 יום דרך `start-trial`.

**תמחור:** אין קבוע/קונפיג יחיד למחיר. הסכום **"50 ₪ / חודש"** מופיע hardcoded כטקסט חופשי בלפחות 7 מקומות: `app/legal/terms/page.tsx:30`, `app/billing/page.tsx:210,294,358,414`, `app/onboarding/checkout/page.tsx:91`, `components/onboarding-modal.tsx:34`, `components/trial-banner.tsx:43`. המחיר בפועל **לא נאכף בקוד האפליקציה כלל** — הוא כנראה מוגדר בצד Grow/Meshulam (בדשבורד שלהם), כש-`GROW_PLAN_ID` (`app/api/grow/create-checkout-session/route.ts:11`, ברירת מחדל `'momentum-monthly'`) הוא רק מזהה תוכנית, לא סכום. **לא ודאי** מה המחיר המוגדר בפועל בצד Grow — לא ניתן לדעת מהקוד.

**אכיפת תפוגה:** ב-`middleware.ts:87-116`. סטטוסים "פעילים" (`ACTIVE_STATUSES`, שורה 104): `trialing`, `active`, `past_due`, `paused`, `grace`, `comp`. כל סטטוס אחר → redirect ל-`/billing`. `blocked` → redirect ישיר ל-`/blocked` (שורות 99-101). **התנהגות חשובה: אם שאילתת ה-DB לבדיקת המנוי נכשלת (שגיאת רשת/DB), הקוד "נכשל פתוח" — מאפשר גישה במקום לחסום** (`middleware.ts:112-115`, הערה בקוד: "DB error — allow through rather than locking users out"). זו החלטת עיצוב מפורשת, לא באג, אבל משמעה שתקלת DB זמנית = גישה חינמית לכולם.

**Webhook billing events:** `app/api/grow/webhook/route.ts:12-19` ממפה סוגי אירועי Grow לסטטוסים: `subscription.created→trialing`, `activated→active`, `cancelled→cancelled`, `payment_failed→past_due`, `payment_succeeded→active`, `expired→expired_grace`. אימות חתימה ב-HMAC-SHA256 (`lib/grow/webhookVerifier.ts:13-30`) — **אם `GROW_WEBHOOK_SECRET` לא מוגדר, הפונקציה מחזירה `false` בשקט** (שורות 14-18) — כלומר webhooks אמיתיים מ-Grow יידחו (401) בלי שגיאה ברורה בצד הלקוח, לא שיעקפו את האימות.

---

## 6. קוד דמו/mock/seed שעלול לרוץ ב-production

1. **`PLAYWRIGHT_AUTH_BYPASS` — הכי משמעותי.** `middleware.ts:37`: `const E2E_BYPASS = process.env.PLAYWRIGHT_AUTH_BYPASS === 'true';` ו-`middleware.ts:44`: `if (E2E_BYPASS) return NextResponse.next(...)` — **עוקף לחלוטין כל בדיקת אימות ומנוי, לכל route, ללא שום תנאי `NODE_ENV`.** ההגנה היחידה היא הערת קוד (`middleware.ts:35-36`: "never set in production") — לא אכיפה בקוד. אם משתנה הסביבה הזה יוגדר בטעות (או יישאר) ב-Vercel production, **כל האתר נפתח לגמרי ללא אימות.**

2. **`/api/grow/dev-activate`** (`app/api/grow/dev-activate/route.ts:13-16`): חסום רק אם `process.env.GROW_API_KEY` קיים. כלומר: אם Grow לא מוגדר (או הוסר בטעות) ב-production, כל משתמש מחובר יכול לקרוא ל-endpoint הזה ולהעניק לעצמו 30 יום trial בחינם ללא צורך בתשלום — ללא בדיקת role/admin.

3. **`/api/grow/create-checkout-session`** נופל ל-dev-mode אוטומטית (`app/api/grow/create-checkout-session/route.ts:26-33`) אם `GROW_API_KEY` חסר, ומחזיר `iframeUrl: '/dev/mock-checkout'`. **בדקתי — עמוד `/dev/mock-checkout` לא קיים בכלל תחת `app/`** (`find app -ipath "*mock-checkout*"` לא החזיר תוצאות). כלומר אם המפתח חסר, המשתמש מגיע ל-404 בפועל, לא ל-mock אמיתי. זה תקוע/broken יותר משהו מסוכן, אבל בהחלט "קוד דמו" שלא הושלם.

4. **דף ה-checkout** (`app/onboarding/checkout/page.tsx:106-117`) מציג כפתור "Simulate Payment Success" גלוי אם השרת החזיר `dev: true` — תלוי לגמרי בקונפיגורציה של `GROW_API_KEY` בצד השרת, לא ב-`NODE_ENV` בצד הלקוח.

5. **`scripts/audit-trades.ts`, `scripts/reconcile-trades.ts`** — כלי CLI עצמאיים (`npx tsx scripts/...`), **לא** מיובאים משום route ב-`app/api` (נבדק: `grep -rl "audit-trades\|reconcile-trades" app` לא החזיר כלום) — אינם נגישים דרך ה-web app ב-production. מכילים `TARGET_USER` (UUID קבוע) ונתיב Windows מקומי (`scripts/reconcile-trades.ts:27`) — כלים לפיתוח מקומי בלבד, לא סיכון production.

---

## 7. מקומות שבהם מוצג ציון/דירוג/סינון/המלצה על נייר ערך ספציפי

1. **`components/dashboard/stage2-leaders.tsx`** — פאנל "Stage 2 Leaders" בדשבורד הראשי. מציג עד 20 טיקרים מ-`stage2_leaders`, ממוינים לפי `rank` (שורה 32), עם `rs_rating`, מחיר, שינוי יומי, שווי שוק — ומאפשר להוסיף ישירות ל-watchlist (שורות 57-74). זו המלצה/סינון פעיל של ניירות ערך ספציפיים למשתמש.
2. **`app/api/cron/scan-leaders/route.ts`** — מקור הנתונים לפאנל הנ"ל. מסנן טיקרים לפי קריטריוני Minervini Trend Template (שורות 153-167: מחיר מעל SMA200/SMA50, SMA50 מעל SMA200, 30%+ מעל שפל 52 שבועות, בטווח 25% מהשיא), ומחשב `rs_rating` באופן ניתן-לוויכוח כ-proxy (שורות 186-188: `Math.min(99, Math.max(1, Math.round((change52w + 50) * 0.99)))`) — לא דירוג RS אמיתי (כמו IBD RS Rating), אלא נוסחה פנימית מבוססת שינוי מחיר של 52 שבועות.
3. **`app/api/ticker/[symbol]/route.ts`** + `buildResponse()` (שורות 132-242) — לכל טיקר בודד שמשתמש מבקש: `trendTemplate.passed` (עובר/לא עובר 10 קריטריונים של Minervini, שורות 141-193), `volumeCheck.spikeOnBreakout`, והמלצת stop-loss (`lib/stop-calculator.ts:48-171`, `recommended` candidate מתוך 7 סוגי stop אפשריים). זו לא "המלצת קנייה" אקטיבית, אלא ניתוח טכני על-פי בקשת המשתמש לטיקר נתון.
4. **`app/thoughts`** (`components/thoughts`, טבלת `asaf_thoughts`) — "לוח מחשבות" שבו **אדמין בלבד** (אוכף ברמת RLS דרך `is_admin`, מיגרציה 006) כותב הערות טקסט/תמונה per-ticker, גלוי לכל המשתמשים המחוברים (RLS: `USING (true)`, מיגרציה 005:16-17). זו המלצה/דעה ידנית מפורשת של האדמין על ניירות ערך ספציפיים, לא אלגוריתמית.
5. **`lib/mindset-engine.ts`** — לא ממליץ על טיקר ספציפי, אלא נותן הסברי-כישלון גנריים (ציטוטים/עקרונות) כשעסקה לא עוברת gate מסוים (Stage 2, RS>80 וכו') — כלי חינוכי/coaching, לא scoring של נייר ערך קונקרטי.

**הבהרה משפטית שקיימת בקוד עצמו:** `components/dashboard/stage2-leaders.tsx:137-140` כולל disclaimer מפורש: "Not investment advice... Always perform your own due diligence."

---

## פערים ואי-ודאויות

- **סכמת ה-DB החיה מול הקוד:** כמפורט בסעיף 4 — `subscriptions.grow_subscription_id`, `subscriptions.tier`, טבלת `webhook_events`, וה-`CREATE TABLE` של `stage2_leaders` כולם בשימוש פעיל בקוד אך **חסרים לחלוטין** מ-6 קובצי המיגרציה שבריפו. לא ניתן לדעת מהקוד בלבד אם אלה קיימים ב-DB החי (סביר שכן, אחרת שום route לא היה עובד) — אבל אין להם תיעוד-מיגרציה מבוקר בגיט, כך שאין דרך לשחזר את הסכמה המדויקת (טיפוסים, ברירות מחדל, אילוצים) בלי גישה ישירה ל-Supabase.
- **אורך trial בפועל:** שלושה ערכים סותרים בקוד (46/30/14 יום). איזה ערך חל בפועל על משתמש חדש תלוי אך ורק ב-`/api/start-trial` (14 יום) — אבל זה בסתירה ישירה לכל מה שהאתר מציג לו לפני ההרשמה. לא ודאי אם זו טעות לא-מכוונת (קוד שיווקי לא עודכן אחרי שינוי ב-API) או להפך.
- **מחיר בפועל (50 ₪):** מוצג רק כטקסט; המחיר האמיתי שנגבה תלוי בקונפיגורציה בצד Grow/Meshulam שלא ניתנת לצפייה מהקוד.
- **האם `PLAYWRIGHT_AUTH_BYPASS`, `GROW_API_KEY`, `GROW_WEBHOOK_SECRET`, `CRON_SECRET`, `ANTHROPIC_API_KEY` מוגדרים בפועל ב-Vercel production ואיך** — לא ניתן לדעת מהקוד; כל הסיכונים בסעיף 6 תלויים בקונפיגורציית סביבה חיה שלא נבדקה (ולא התבקשתי לבדוק — יכולתי רק לקרוא קוד, לא Vercel dashboard).
- **`/api/import/ai-parse` ללא בדיקת אימות:** אומת בקריאת קוד ישירה (אין import של Supabase/`auth.getUser` בקובץ) — נראה כמו פער אבטחה אמיתי, לא ניחוש, אבל לא נבדק אם קיימת הגנה ברמת ה-middleware (הנתיב `matcher` ב-`middleware.ts:121-126` **מחריג במפורש `api/`** — כלומר ה-middleware הראשי לא חל על שום route תחת `/api/` בכלל, וכל route תחת `app/api` צריך לבדוק אימות בעצמו. זה מסביר למה כל שאר ה-routes תחת `/api/grow`, `/api/live-prices` וכו' קוראים ל-`auth.getUser()` בעצמם ידנית — אבל `ai-parse` היחיד שלא עשה זאת).
- **`rosecar`** — תיקייה שמוזכרת בזיכרון קודם כקיימת בעותק ה-iCloud הפגום, אך **לא קיימת כלל** ב-clone הנקי הזה (`find rosecar` החזיר ריק). לא ודאי אם זו הייתה תיקייה לא-מקוממת (untracked) בעותק המקומי הישן שמעולם לא הייתה ב-git, או שהוסרה מהריפו.
- לא נקראו לעומק: `lib/broker-parser*.ts` (~1000+ שורות משולבות, parsers ל-Meitav/IBI/IBKR/eToro), `lib/stats/*.ts`, `lib/market-data.test.ts`, קבצי `sentry.*.config.ts`, ורוב קומפוננטות ה-UI מתחת ל-`components/` שאינן קשורות ישירות ל-7 הסעיפים המבוקשים — לא נמצא בהם דבר החורג מהממצאים לעיל, אך לא בוצעה בהם קריאה שורה-שורה.
