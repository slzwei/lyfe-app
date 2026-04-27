-- Idempotency key on exam_attempts so a network-retry from a flaky mobile
-- submit can't create duplicate attempt rows for the same user+paper.
-- The original `submit_exam_attempt` RPC blindly inserted; if a phone's
-- request times out and the client retries, two attempts land in the DB
-- with full scoring runs against duplicate answer sets — and reporting
-- double-counts.
--
-- Design notes:
--   * We DO NOT constrain (user_id, paper_id) globally — retakes are a
--     real and expected flow (M5/RES5 study cycles, DISC retake on
--     manager request). The constraint is only on the idempotency key.
--   * Existing rows have NULL keys; the partial unique index ignores
--     them. New submissions from the updated client always pass a UUID,
--     and the RPC enforces uniqueness via an existence check + return.
--   * Replays return the existing attempt row instead of erroring, so
--     the client UX of "submit → see result" works on retry.
--
-- The body of the RPC mirrors 20260404000000_audit_fixes.sql exactly;
-- the only delta is (a) the new trailing parameter and (b) the
-- idempotency early-return at the top. Column names, scoring logic,
-- and the two-phase insert/update sequence are preserved.

ALTER TABLE public.exam_attempts
    ADD COLUMN IF NOT EXISTS client_idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_exam_attempts_idempotency
    ON public.exam_attempts (user_id, paper_id, client_idempotency_key)
    WHERE client_idempotency_key IS NOT NULL;

COMMENT ON COLUMN public.exam_attempts.client_idempotency_key IS
    'Client-supplied UUID v4 generated once per submit attempt. Used to dedup network retries — a duplicate submission with the same key returns the existing attempt row instead of inserting a new one.';

CREATE OR REPLACE FUNCTION public.submit_exam_attempt(
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
    p_answers           jsonb DEFAULT '[]'::jsonb,
    p_client_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_attempt_id        uuid;
    v_existing_id       uuid;
    v_server_score      int;
    v_server_percentage numeric(5,2);
    v_server_passed     boolean;
    v_pass_threshold    int;
BEGIN
    -- Verify the caller is who they claim to be
    IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
        RAISE EXCEPTION 'Unauthorized: caller must match p_user_id';
    END IF;

    -- 0. Idempotency check — replay safety against network retries.
    --    If the client retries with the same key, return the existing
    --    attempt row. Pre-update clients (no key) skip this check and
    --    behave exactly as before.
    IF p_client_idempotency_key IS NOT NULL THEN
        SELECT id INTO v_existing_id
        FROM exam_attempts
        WHERE user_id = p_user_id
          AND paper_id = p_paper_id
          AND client_idempotency_key = p_client_idempotency_key;

        IF v_existing_id IS NOT NULL THEN
            RETURN (
                SELECT jsonb_build_object(
                    'attempt_id', a.id,
                    'score', a.score,
                    'percentage', a.percentage,
                    'passed', a.passed,
                    'idempotent_replay', true
                )
                FROM exam_attempts a
                WHERE a.id = v_existing_id
            );
        END IF;
    END IF;

    -- 1. Insert the attempt as 'in_progress' with placeholder scores.
    --    RLS on exam_answers requires status = 'in_progress' during answer insert.
    INSERT INTO exam_attempts (
        user_id, paper_id, status,
        score, total_questions, percentage, passed,
        started_at, submitted_at, duration_seconds,
        personality_results, client_idempotency_key
    ) VALUES (
        p_user_id, p_paper_id, 'in_progress',
        NULL, p_total_questions, NULL, NULL,
        p_started_at, p_submitted_at, p_duration_seconds,
        p_personality_results, p_client_idempotency_key
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
        'passed',      v_server_passed,
        'idempotent_replay', false
    );
END;
$$;
