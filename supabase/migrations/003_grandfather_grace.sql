-- supabase/migrations/003_grandfather_grace.sql
--
-- Gives every existing beta user (who has no subscription row yet) a 30-day
-- grace period with status='grace'.  No card is required.
--
-- Safe to re-run: uses INSERT … ON CONFLICT DO NOTHING so it won't touch
-- users who already have a subscription row from Paddle.
--
-- DIAGNOSTIC (run first to see how many users would be affected):
--
--   SELECT COUNT(*) AS users_without_sub
--   FROM auth.users u
--   LEFT JOIN public.subscriptions s ON s.user_id = u.id
--   WHERE s.id IS NULL;

INSERT INTO public.subscriptions (user_id, status, trial_ends_at, created_at, updated_at)
SELECT
  u.id,
  'grace',
  NOW() + INTERVAL '30 days',
  NOW(),
  NOW()
FROM auth.users u
LEFT JOIN public.subscriptions s ON s.user_id = u.id
WHERE s.id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- Verify: show what was inserted
-- SELECT user_id, status, trial_ends_at
-- FROM public.subscriptions
-- WHERE status = 'grace'
-- ORDER BY created_at DESC
-- LIMIT 20;
