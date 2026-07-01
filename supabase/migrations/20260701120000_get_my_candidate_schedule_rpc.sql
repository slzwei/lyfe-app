-- Candidate personal schedule ("What's next") for the lyfe-app mobile candidate
-- experience. A logged-in candidate sees their OWN upcoming recruitment dates in
-- one place: interviews, paper/exam sittings, prep-course bookings, and scheduled
-- milestones — soonest first.
--
-- WHY AN RPC (not client-side reads):
--   1. interviews is NOT self-readable by candidates — interviews_select uses the
--      older can_access_candidate(manager_id, created_by) helper (no candidate-self
--      clause), and the row carries internal hiring fields (notes, recommendation,
--      manager_id, scheduled_by_id) that must NEVER reach the candidate. This
--      SECURITY DEFINER function exposes only masked, schedule-safe columns.
--   2. The three lifecycle tables (paper_attempts / milestones / prep_bookings) ARE
--      already candidate self-readable via can_access_candidate_user(), but folding
--      all four sources into one masked, filtered, date-sorted result keeps the
--      client to a single round-trip with a consistent shape.
--
-- SELF-SCOPE (hardened per codex review 2026-07-01):
--   candidate_profiles.user_id is UNIQUE but candidate_profiles.candidate_id is NOT
--   (a candidate record can be linked to more than one auth user). So resolving by
--   user_id alone is not enough — we additionally require the caller to be an active
--   'candidate' whose candidate record is not archived / rejected / already an agent.
--   This blocks a stale staff or former-candidate profile from reading an agenda.
--
-- FILTERING: only rows that are genuinely "still to happen" surface — per-source
--   status filters (not just non-null dates), so cancelled/rescheduled interviews,
--   already-passed papers, attended courses, and un-scheduled milestones are excluded.
--   Multi-day items still active today are kept via COALESCE(end_at, start_at).
--   "Today" is evaluated in Asia/Singapore (all date columns are timestamptz).
--
-- Auth (Bucket C — self-guarding authenticated RPC): new functions are born
--   anon/authenticated-executable, so REVOKE anon/PUBLIC and GRANT only
--   authenticated + service_role. Anonymous callers are doubly denied: no EXECUTE
--   grant, and the `me` CTE resolves to no candidate_id when auth.uid() is null.

CREATE OR REPLACE FUNCTION public.get_my_candidate_schedule(
    p_include_past boolean DEFAULT false,
    p_limit int DEFAULT NULL
)
RETURNS TABLE(
    kind text,
    ref_id uuid,
    code text,
    start_at timestamptz,
    end_at timestamptz,
    location text,
    is_online boolean,
    status text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    WITH me AS (
        SELECT cp.candidate_id
        FROM candidate_profiles cp
        JOIN users u ON u.id = cp.user_id
        JOIN candidates c ON c.id = cp.candidate_id
        WHERE cp.user_id = auth.uid()
          AND u.role = 'candidate'
          AND u.is_active IS TRUE
          AND c.archived_at IS NULL
          AND c.status NOT IN ('rejected', 'active_agent')
        LIMIT 1
    ),
    items AS (
        -- Interviews (masked: no notes / recommendation / manager ids / zoom_link).
        SELECT
            'interview'::text AS kind,
            i.id AS ref_id,
            i.type::text AS code,
            i.datetime AS start_at,
            NULL::timestamptz AS end_at,
            CASE WHEN i.type = 'in_person' THEN i.location ELSE NULL END::text AS location,
            (i.type = 'zoom')::boolean AS is_online,
            i.status::text AS status
        FROM interviews i
        WHERE i.candidate_id = (SELECT candidate_id FROM me)
          AND i.status = 'scheduled'
          AND i.datetime IS NOT NULL

        UNION ALL

        -- Paper / exam sittings that haven't happened yet (no result recorded).
        SELECT
            'paper', pa.id, pa.paper_code, pa.exam_at, NULL,
            NULL, false, 'scheduled'
        FROM candidate_paper_attempts pa
        WHERE pa.candidate_id = (SELECT candidate_id FROM me)
          AND pa.exam_at IS NOT NULL
          AND pa.result IS NULL

        UNION ALL

        -- Prep-course bookings not yet attended.
        SELECT
            'prep_course', b.id, b.course_code, b.booked_date, b.booked_end_date,
            NULL, false, 'booked'
        FROM candidate_prep_course_bookings b
        WHERE b.candidate_id = (SELECT candidate_id FROM me)
          AND b.booked_date IS NOT NULL
          AND b.attended = false

        UNION ALL

        -- Milestones with a scheduled date still pending (BDM/BES/SOAR/RNF/Sales Authority).
        SELECT
            'milestone', m.id, m.milestone_code, m.scheduled_date, m.scheduled_end_date,
            NULL, false, m.status
        FROM candidate_milestones m
        WHERE m.candidate_id = (SELECT candidate_id FROM me)
          AND m.scheduled_date IS NOT NULL
          AND m.status = 'scheduled'
    )
    SELECT kind, ref_id, code, start_at, end_at, location, is_online, status
    FROM items
    WHERE p_include_past
       OR (
           (COALESCE(end_at, start_at) AT TIME ZONE 'Asia/Singapore')::date
           >= (now() AT TIME ZONE 'Asia/Singapore')::date
       )
    ORDER BY start_at ASC
    LIMIT p_limit;
$$;

REVOKE ALL ON FUNCTION public.get_my_candidate_schedule(boolean, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_candidate_schedule(boolean, int) TO authenticated, service_role;

COMMENT ON FUNCTION public.get_my_candidate_schedule(boolean, int) IS
    'Candidate self-service "What''s next" agenda: the caller''s own upcoming interviews / paper sittings / prep bookings / scheduled milestones, soonest first. SECURITY DEFINER + masked columns (never notes/recommendation/cost/reference_number/zoom_link). Self-scoped to an active candidate whose record is not archived/rejected/active_agent. EXECUTE revoked from anon; authenticated + service_role only.';

-- Partial indexes matching the exact per-source predicates (small tables today,
-- but keeps the home-card query plan predictable as candidate volume grows).
CREATE INDEX IF NOT EXISTS idx_interviews_candidate_scheduled
    ON public.interviews (candidate_id, datetime)
    WHERE status = 'scheduled'::interview_status;

CREATE INDEX IF NOT EXISTS idx_cpa_candidate_upcoming
    ON public.candidate_paper_attempts (candidate_id, exam_at)
    WHERE result IS NULL AND exam_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cpcb_candidate_upcoming
    ON public.candidate_prep_course_bookings (candidate_id, booked_date)
    WHERE attended = false AND booked_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cm_candidate_scheduled
    ON public.candidate_milestones (candidate_id, scheduled_date)
    WHERE status = 'scheduled' AND scheduled_date IS NOT NULL;
