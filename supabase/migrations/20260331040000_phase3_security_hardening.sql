-- Phase 3 Security Hardening
-- Items: 3.18 (exam RLS), 3.19 (email_otp_codes blocking), 3.24 (notification cleanup cron)

-- ═══════════════════════════════════════════════════════════════════
-- 3.18: Fix exam RLS policies — replace users JOIN with JWT check
-- The EXISTS (SELECT 1 FROM users ...) pattern can cause infinite
-- recursion when users table has RLS policies.
-- ═══════════════════════════════════════════════════════════════════

-- exam_papers: admin ALL policy
DROP POLICY IF EXISTS exam_papers_admin ON public.exam_papers;
CREATE POLICY exam_papers_admin ON public.exam_papers
  FOR ALL TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- exam_questions: admin ALL policy
DROP POLICY IF EXISTS exam_questions_admin ON public.exam_questions;
CREATE POLICY exam_questions_admin ON public.exam_questions
  FOR ALL TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- exam_attempts: admin ALL policy (if exists)
DROP POLICY IF EXISTS exam_attempts_admin ON public.exam_attempts;
CREATE POLICY exam_attempts_admin ON public.exam_attempts
  FOR ALL TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- exam_answers: admin ALL policy (if exists)
DROP POLICY IF EXISTS exam_answers_admin ON public.exam_answers;
CREATE POLICY exam_answers_admin ON public.exam_answers
  FOR ALL TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- ═══════════════════════════════════════════════════════════════════
-- 3.19: Add blocking policy to email_otp_codes
-- Table has RLS enabled but zero policies — safe only because all
-- access uses service-role. Add explicit deny for extra safety.
-- ═══════════════════════════════════════════════════════════════════

CREATE POLICY email_otp_codes_deny_all ON public.email_otp_codes
  FOR ALL TO authenticated
  USING (false);

-- ═══════════════════════════════════════════════════════════════════
-- 3.24: Notification cleanup — delete read notifications older than 90 days
-- This creates a pg_cron job (requires pg_cron extension enabled)
-- ═══════════════════════════════════════════════════════════════════

-- Create a helper function for the cron job
CREATE OR REPLACE FUNCTION public.cleanup_old_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM notifications
  WHERE is_read = true
    AND created_at < now() - interval '90 days';
END;
$$;

-- Schedule daily cleanup at 3am SGT (7pm UTC previous day)
-- Note: requires pg_cron extension. If not available, run manually.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'cleanup-old-notifications',
      '0 19 * * *',
      $cron$SELECT public.cleanup_old_notifications()$cron$
    );
  END IF;
END;
$$;
