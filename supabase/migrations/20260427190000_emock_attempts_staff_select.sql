-- emock_attempts staff SELECT policy
--
-- The eMock practice exam tables (emock_attempts, emock_tutorial_progress)
-- are populated by lyfe-sg's /emock route. Their original RLS scopes every
-- read to auth.uid() = user_id, which means a manager opening a candidate's
-- detail screen on lyfe-app cannot see that candidate's practice scores —
-- the manager's JWT carries the manager's user_id, not the candidate's.
--
-- Add a SELECT policy that mirrors candidate_paper_attempts: staff can read
-- a candidate's attempts via the existing can_access_candidate_user() helper
-- (admin/director/manager-of-record/PA chain). The policy joins through
-- candidate_profiles to resolve emock_attempts.user_id back to a candidate.
--
-- Multiple SELECT policies on the same table are OR'd together by Postgres,
-- so the original "Users view own attempts" policy is unchanged.

CREATE POLICY "emock_attempts_staff_select"
    ON public.emock_attempts
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.candidate_profiles cp
            WHERE cp.user_id = emock_attempts.user_id
              AND public.can_access_candidate_user(cp.candidate_id)
        )
    );
