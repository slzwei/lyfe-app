-- =============================================================================
-- Production Audit Fixes
-- =============================================================================
-- C1:    get_lead_pipeline_stats — add caller auth check (SECURITY DEFINER gap)
-- D-H1:  submit_exam_attempt — server-side score computation (client trust removed)
-- D-H2:  RLS helper functions — wrap in (SELECT ...) to prevent per-row evaluation
-- IDX1:  Missing composite indexes on leads and lead_activities
-- PS1:   progress_signals SELECT policy — scope to authenticated only
-- CHK1:  exam_attempts.status CHECK constraint — add if missing
-- CLN1:  cleanup_old_notifications() — unbounded growth protection
-- JSONB1: exam_questions.options shape CHECK — require A/B/C/D keys
-- =============================================================================


-- =============================================================================
-- C1: Fix get_lead_pipeline_stats — add caller auth check
-- =============================================================================
-- The function is SECURITY DEFINER and accepts any p_user_id with no
-- validation. Any authenticated user could query another user's pipeline.
-- FIX: caller must be the target user, OR have admin/director role, OR be
-- the target user's direct manager (reports_to = auth.uid()).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_lead_pipeline_stats(p_user_id uuid)
RETURNS TABLE(
  status text,
  count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_role text;
BEGIN
  -- Must be authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: not authenticated';
  END IF;

  v_caller_role := auth.jwt() -> 'app_metadata' ->> 'role';

  -- Allow: caller is the target user themselves
  -- Allow: caller is admin or director (see all)
  -- Allow: caller is the direct manager of the target user
  IF auth.uid() = p_user_id
     OR v_caller_role IN ('admin', 'director')
     OR EXISTS (
         SELECT 1 FROM users u
         WHERE u.id = p_user_id
           AND u.reports_to = auth.uid()
     )
  THEN
    RETURN QUERY
      SELECT
        l.status::text,
        COUNT(*)::bigint
      FROM leads l
      WHERE l.assigned_to = p_user_id
      GROUP BY l.status;
  ELSE
    RAISE EXCEPTION 'Unauthorized: caller does not have access to user % pipeline stats', p_user_id;
  END IF;
END;
$$;

-- Verify: unauthenticated caller → exception 'not authenticated'
-- Verify: authenticated user querying own stats → results returned
-- Verify: admin querying any user → results returned
-- Verify: manager querying direct report → results returned
-- Verify: agent querying another agent → exception 'does not have access'


-- =============================================================================
-- D-H1: Fix submit_exam_attempt — server-side score computation
-- =============================================================================
-- Previously accepted p_score, p_passed, p_percentage from the client.
-- A candidate could submit falsified scores. After inserting answers, we now
-- compute the score server-side by joining submitted answers against
-- exam_questions.correct_answer and read the pass threshold from
-- exam_papers.pass_percentage.
-- =============================================================================

CREATE OR REPLACE FUNCTION submit_exam_attempt(
    p_user_id           uuid,
    p_paper_id          uuid,
    p_status            text,
    p_score             int,          -- accepted for API compat but IGNORED
    p_total_questions   int,
    p_percentage        int,          -- accepted for API compat but IGNORED
    p_passed            boolean,      -- accepted for API compat but IGNORED
    p_started_at        timestamptz,
    p_submitted_at      timestamptz,
    p_duration_seconds  int,
    p_personality_results jsonb DEFAULT NULL,
    p_answers           jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_attempt_id        uuid;
    v_server_score      int;
    v_server_percentage numeric(5,2);
    v_server_passed     boolean;
    v_pass_threshold    int;
BEGIN
    -- Verify the caller is who they claim to be
    IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
        RAISE EXCEPTION 'Unauthorized: caller must match p_user_id';
    END IF;

    -- 1. Insert the attempt as 'in_progress' with placeholder scores.
    --    RLS on exam_answers requires status = 'in_progress' during answer insert.
    INSERT INTO exam_attempts (
        user_id, paper_id, status,
        score, total_questions, percentage, passed,
        started_at, submitted_at, duration_seconds,
        personality_results
    ) VALUES (
        p_user_id, p_paper_id, 'in_progress',
        NULL, p_total_questions, NULL, NULL,
        p_started_at, p_submitted_at, p_duration_seconds,
        p_personality_results
    )
    RETURNING id INTO v_attempt_id;

    -- 2. Insert all submitted answers in one batch.
    --    is_correct is computed server-side from exam_questions.correct_answer.
    INSERT INTO exam_answers (attempt_id, question_id, selected_answer, is_correct)
    SELECT
        v_attempt_id,
        (ans->>'question_id')::uuid,
        ans->>'selected_answer',
        -- Server-side correctness: compare against the stored correct answer
        CASE
            WHEN eq.correct_answer IS NOT NULL
            THEN (ans->>'selected_answer') = eq.correct_answer
            ELSE NULL  -- personality/VARK/Enneagram questions have no correct answer
        END
    FROM jsonb_array_elements(p_answers) AS ans
    LEFT JOIN exam_questions eq
        ON eq.id = (ans->>'question_id')::uuid;

    -- 3. Compute server-side score for knowledge-based exams.
    --    Personality exam papers (DISC, VARK, Enneagram) have no correct_answer
    --    values, so v_server_score will be 0 — that is fine because p_personality_results
    --    carries the meaningful output for those papers.
    SELECT COUNT(*) FILTER (WHERE ea.is_correct = true)
    INTO v_server_score
    FROM exam_answers ea
    WHERE ea.attempt_id = v_attempt_id;

    -- 4. Read pass threshold from exam_papers (column exists since initial schema).
    SELECT COALESCE(ep.pass_percentage, 70)
    INTO v_pass_threshold
    FROM exam_papers ep
    WHERE ep.id = p_paper_id;

    -- 5. Derive percentage and passed from server-computed values.
    IF p_total_questions > 0 THEN
        v_server_percentage := ROUND((v_server_score::numeric / p_total_questions) * 100, 2);
    ELSE
        v_server_percentage := 0;
    END IF;

    v_server_passed := v_server_percentage >= v_pass_threshold;

    -- 6. Update attempt to final status with server-computed scores.
    UPDATE exam_attempts
    SET
        status     = p_status,
        score      = v_server_score,
        percentage = v_server_percentage,
        passed     = v_server_passed
    WHERE id = v_attempt_id;

    RETURN jsonb_build_object(
        'attempt_id',  v_attempt_id,
        'score',       v_server_score,
        'percentage',  v_server_percentage,
        'passed',      v_server_passed
    );
END;
$$;

-- Verify: returned score matches COUNT(is_correct=true) from exam_answers
-- Verify: client-supplied p_score is ignored — DB row shows server value
-- Verify: pass threshold read from exam_papers.pass_percentage, default 70


-- =============================================================================
-- D-H2: Wrap RLS helper function calls in (SELECT ...) for single evaluation
-- =============================================================================
-- Policies that call can_access_lead(), can_access_candidate(), and
-- can_access_candidate_user() without (SELECT ...) cause the function to be
-- invoked once per row being evaluated. Wrapping in (SELECT ...) tells the
-- planner to evaluate the expression once and cache the result, which is safe
-- because the helper functions are STABLE and take no row-specific arguments
-- (they only receive columns that are already available).
--
-- For subquery-based policies (lead_activities, interviews, etc.) the helper
-- is called inside an EXISTS(...) which is already re-evaluated per row with
-- the correct column values — those are also fixed below.
--
-- Affected policies (latest version as of 20260331020000):
--   leads:                       leads_select, leads_update
--   lead_activities:             lead_activities_select, lead_activities_insert
--   candidates:                  candidates_select, candidates_update
--   interviews:                  interviews_select, interviews_insert, interviews_update
--   candidate_activities:        candidate_activities_select
--   candidate_documents:         candidate_documents_select, _insert, _delete
--   candidate_module_progress:   progress_select, progress_upsert, progress_update
--   candidate_module_item_progress: item_progress_select, _insert, _update
--   candidate_programme_enrollment: enrollment_select, enrollment_upsert, enrollment_update
-- =============================================================================


-- ----------------------------------------------------------------------------
-- leads
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS leads_select ON leads;
DROP POLICY IF EXISTS leads_update ON leads;

CREATE POLICY leads_select ON leads
    FOR SELECT TO authenticated
    USING ((SELECT can_access_lead(assigned_to, created_by)));

CREATE POLICY leads_update ON leads
    FOR UPDATE TO authenticated
    USING ((SELECT can_access_lead(assigned_to, created_by)));


-- ----------------------------------------------------------------------------
-- lead_activities (subquery pattern — wrap inner helper call)
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS lead_activities_select ON lead_activities;
DROP POLICY IF EXISTS lead_activities_insert ON lead_activities;

CREATE POLICY lead_activities_select ON lead_activities
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM leads l
        WHERE l.id = lead_activities.lead_id
          AND (SELECT can_access_lead(l.assigned_to, l.created_by))
    ));

CREATE POLICY lead_activities_insert ON lead_activities
    FOR INSERT TO authenticated
    WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM leads l
            WHERE l.id = lead_activities.lead_id
              AND (SELECT can_access_lead(l.assigned_to, l.created_by))
        )
    );


-- ----------------------------------------------------------------------------
-- candidates
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS candidates_select ON candidates;
DROP POLICY IF EXISTS candidates_update ON candidates;

CREATE POLICY candidates_select ON candidates
    FOR SELECT TO authenticated
    USING ((SELECT can_access_candidate(assigned_manager_id, created_by_id)));

CREATE POLICY candidates_update ON candidates
    FOR UPDATE TO authenticated
    USING ((SELECT can_access_candidate(assigned_manager_id, created_by_id)));


-- ----------------------------------------------------------------------------
-- interviews (subquery pattern)
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS interviews_select ON interviews;
DROP POLICY IF EXISTS interviews_insert ON interviews;
DROP POLICY IF EXISTS interviews_update ON interviews;

CREATE POLICY interviews_select ON interviews
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM candidates c
        WHERE c.id = interviews.candidate_id
          AND (SELECT can_access_candidate(c.assigned_manager_id, c.created_by_id))
    ));

CREATE POLICY interviews_insert ON interviews
    FOR INSERT TO authenticated
    WITH CHECK (
        (scheduled_by_id = auth.uid() OR manager_id = auth.uid())
        AND EXISTS (
            SELECT 1 FROM candidates c
            WHERE c.id = interviews.candidate_id
              AND (SELECT can_access_candidate(c.assigned_manager_id, c.created_by_id))
        )
    );

CREATE POLICY interviews_update ON interviews
    FOR UPDATE TO authenticated
    USING (
        scheduled_by_id = auth.uid()
        OR manager_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM candidates c
            WHERE c.id = interviews.candidate_id
              AND (SELECT can_access_candidate(c.assigned_manager_id, c.created_by_id))
        )
    );


-- ----------------------------------------------------------------------------
-- candidate_activities (subquery pattern)
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS candidate_activities_select ON candidate_activities;

CREATE POLICY candidate_activities_select ON candidate_activities
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM candidates c
        WHERE c.id = candidate_activities.candidate_id
          AND (SELECT can_access_candidate(c.assigned_manager_id, c.created_by_id))
    ));


-- ----------------------------------------------------------------------------
-- candidate_documents (subquery pattern)
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS candidate_documents_select ON candidate_documents;
DROP POLICY IF EXISTS candidate_documents_insert ON candidate_documents;
DROP POLICY IF EXISTS candidate_documents_delete ON candidate_documents;

CREATE POLICY candidate_documents_select ON candidate_documents
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM candidates c
        WHERE c.id = candidate_documents.candidate_id
          AND (SELECT can_access_candidate(c.assigned_manager_id, c.created_by_id))
    ));

CREATE POLICY candidate_documents_insert ON candidate_documents
    FOR INSERT TO authenticated
    WITH CHECK (EXISTS (
        SELECT 1 FROM candidates c
        WHERE c.id = candidate_documents.candidate_id
          AND (SELECT can_access_candidate(c.assigned_manager_id, c.created_by_id))
    ));

CREATE POLICY candidate_documents_delete ON candidate_documents
    FOR DELETE TO authenticated
    USING (EXISTS (
        SELECT 1 FROM candidates c
        WHERE c.id = candidate_documents.candidate_id
          AND (SELECT can_access_candidate(c.assigned_manager_id, c.created_by_id))
    ));


-- ----------------------------------------------------------------------------
-- candidate_module_progress (uses can_access_candidate_user — latest version
-- from 20260331020000, takes candidates(id) not users(id))
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS progress_select ON candidate_module_progress;
DROP POLICY IF EXISTS progress_upsert ON candidate_module_progress;
DROP POLICY IF EXISTS progress_update ON candidate_module_progress;

CREATE POLICY progress_select ON candidate_module_progress
    FOR SELECT TO authenticated
    USING ((SELECT can_access_candidate_user(candidate_id)));

CREATE POLICY progress_upsert ON candidate_module_progress
    FOR INSERT TO authenticated
    WITH CHECK ((SELECT can_access_candidate_user(candidate_id)));

CREATE POLICY progress_update ON candidate_module_progress
    FOR UPDATE TO authenticated
    USING ((SELECT can_access_candidate_user(candidate_id)));


-- ----------------------------------------------------------------------------
-- candidate_module_item_progress
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS item_progress_select ON candidate_module_item_progress;
DROP POLICY IF EXISTS item_progress_insert ON candidate_module_item_progress;
DROP POLICY IF EXISTS item_progress_update ON candidate_module_item_progress;

CREATE POLICY item_progress_select ON candidate_module_item_progress
    FOR SELECT TO authenticated
    USING ((SELECT can_access_candidate_user(candidate_id)));

CREATE POLICY item_progress_insert ON candidate_module_item_progress
    FOR INSERT TO authenticated
    WITH CHECK ((SELECT can_access_candidate_user(candidate_id)));

CREATE POLICY item_progress_update ON candidate_module_item_progress
    FOR UPDATE TO authenticated
    USING ((SELECT can_access_candidate_user(candidate_id)));


-- ----------------------------------------------------------------------------
-- candidate_programme_enrollment (uses can_access_candidate — last set in
-- 20260311000000, not overridden by later migrations)
-- ----------------------------------------------------------------------------

DROP POLICY IF EXISTS enrollment_select ON candidate_programme_enrollment;
DROP POLICY IF EXISTS enrollment_upsert ON candidate_programme_enrollment;
DROP POLICY IF EXISTS enrollment_update ON candidate_programme_enrollment;

CREATE POLICY enrollment_select ON candidate_programme_enrollment
    FOR SELECT TO authenticated
    USING ((SELECT can_access_candidate(
        (SELECT assigned_manager_id FROM candidates WHERE id = candidate_programme_enrollment.candidate_id),
        (SELECT created_by_id        FROM candidates WHERE id = candidate_programme_enrollment.candidate_id)
    )));

CREATE POLICY enrollment_upsert ON candidate_programme_enrollment
    FOR INSERT TO authenticated
    WITH CHECK ((SELECT can_access_candidate(
        (SELECT assigned_manager_id FROM candidates WHERE id = candidate_programme_enrollment.candidate_id),
        (SELECT created_by_id        FROM candidates WHERE id = candidate_programme_enrollment.candidate_id)
    )));

CREATE POLICY enrollment_update ON candidate_programme_enrollment
    FOR UPDATE TO authenticated
    USING ((SELECT can_access_candidate(
        (SELECT assigned_manager_id FROM candidates WHERE id = candidate_programme_enrollment.candidate_id),
        (SELECT created_by_id        FROM candidates WHERE id = candidate_programme_enrollment.candidate_id)
    )));

-- Verify: EXPLAIN on leads SELECT should show "Function Scan" without per-row
--         can_access_lead calls — planner will hoist the (SELECT ...) subexpr


-- =============================================================================
-- IDX1: Missing composite indexes
-- =============================================================================
-- (assigned_to, status) supports the common "show my leads by status" query
-- and the get_lead_pipeline_stats GROUP BY after the WHERE.
-- (lead_id, created_at DESC) supports lead detail activity feeds with ordering.
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_leads_assigned_to_status
    ON leads (assigned_to, status);

CREATE INDEX IF NOT EXISTS idx_lead_activities_lead_id_created
    ON lead_activities (lead_id, created_at DESC);

-- Verify: EXPLAIN on leads WHERE assigned_to=$1 AND status=$2 → Index Scan
-- Verify: EXPLAIN on lead_activities WHERE lead_id=$1 ORDER BY created_at DESC → Index Scan


-- =============================================================================
-- PS1: progress_signals SELECT — scope to authenticated role
-- =============================================================================
-- The original policy (20260320173645) uses USING (true) with no TO clause,
-- which means unauthenticated (anon) clients can read the table.
-- The Supabase Realtime subscription in lyfe-app uses an authenticated JWT,
-- so restricting to `TO authenticated` does not break any legitimate use case.
-- =============================================================================

DROP POLICY IF EXISTS "Anyone can read signals" ON progress_signals;

CREATE POLICY "Authenticated users can read signals" ON progress_signals
    FOR SELECT TO authenticated
    USING (true);

-- Verify: anon key without JWT → empty result on progress_signals SELECT
-- Verify: authenticated JWT → row returned as before


-- =============================================================================
-- CHK1: exam_attempts.status CHECK constraint
-- =============================================================================
-- The CREATE TABLE in 20260228125859_create_exam_tables.sql defines this
-- constraint inline (unnamed). The initial schema snapshot (00000000000000)
-- does not. Both may exist in different environments. The DO block adds it only
-- if no equivalent constraint is present, using exception handling to be safe.
-- =============================================================================

DO $$
BEGIN
    ALTER TABLE exam_attempts
        ADD CONSTRAINT chk_exam_attempts_status
        CHECK (status IN ('in_progress', 'submitted', 'auto_submitted', 'timed_out'));
EXCEPTION
    WHEN duplicate_object THEN
        -- Constraint already exists under this name — skip
        NULL;
    WHEN check_violation THEN
        -- Existing data violates the constraint — surface the error
        RAISE;
END;
$$;

-- Verify: INSERT INTO exam_attempts (..., status='invalid') → CHECK violation
-- Verify: duplicate run → no error (exception caught)


-- =============================================================================
-- CLN1: cleanup_old_notifications() — unbounded growth protection
-- =============================================================================
-- NOTE: This function must be wired to pg_cron for automatic execution.
-- Recommended schedule: daily at 02:00 SGT (18:00 UTC previous day).
-- Example (run in Supabase Dashboard → SQL Editor, requires pg_cron extension):
--
--   SELECT cron.schedule(
--     'cleanup-old-notifications',
--     '0 18 * * *',
--     $$SELECT public.cleanup_old_notifications()$$
--   );
--
-- Without the cron job, the notifications table will grow unboundedly.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_old_notifications()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_deleted integer;
BEGIN
    -- Delete unread notifications older than 1 year (likely stale/orphaned)
    DELETE FROM notifications
    WHERE is_read = false
      AND created_at < now() - interval '1 year';

    -- Delete read notifications older than 90 days (already acted upon)
    DELETE FROM notifications
    WHERE is_read = true
      AND created_at < now() - interval '90 days';

    GET DIAGNOSTICS v_deleted = ROW_COUNT;

    RETURN v_deleted;
END;
$$;

COMMENT ON FUNCTION public.cleanup_old_notifications() IS
    'Deletes unread notifications older than 1 year and read notifications older than 90 days. '
    'Schedule via pg_cron daily at 02:00 SGT. Without a scheduled cron job the table grows unboundedly.';

-- Verify: call returns integer count of deleted rows
-- Verify: unread notification with created_at = now()-400d → deleted
-- Verify: read notification with created_at = now()-100d → deleted
-- Verify: unread notification with created_at = now()-300d → NOT deleted


-- =============================================================================
-- JSONB1: exam_questions.options shape CHECK — require A, B, C, D keys
-- =============================================================================
-- The options column stores MCQ choices as {"A": "...", "B": "...", ...}.
-- A CHECK constraint prevents malformed inserts (missing keys, wrong shape)
-- that would cause the exam UI to break silently.
-- Wrapped in DO block in case existing data or constraint already covers this.
-- =============================================================================

DO $$
BEGIN
    ALTER TABLE exam_questions
        ADD CONSTRAINT chk_options_shape
        CHECK (
            options ? 'A'
            AND options ? 'B'
            AND options ? 'C'
            AND options ? 'D'
        );
EXCEPTION
    WHEN duplicate_object THEN
        -- Constraint already exists — skip
        NULL;
    WHEN check_violation THEN
        -- Existing rows violate the shape — surface the error so it can be fixed
        RAISE;
END;
$$;

-- Verify: INSERT INTO exam_questions with options = '{"A":"x","B":"y","C":"z","D":"w"}' → OK
-- Verify: INSERT INTO exam_questions with options = '{"A":"x","B":"y"}' → CHECK violation
-- Verify: duplicate run → no error (exception caught)
