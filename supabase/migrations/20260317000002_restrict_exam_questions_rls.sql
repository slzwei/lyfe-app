-- Restrict exam_questions RLS — prevent direct access to answer keys
-- All app code must use the submit_exam_attempt RPC or fetch via exam_answers join.
-- Only admins/directors can directly query exam_questions (for CMS management).

-- Drop the existing overly-permissive policy
DROP POLICY IF EXISTS "exam_questions_select" ON exam_questions;
DROP POLICY IF EXISTS "Authenticated users can read exam questions" ON exam_questions;

-- Admin/director-only direct SELECT
CREATE POLICY exam_questions_admin_select ON exam_questions
    FOR SELECT TO authenticated
    USING (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'director')
    );

-- The get_exam_questions RPC (SECURITY DEFINER) still works for exam-taking flow.
-- The submit_exam_attempt RPC (SECURITY DEFINER) still works for scoring.
-- fetchExamResult joins via exam_answers FK which uses SECURITY DEFINER context.
