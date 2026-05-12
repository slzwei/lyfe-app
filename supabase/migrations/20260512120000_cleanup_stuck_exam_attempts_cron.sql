-- =====================================================================
-- 1.21 — Auto-timeout exam_attempts stuck in 'in_progress' > 24 hours
--
-- WHY:
--   If a mobile client crashes mid-quiz the attempt stays as
--   'in_progress' forever. The RLS policies on exam_answers
--   (20260228125859_create_exam_tables.sql:95, 100) and the policies
--   in initial_schema (645, 658) require status='in_progress', AND
--   typical app logic enforces "one in-progress attempt per paper
--   per user". Net effect: a single crashed attempt can lock a user
--   out of retaking that paper, with no in-app recovery path.
--
--   Verified 2026-05-12: 0 currently-stuck rows in prod (only 3
--   total exam_attempts exist, all 'submitted'). This is a
--   regression-prevention cron, not a backfill.
--
-- CONSTRAINT CHECK:
--   chk_exam_attempts_status + exam_attempts_status_check both allow
--   'timed_out' (verified via pg_constraint 2026-05-12). The two
--   duplicate constraints are an unrelated hygiene issue.
--
-- COLUMN NOTE:
--   The scope draft used `completed_at = now()`, but the table has
--   `submitted_at` not `completed_at`. We leave submitted_at NULL
--   for timed-out rows so downstream code can distinguish a real
--   submission from a sweeper-timeout. status='timed_out' is the
--   sole signal.
--
-- SCHEDULE:
--   Hourly. Cheap UPDATE — table will grow slowly (one attempt per
--   exam per user) so an hourly scan is fine for years.
--
-- ROLLBACK:
--   SELECT cron.unschedule('cleanup-stuck-exam-attempts');
-- =====================================================================

SELECT cron.schedule(
  'cleanup-stuck-exam-attempts',
  '0 * * * *',
  $cron$
    UPDATE public.exam_attempts
       SET status = 'timed_out'
     WHERE status = 'in_progress'
       AND started_at IS NOT NULL
       AND started_at < now() - interval '24 hours';
  $cron$
);
