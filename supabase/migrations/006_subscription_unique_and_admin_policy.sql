-- Migration 006: UNIQUE constraint on subscriptions.user_id
--               + replace hardcoded-email RLS on asaf_thoughts with is_admin check
-- Run in Supabase Dashboard → SQL Editor

-- ── 1. subscriptions: enforce one row per user ────────────────────────────────
-- The start-trial route uses upsert with onConflict: 'user_id', which requires
-- an actual UNIQUE constraint (not just a primary key on a different column).

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_user_id_unique UNIQUE (user_id);

-- ── 2. asaf_thoughts: drop hardcoded-email RLS policies ───────────────────────

DROP POLICY IF EXISTS "asaf_thoughts_admin_insert" ON public.asaf_thoughts;
DROP POLICY IF EXISTS "asaf_thoughts_admin_update" ON public.asaf_thoughts;
DROP POLICY IF EXISTS "asaf_thoughts_admin_delete" ON public.asaf_thoughts;

-- ── 3. asaf_thoughts: recreate policies using is_admin flag ──────────────────
-- Same pattern as migration 004 — subselect avoids recursion in RLS.

CREATE POLICY "asaf_thoughts_admin_insert"
  ON public.asaf_thoughts FOR INSERT
  WITH CHECK (
    (SELECT is_admin FROM public.user_profiles WHERE id = auth.uid()) = true
  );

CREATE POLICY "asaf_thoughts_admin_update"
  ON public.asaf_thoughts FOR UPDATE
  USING (
    (SELECT is_admin FROM public.user_profiles WHERE id = auth.uid()) = true
  );

CREATE POLICY "asaf_thoughts_admin_delete"
  ON public.asaf_thoughts FOR DELETE
  USING (
    (SELECT is_admin FROM public.user_profiles WHERE id = auth.uid()) = true
  );
