-- ============================================================================
-- Security & Schema Fixes Migration
-- ============================================================================
-- C-1:  Fix wide-open RLS on candidate_module_item_progress
-- H-4:  Create RPC to strip exam answers for non-admins
-- M-5:  Expand guard_user_self_update trigger (lifecycle_stage, onboarding_complete)
-- M-8:  Add updated_at columns + triggers to tables missing them
-- M-9:  Create proper enums for CHECK constraint columns
-- L-10: Change CASCADE to RESTRICT on candidate_module_item_progress FK
-- ============================================================================


-- ============================================================================
-- C-1: Fix wide-open RLS on candidate_module_item_progress
-- ============================================================================
-- The existing policy "Manage item progress" uses USING(true) WITH CHECK(true)
-- for ALL operations. Replace with scoped policies matching the pattern used
-- for candidate_module_progress in 20260311000000_harden_rls_security.sql.
-- ============================================================================

DROP POLICY IF EXISTS "Manage item progress" ON candidate_module_item_progress;

-- SELECT: can see if you can access the parent candidate
CREATE POLICY item_progress_select ON candidate_module_item_progress
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM candidates c
        WHERE c.id = candidate_module_item_progress.candidate_id
        AND can_access_candidate(c.assigned_manager_id, c.created_by_id)
    ));

-- INSERT: can insert if you can access the candidate
CREATE POLICY item_progress_insert ON candidate_module_item_progress
    FOR INSERT TO authenticated
    WITH CHECK (EXISTS (
        SELECT 1 FROM candidates c
        WHERE c.id = candidate_module_item_progress.candidate_id
        AND can_access_candidate(c.assigned_manager_id, c.created_by_id)
    ));

-- UPDATE: can update if you can access the candidate
CREATE POLICY item_progress_update ON candidate_module_item_progress
    FOR UPDATE TO authenticated
    USING (EXISTS (
        SELECT 1 FROM candidates c
        WHERE c.id = candidate_module_item_progress.candidate_id
        AND can_access_candidate(c.assigned_manager_id, c.created_by_id)
    ));

-- DELETE: admin only
CREATE POLICY item_progress_delete ON candidate_module_item_progress
    FOR DELETE TO authenticated
    USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');


-- ============================================================================
-- H-4: Create RPC to strip exam answers for non-admins
-- ============================================================================
-- Returns all exam_questions columns for a given paper, but sets
-- correct_answer to NULL for non-admin callers to prevent answer leakage.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_exam_questions(p_paper_id uuid)
RETURNS SETOF exam_questions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' THEN
        -- Admin sees everything including correct answers
        RETURN QUERY
            SELECT *
            FROM exam_questions
            WHERE paper_id = p_paper_id
            ORDER BY question_number;
    ELSE
        -- Non-admin: strip correct_answer
        RETURN QUERY
            SELECT
                id,
                paper_id,
                question_number,
                question_text,
                has_latex,
                options,
                NULL::text AS correct_answer,
                explanation,
                explanation_has_latex,
                created_at
            FROM exam_questions
            WHERE paper_id = p_paper_id
            ORDER BY question_number;
    END IF;
END;
$$;


-- ============================================================================
-- M-5: Expand guard_user_self_update trigger
-- ============================================================================
-- The existing trigger pins role, is_active, reports_to for non-admin
-- self-updates. Add lifecycle_stage and onboarding_complete to prevent
-- self-advancement and skipping onboarding.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.guard_user_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Only enforce when a non-admin user updates their own record
    IF OLD.id = auth.uid()
       AND COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') != 'admin'
    THEN
        NEW.role               := OLD.role;
        NEW.is_active          := OLD.is_active;
        NEW.reports_to         := OLD.reports_to;
        NEW.lifecycle_stage    := OLD.lifecycle_stage;
        NEW.onboarding_complete := OLD.onboarding_complete;
    END IF;
    RETURN NEW;
END;
$$;


-- ============================================================================
-- M-8: Add updated_at columns and triggers to tables missing them
-- ============================================================================
-- candidate_activities, candidate_documents, roadshow_attendance,
-- roadshow_activities all lack updated_at. Add column + trigger for each.
-- ============================================================================

-- candidate_activities
ALTER TABLE candidate_activities
    ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();

CREATE TRIGGER candidate_activities_updated_at
    BEFORE UPDATE ON candidate_activities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- candidate_documents
ALTER TABLE candidate_documents
    ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();

CREATE TRIGGER candidate_documents_updated_at
    BEFORE UPDATE ON candidate_documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- roadshow_attendance
ALTER TABLE roadshow_attendance
    ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();

CREATE TRIGGER roadshow_attendance_updated_at
    BEFORE UPDATE ON roadshow_attendance
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- roadshow_activities
ALTER TABLE roadshow_activities
    ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();

CREATE TRIGGER roadshow_activities_updated_at
    BEFORE UPDATE ON roadshow_activities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================================
-- M-9: Create proper enums for CHECK constraint columns
-- ============================================================================
-- Replace text CHECK constraints with proper PostgreSQL enum types for
-- type safety and performance.
-- ============================================================================

-- 1. roadshow_activity_type — includes check_in and departure added in later migration
CREATE TYPE roadshow_activity_type AS ENUM (
    'sitdown', 'pitch', 'case_closed', 'check_in', 'departure'
);

ALTER TABLE roadshow_activities
    DROP CONSTRAINT roadshow_activities_type_check;

ALTER TABLE roadshow_activities
    ALTER COLUMN type TYPE roadshow_activity_type
    USING type::roadshow_activity_type;

-- 2. module_item_type
CREATE TYPE module_item_type AS ENUM (
    'material', 'pre_quiz', 'quiz', 'exam', 'attendance'
);

ALTER TABLE roadmap_module_items
    DROP CONSTRAINT valid_item_type;

ALTER TABLE roadmap_module_items
    ALTER COLUMN item_type TYPE module_item_type
    USING item_type::module_item_type;

-- 3. item_progress_status
CREATE TYPE item_progress_status AS ENUM (
    'not_started', 'in_progress', 'completed'
);

ALTER TABLE candidate_module_item_progress
    DROP CONSTRAINT valid_item_progress_status;

ALTER TABLE candidate_module_item_progress
    ALTER COLUMN status DROP DEFAULT;

ALTER TABLE candidate_module_item_progress
    ALTER COLUMN status TYPE item_progress_status
    USING status::item_progress_status;

ALTER TABLE candidate_module_item_progress
    ALTER COLUMN status SET DEFAULT 'not_started'::item_progress_status;


-- ============================================================================
-- L-10: Change CASCADE to RESTRICT on candidate_module_item_progress FK
-- ============================================================================
-- The FK from candidate_module_item_progress.module_item_id to
-- roadmap_module_items uses ON DELETE CASCADE, which could cause accidental
-- data loss. Change to ON DELETE RESTRICT.
-- ============================================================================

ALTER TABLE candidate_module_item_progress
    DROP CONSTRAINT candidate_module_item_progress_module_item_id_fkey;

ALTER TABLE candidate_module_item_progress
    ADD CONSTRAINT candidate_module_item_progress_module_item_id_fkey
    FOREIGN KEY (module_item_id) REFERENCES roadmap_module_items(id)
    ON DELETE RESTRICT;
