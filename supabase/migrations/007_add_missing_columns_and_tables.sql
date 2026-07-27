-- Migration 007: reconcile committed migrations with what live code actually uses.
-- Run in Supabase Dashboard → SQL Editor.
--
-- Context: several columns/tables used by live app code were never added via a
-- committed migration (added by hand in the SQL editor at some point instead,
-- per CLAUDE.md's "Pending DB migrations" note). This migration is idempotent
-- (IF NOT EXISTS / IF EXISTS everywhere) so it's safe to run even if some of
-- these already exist on the live DB.

-- ── 1. subscriptions: Grow (Meshulam) fields ──────────────────────────────────
-- app/api/grow/{webhook,cancel-subscription,update-payment-method,list-transactions}
-- all read/write subscriptions.grow_subscription_id; lib/supabase-client.ts:38
-- types it as string | null.
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS grow_subscription_id text;

-- app/api/admin/users/route.ts selects subscriptions.tier; CLAUDE.md documents
-- this exact statement as a still-pending migration.
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS tier text CHECK (tier IN ('starter','pro','elite'));

-- subscriptions.paddle_customer_id is NOT NULL from the original (pre-Grow)
-- migration 001, but no current code path (start-trial, grow webhook,
-- grow/dev-activate) ever sets it. If this constraint is still live, every
-- subscriptions insert from app code should be failing right now — dropping
-- the NOT NULL requirement here is safe/idempotent either way.
ALTER TABLE public.subscriptions ALTER COLUMN paddle_customer_id DROP NOT NULL;

-- ── 2. trades: post-mortem / system-status fields ─────────────────────────────
-- Exact statements as documented in CLAUDE.md's "Pending DB migrations" section.
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS system_status text CHECK (system_status IN ('system','partial','non_system'));
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS trend_checks boolean[];
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS post_mortem jsonb;

-- ── 3. user_profiles: monthly loss limit ──────────────────────────────────────
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS monthly_loss_limit_usd numeric;

-- ── 4. webhook_events: new table, used by app/api/grow/webhook/route.ts:42 ────
-- Never had a CREATE TABLE anywhere in migrations. Columns inferred from the
-- exact shape of the insert() call in that file.
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider   text        NOT NULL,
  event_type text        NOT NULL,
  payload    jsonb        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
-- Deliberately no policies: only the service-role client (which bypasses RLS)
-- writes/reads this table today. If a browser-facing read is ever added,
-- add an explicit owner- or admin-scoped SELECT policy at that time.
