@AGENTS.md

# Momentum Playbook — Claude Code Instructions

## Project overview
A SaaS stock-trading journal for momentum traders. Live at momentum-playbook.vercel.app.
Admin: asaf.abllin@gmail.com | Supabase project: xioitkanzawmouiiwhqs

## Stack
- Next.js App Router + TypeScript
- Tailwind CSS v4 (CSS-first config, `@import "tailwindcss"` — no tailwind.config.js)
- Supabase (PostgreSQL + Auth + Storage + RLS)
- Payments: Grow (Meshulam) — Israeli payment provider
- Deployment: Vercel (`npx vercel --prod`)

## Workflow rules — MUST follow
1. **Before every change** — read the relevant file first
2. **After every change** — run `npx tsc --noEmit` and fix all errors before continuing
3. **Before deploy** — ensure zero TypeScript errors
4. **Deploy command:** `npx vercel --prod`

## CSS / theming
Uses CSS variables for dark/light mode — always use these, never hardcode colors:
- `var(--bg-primary)` `var(--bg-surface)` `var(--bg-elevated)` `var(--bg-modal)`
- `var(--text-primary)` `var(--text-secondary)` `var(--text-muted)` `var(--text-faint)`
- `var(--border-subtle)` `var(--border-strong)` `var(--divider)`
- Accent green: `#10F088` | Accent cyan: `#22D3EE` | Danger: `#FF3B5C`

## Key files
- `lib/supabase-client.ts` — Supabase singleton + ALL shared TypeScript types
- `lib/auth-context.tsx` — `useAuth()` hook → `{ user, profile, loading }`
- `lib/use-live-prices.ts` — polls `/api/live-prices` every 10s
- `lib/toast.ts` — `toast({ title, body?, variant: 'success'|'error'|'info' })`
- `lib/utils.ts` — `cn()` for className merging
- `lib/trade-utils.ts` — `getPartials()`, `getSells()`, `getBuys()`, `computeAvgEntry()`
- `middleware.ts` — auth guard, redirects unauthenticated users to /login

## Database tables (Supabase)
- `user_profiles` — id, display_name, account_size, max_risk_per_trade_pct, max_stop_distance_pct, monthly_loss_limit_usd
- `trades` — full trade data incl. partials (jsonb), system_status, trend_checks, post_mortem
- `watchlist_items` — user_id, ticker, notes
- `asaf_thoughts` — ticker, notes, image_url (admin-only writes)
- `stage2_leaders` — curated watchlist shown on dashboard

## Pending DB migrations (run in Supabase SQL editor before using these features)
```sql
ALTER TABLE trades ADD COLUMN IF NOT EXISTS system_status text CHECK (system_status IN ('system','partial','non_system'));
ALTER TABLE trades ADD COLUMN IF NOT EXISTS trend_checks boolean[];
ALTER TABLE trades ADD COLUMN IF NOT EXISTS post_mortem jsonb;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS monthly_loss_limit_usd numeric;
```

## Code conventions
- No comments unless the WHY is non-obvious
- No emojis unless explicitly requested
- `cn()` for conditional classNames
- All modals: fixed inset-0 z-[1000], blur backdrop, close on backdrop click
- Mobile: touch targets ≥44px, inputs font-size ≥16px (prevents iOS zoom)
- Supabase queries always check `error` before using `data`
- Never hardcode user IDs or emails except the admin check: `user?.email === 'asaf.abllin@gmail.com'`
