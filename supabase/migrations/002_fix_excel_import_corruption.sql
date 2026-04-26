-- supabase/migrations/002_fix_excel_import_corruption.sql
--
-- Conservative data fix for Excel-imported trades that have exit_price set
-- but are still flagged status='open'. This pattern indicates the Israeli
-- date format (DD/MM/YYYY) was misread as US (MM/DD/YYYY), causing sell
-- transactions to sort before buys and the position to be left "open".
--
-- DIAGNOSTIC (run first to see affected rows):
--
--   SELECT id, ticker, phase1_date, exit_date, exit_price, pnl_dollars, status
--   FROM public.trades
--   WHERE is_what_if = true
--     AND status = 'open'
--     AND exit_price IS NOT NULL
--     AND exit_price > 0;
--
-- Only updates rows that unambiguously should be closed:
--   is_what_if = true (broker-imported)
--   status = 'open'
--   exit_price IS NOT NULL AND > 0
--   exit_date IS NOT NULL
--
-- Sets status='closed', outcome based on pnl_dollars sign.
-- Does NOT touch system trades (is_what_if = false).

UPDATE public.trades
SET
  status  = 'closed',
  outcome = CASE
    WHEN pnl_dollars > 0.005   THEN 'winner'
    WHEN pnl_dollars < -0.005  THEN 'loser'
    ELSE 'breakeven'
  END
WHERE
  is_what_if  = true
  AND status  = 'open'
  AND exit_price IS NOT NULL
  AND exit_price > 0
  AND exit_date  IS NOT NULL;

-- Report how many rows were updated (visible in Supabase SQL editor output)
-- SELECT COUNT(*) AS rows_fixed FROM public.trades WHERE is_what_if = true AND status = 'closed' AND updated_at > NOW() - INTERVAL '5 minutes';
