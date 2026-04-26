-- supabase/migrations/001_rls_paranoid_pass.sql
-- RLS paranoid pass: enable RLS on every user-scoped table, drop and recreate
-- all policies so they are up-to-date, create subscriptions table.
-- Idempotent: safe to run more than once (IF NOT EXISTS / DROP IF EXISTS / OR REPLACE).

-- ────────────────────────────────────────────────────────────────────────────────
-- 1. user_profiles
-- ────────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_profiles: owner select"    ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles: owner insert"    ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles: owner update"    ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles: owner delete"    ON public.user_profiles;

CREATE POLICY "user_profiles: owner select"
  ON public.user_profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "user_profiles: owner insert"
  ON public.user_profiles FOR INSERT
  WITH CHECK (id = auth.uid());

CREATE POLICY "user_profiles: owner update"
  ON public.user_profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "user_profiles: owner delete"
  ON public.user_profiles FOR DELETE
  USING (id = auth.uid());

-- New columns required by legal consent (Section C) and onboarding modal (Section D)
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS accepted_terms_at   timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS dismissed_onboarding_at timestamptz DEFAULT NULL;

-- ────────────────────────────────────────────────────────────────────────────────
-- 2. trades
-- ────────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trades: owner select"    ON public.trades;
DROP POLICY IF EXISTS "trades: owner insert"    ON public.trades;
DROP POLICY IF EXISTS "trades: owner update"    ON public.trades;
DROP POLICY IF EXISTS "trades: owner delete"    ON public.trades;

CREATE POLICY "trades: owner select"
  ON public.trades FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "trades: owner insert"
  ON public.trades FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "trades: owner update"
  ON public.trades FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "trades: owner delete"
  ON public.trades FOR DELETE
  USING (user_id = auth.uid());

-- ────────────────────────────────────────────────────────────────────────────────
-- 3. watchlist_items
-- ────────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.watchlist_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "watchlist_items: owner select"    ON public.watchlist_items;
DROP POLICY IF EXISTS "watchlist_items: owner insert"    ON public.watchlist_items;
DROP POLICY IF EXISTS "watchlist_items: owner update"    ON public.watchlist_items;
DROP POLICY IF EXISTS "watchlist_items: owner delete"    ON public.watchlist_items;

CREATE POLICY "watchlist_items: owner select"
  ON public.watchlist_items FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "watchlist_items: owner insert"
  ON public.watchlist_items FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "watchlist_items: owner update"
  ON public.watchlist_items FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "watchlist_items: owner delete"
  ON public.watchlist_items FOR DELETE
  USING (user_id = auth.uid());

-- ────────────────────────────────────────────────────────────────────────────────
-- 4. stage2_leaders — public read, server-only write (no user scoping)
-- ────────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.stage2_leaders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stage2_leaders: public read"   ON public.stage2_leaders;
DROP POLICY IF EXISTS "stage2_leaders: service write" ON public.stage2_leaders;

CREATE POLICY "stage2_leaders: public read"
  ON public.stage2_leaders FOR SELECT
  USING (true);

-- Only service_role (bypasses RLS) may write — no anon/authenticated write policy.

-- ────────────────────────────────────────────────────────────────────────────────
-- 5. subscriptions — new table (Section B)
-- ────────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  paddle_customer_id text        NOT NULL,
  paddle_sub_id      text        UNIQUE,
  status             text        NOT NULL DEFAULT 'trialing',
  -- status: trialing | active | past_due | paused | cancelled
  trial_ends_at      timestamptz,
  current_period_end timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- Index so middleware subscription look-up is O(1)
CREATE INDEX IF NOT EXISTS subscriptions_user_id_idx ON public.subscriptions (user_id);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subscriptions: owner select" ON public.subscriptions;

-- Users may read their own subscription row; INSERT/UPDATE/DELETE are service_role only.
CREATE POLICY "subscriptions: owner select"
  ON public.subscriptions FOR SELECT
  USING (user_id = auth.uid());

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
  RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS subscriptions_set_updated_at ON public.subscriptions;

CREATE TRIGGER subscriptions_set_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
