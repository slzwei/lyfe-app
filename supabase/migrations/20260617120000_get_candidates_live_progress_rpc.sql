-- Live-applicant progress aggregate for the lyfe-app dashboard "Now onboarding"
-- widget (v2 — precise counts). v1 of the widget shows only the coarse broadcast
-- phase (form / quiz / viewing-results); this RPC adds the exact numbers:
-- onboarding step (n/6) and quiz answers (n/36 enneagram, with a legacy DISC
-- fallback) plus completion flags — the same shape as lyfe-sg's getProgressForUser.
--
-- WHY AN RPC (not a client-side read): enneagram_responses / enneagram_results
-- are RLS-locked to the candidate themselves (auth.uid() = user_id), so staff
-- cannot read a candidate's quiz answers directly. This SECURITY DEFINER function
-- reads them on the caller's behalf and returns only aggregate counts (never the
-- raw answers), gated per-row by can_access_candidate_user() so a caller only ever
-- sees candidates they're already authorised for (the assigned manager, that
-- manager's director via reports_to, admin/director/ro, the candidate, or a PA of
-- the manager). The lib layer additionally only ever passes user_ids already in
-- the viewer's authorised live-scope map, so this is defence-in-depth.
--
-- Auth: Bucket C (self-guarding authenticated RPC). Per the M9 audit, new
-- functions are born anon/authenticated-executable, so we REVOKE anon and GRANT
-- only authenticated + service_role. Anonymous callers are doubly denied: no
-- EXECUTE grant, and can_access_candidate_user() returns false when auth.uid() is
-- null.

CREATE OR REPLACE FUNCTION public.get_candidates_live_progress(p_user_ids uuid[])
RETURNS TABLE(
    user_id uuid,
    onboarding_step int,
    profile_completed boolean,
    quiz_answered int,
    quiz_completed boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT
        cp.user_id,
        COALESCE(cp.onboarding_step, 1) AS onboarding_step,
        COALESCE(cp.completed, false) AS profile_completed,
        -- Prefer the enneagram answer count (current flow); fall back to DISC
        -- (legacy) when only that row exists. responses is NOT NULL DEFAULT '{}'.
        CASE
            WHEN er.user_id IS NOT NULL
                THEN (SELECT count(*)::int FROM jsonb_object_keys(er.responses))
            WHEN dr.user_id IS NOT NULL
                THEN (SELECT count(*)::int FROM jsonb_object_keys(dr.responses))
            ELSE 0
        END AS quiz_answered,
        (enr.user_id IS NOT NULL OR dres.user_id IS NOT NULL) AS quiz_completed
    FROM public.candidate_profiles cp
    LEFT JOIN public.enneagram_responses er ON er.user_id = cp.user_id
    LEFT JOIN public.disc_responses dr ON dr.user_id = cp.user_id
    LEFT JOIN public.enneagram_results enr ON enr.user_id = cp.user_id
    LEFT JOIN public.disc_results dres ON dres.user_id = cp.user_id
    WHERE cp.user_id = ANY(p_user_ids)
      AND public.can_access_candidate_user(cp.candidate_id);
$$;

REVOKE ALL ON FUNCTION public.get_candidates_live_progress(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_candidates_live_progress(uuid[]) TO authenticated, service_role;

COMMENT ON FUNCTION public.get_candidates_live_progress(uuid[]) IS
    'Aggregate onboarding/quiz progress (step n/6, quiz n/36, completion flags) for the dashboard live-applicant widget. SECURITY DEFINER: reads candidate-only enneagram/disc tables on the caller''s behalf, gated per-row by can_access_candidate_user(). Returns counts only, never raw answers. EXECUTE revoked from anon per M9; authenticated + service_role only.';
