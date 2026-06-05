# Momentum Playbook

A professional stock-trading journal and playbook for momentum traders.

**Live app:** [momentum-playbook.vercel.app](https://momentum-playbook.vercel.app)

---

## Stack

- **Framework:** Next.js (App Router) + TypeScript
- **Styling:** Tailwind CSS v4
- **Database:** Supabase (PostgreSQL + Auth + Storage)
- **Payments:** Grow (Meshulam)
- **Deployment:** Vercel

---

## Local Setup

### 1. Clone & install

```bash
git clone https://github.com/ASAF1304/Momentum-PlayBook.git
cd Momentum-PlayBook
npm install
```

### 2. Environment variables

Get the `.env.local` file from Asaf (via WhatsApp — never commit this file), then place it in the project root:

```
Momentum-PlayBook/
├── .env.local        ← put here
├── .env.local.example
├── ...
```

All required keys are listed in `.env.local.example`.

### 3. Run dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Project Structure

```
app/
├── (legal-en)/       # Terms, Privacy, Cookies, Accessibility pages
├── (auth)/           # Login, signup, forgot password
├── api/              # API routes (live prices, Grow webhooks, etc.)
├── journal/          # Trade journal
├── playbook/         # Visual trade archive
├── watchlist/        # Stock watchlist with live charts
├── thoughts/         # Asaf's market analysis (admin-only posts)
├── settings/         # User profile & preferences
└── page.tsx          # Dashboard

components/
├── dashboard/        # Stats cards, position sizer, active positions
├── journal/          # Trade modals, import, review setup
├── nav/              # App navigation
├── ui/               # Shared UI primitives
└── validator/        # Pre-trade checklist

lib/
├── supabase-client.ts  # Supabase singleton + all shared types
├── use-live-prices.ts  # Hook: polls /api/live-prices every 10s
├── auth-context.tsx    # User + profile context
└── stats/             # PnL, win-rate, dashboard stats helpers
```

---

## Database Migrations

When adding new DB columns, run these in the Supabase dashboard SQL editor:

```sql
-- Step 3: Non-System review
ALTER TABLE trades ADD COLUMN IF NOT EXISTS system_status text CHECK (system_status IN ('system','partial','non_system'));
ALTER TABLE trades ADD COLUMN IF NOT EXISTS trend_checks boolean[];

-- Step 4: Monthly loss limit
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS monthly_loss_limit_usd numeric;

-- Step 5: Post-mortem
ALTER TABLE trades ADD COLUMN IF NOT EXISTS post_mortem jsonb;
```

---

## Deploy

```bash
npx tsc --noEmit   # must be zero errors
npx vercel --prod
```

---

## Workflow Rules

- **Before every change** — read the relevant file first
- **After every change** — run `npx tsc --noEmit`
- **Before deploy** — ensure zero TypeScript errors
