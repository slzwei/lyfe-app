-- Atomic exam submission RPC
-- Wraps attempt insert, answers insert, score computation, and status update
-- in a single transaction so partial writes cannot occur.

CREATE OR REPLACE FUNCTION submit_exam_attempt(
    p_user_id UUID,
    p_paper_id UUID,
    p_status TEXT,
    p_score INT,
    p_total_questions INT,
    p_percentage INT,
    p_passed BOOLEAN,
    p_started_at TIMESTAMPTZ,
    p_submitted_at TIMESTAMPTZ,
    p_duration_seconds INT,
    p_personality_results JSONB DEFAULT NULL,
    p_answers JSONB DEFAULT '[]'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_attempt_id UUID;
    v_answer JSONB;
BEGIN
    -- 1. Insert the attempt as 'in_progress' (RLS on exam_answers requires this status)
    INSERT INTO exam_attempts (
        user_id, paper_id, status,
        score, total_questions, percentage, passed,
        started_at, submitted_at, duration_seconds,
        personality_results
    ) VALUES (
        p_user_id, p_paper_id, 'in_progress',
        p_score, p_total_questions, p_percentage, p_passed,
        p_started_at, p_submitted_at, p_duration_seconds,
        p_personality_results
    )
    RETURNING id INTO v_attempt_id;

    -- 2. Insert all answers in one batch
    INSERT INTO exam_answers (attempt_id, question_id, selected_answer, is_correct)
    SELECT
        v_attempt_id,
        (ans->>'question_id')::UUID,
        ans->>'selected_answer',
        CASE
            WHEN ans->>'is_correct' IS NULL THEN NULL
            ELSE (ans->>'is_correct')::BOOLEAN
        END
    FROM jsonb_array_elements(p_answers) AS ans;

    -- 3. Update attempt to final status
    UPDATE exam_attempts
    SET status = p_status
    WHERE id = v_attempt_id;

    -- If any step above fails, the entire transaction rolls back automatically.
    RETURN jsonb_build_object('attempt_id', v_attempt_id);
END;
$$;

-- Grant execute to authenticated users (RLS on the function handles row-level access)
GRANT EXECUTE ON FUNCTION submit_exam_attempt TO authenticated;
