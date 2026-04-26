-- supabase/migrations/004_add_is_admin.sql
--
-- Adds is_admin flag to user_profiles.
-- Admins can access /admin/users and grant comp accounts / extensions.
-- Default false so existing users are unaffected.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- RLS: admins should still be able to read ALL profiles (not just their own).
-- Create a policy that allows a user to read any profile if they are an admin.
-- The existing SELECT policy covers "own row"; this adds admin read-all.
CREATE POLICY IF NOT EXISTS "admins can read all profiles"
  ON public.user_profiles
  FOR SELECT
  USING (
    (SELECT is_admin FROM public.user_profiles WHERE id = auth.uid()) = true
  );

-- Admins can update any subscription (for comp/extend/revoke).
-- This covers the admin panel actions via the service role key, which bypasses
-- RLS anyway. The policy below is for completeness / direct SQL access.
CREATE POLICY IF NOT EXISTS "admins can update any subscription"
  ON public.subscriptions
  FOR UPDATE
  USING (
    (SELECT is_admin FROM public.user_profiles WHERE id = auth.uid()) = true
  );
