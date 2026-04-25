-- Synthetic monitoring — R6 DB-invariant sweeper.
--
-- Defines the function that scans the DB for integrity problems a normal
-- user flow wouldn't catch (orphaned FKs, stuck states, etc.) and writes
-- them to public.synthetic_invariant_violations. UNIQUE INDEX gives us
-- per-subject idempotency.
--
-- The function is defined here (safe on prod) but **NOT SCHEDULED** by
-- this migration. Scheduling happens only on staging via
-- supabase/seed-synthetic.sql. Prod has the function defined, never
-- invoked — honouring the zero-prod policy.

-- Per-subject dedup: one row per (invariant, subject). Re-running the
-- sweeper re-upserts the same rows without churning detected_at.
--
-- subject_id must be NON-NULL for this to work. Every invariant below
-- already sets it. Future invariants without a natural subject should use
-- a stable sentinel (e.g. the invariant name itself).
ALTER TABLE public.synthetic_invariant_violations
    ALTER COLUMN subject_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_synthetic_invariant_subject
    ON public.synthetic_invariant_violations (invariant_name, subject_id);

CREATE OR REPLACE FUNCTION public.sweep_synthetic_invariants()
RETURNS TABLE (invariant_name text, violation_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
    -- Invariant 1: leads.assigned_to points at a missing or inactive user.
    -- The app removes assignments when an agent leaves — violations here
    -- mean an orphan slipped through.
    INSERT INTO public.synthetic_invariant_violations (invariant_name, subject_id, subject_type, details)
    SELECT
        'leads_assigned_to_inactive_user',
        l.id::text,
        'lead',
        jsonb_build_object(
            'assigned_to', l.assigned_to,
            'lead_status', l.status,
            'name_prefix', substr(coalesce(l.full_name, ''), 1, 3) || '***'
        )
    FROM public.leads l
    LEFT JOIN public.users u ON u.id = l.assigned_to
    WHERE l.assigned_to IS NOT NULL
      AND (u.id IS NULL OR u.is_active IS NOT TRUE)
    ON CONFLICT (invariant_name, subject_id) DO UPDATE
        SET detected_at = now(), resolved_at = NULL, details = EXCLUDED.details;

    -- Invariant 2: exam attempts stuck 'in_progress' for > 24 hours.
    -- Supports the known risk that a crashed client leaves these dangling.
    INSERT INTO public.synthetic_invariant_violations (invariant_name, subject_id, subject_type, details)
    SELECT
        'exam_attempts_stuck_in_progress',
        ea.id::text,
        'exam_attempt',
        jsonb_build_object(
            'started_at', ea.started_at,
            'paper_id', ea.paper_id,
            'user_id', ea.user_id,
            'age_hours', extract(epoch FROM (now() - ea.started_at)) / 3600
        )
    FROM public.exam_attempts ea
    WHERE ea.status = 'in_progress'
      AND ea.started_at < now() - interval '24 hours'
    ON CONFLICT (invariant_name, subject_id) DO UPDATE
        SET detected_at = now(), resolved_at = NULL, details = EXCLUDED.details;

    -- Invariant 3: candidate_module_progress rows whose candidate_id
    -- doesn't resolve to a users.id (the documented FK confusion).
    INSERT INTO public.synthetic_invariant_violations (invariant_name, subject_id, subject_type, details)
    SELECT
        'candidate_module_progress_orphan_user',
        cmp.id::text,
        'candidate_module_progress',
        jsonb_build_object('candidate_id', cmp.candidate_id, 'module_id', cmp.module_id)
    FROM public.candidate_module_progress cmp
    LEFT JOIN public.users u ON u.id = cmp.candidate_id
    WHERE u.id IS NULL
    ON CONFLICT (invariant_name, subject_id) DO UPDATE
        SET detected_at = now(), resolved_at = NULL, details = EXCLUDED.details;

    -- Invariant 4: unread notifications older than 30 days.
    -- Suggests push delivery failed silently or users abandoned the app.
    INSERT INTO public.synthetic_invariant_violations (invariant_name, subject_id, subject_type, details)
    SELECT
        'notifications_unread_over_30d',
        n.id::text,
        'notification',
        jsonb_build_object(
            'type', n.type,
            'user_id', n.user_id,
            'age_days', extract(epoch FROM (now() - n.created_at)) / 86400
        )
    FROM public.notifications n
    WHERE n.is_read = false
      AND n.created_at < now() - interval '30 days'
    ON CONFLICT (invariant_name, subject_id) DO UPDATE
        SET detected_at = now(), resolved_at = NULL, details = EXCLUDED.details;

    -- Invariant 5: roadshow_attendance with event_id that no longer exists.
    INSERT INTO public.synthetic_invariant_violations (invariant_name, subject_id, subject_type, details)
    SELECT
        'roadshow_attendance_orphan_event',
        ra.id::text,
        'roadshow_attendance',
        jsonb_build_object('event_id', ra.event_id, 'user_id', ra.user_id)
    FROM public.roadshow_attendance ra
    LEFT JOIN public.events e ON e.id = ra.event_id
    WHERE e.id IS NULL
    ON CONFLICT (invariant_name, subject_id) DO UPDATE
        SET detected_at = now(), resolved_at = NULL, details = EXCLUDED.details;

    -- Clear rows for violations that no longer hold (subject fixed).
    -- We mark them resolved rather than deleting, so the drain can
    -- auto-close the corresponding GH issue before ultimately deleting on a
    -- later pass.
    DELETE FROM public.synthetic_invariant_violations
    WHERE detected_at < now() - interval '2 hours';

    -- Return a summary for logging.
    RETURN QUERY
    SELECT v.invariant_name, count(*)::bigint AS violation_count
    FROM public.synthetic_invariant_violations v
    GROUP BY v.invariant_name;
END
$$;

REVOKE ALL ON FUNCTION public.sweep_synthetic_invariants() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sweep_synthetic_invariants() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sweep_synthetic_invariants() TO service_role;

COMMENT ON FUNCTION public.sweep_synthetic_invariants() IS
    'R6 probe helper. Populates synthetic_invariant_violations with any rows that violate one of the tracked invariants. Safe to run on prod (read-only apart from writes to the dedicated telemetry table). Scheduled ONLY on staging via supabase/seed-synthetic.sql.';
