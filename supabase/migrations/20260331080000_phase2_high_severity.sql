-- Phase 2: High Severity Security & Data Integrity
-- 2.4: Drop deprecated staff_sessions table
-- 2.6: Split exam_questions_admin to read-only for directors
-- 2.8: Fix storage RLS recursion on candidate-documents bucket
-- 2.10: Redact PII from audit log trigger
-- 2.16: lead_activities.user_id FK → ON DELETE SET NULL
-- 2.18: ON DELETE SET NULL for nullable user FK columns
-- 2.19: DELETE deny policies on non-deletable tables


-- =====================================================================
-- 2.4: Drop deprecated staff_sessions
-- RLS enabled, zero policies, 2 rows. Legacy auth table.
-- =====================================================================

DROP TABLE IF EXISTS public.staff_sessions CASCADE;


-- =====================================================================
-- 2.6: Split exam_questions_admin — directors get read-only
-- Current FOR ALL policy gives directors INSERT/DELETE on questions.
-- =====================================================================

DROP POLICY IF EXISTS exam_questions_admin ON public.exam_questions;
DROP POLICY IF EXISTS exam_questions_select ON public.exam_questions;
DROP POLICY IF EXISTS exam_questions_write ON public.exam_questions;

-- Directors + admin can read questions
CREATE POLICY exam_questions_select ON public.exam_questions
  FOR SELECT TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'director')
  );

-- Only admin can modify questions
CREATE POLICY exam_questions_write ON public.exam_questions
  FOR ALL TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );


-- =====================================================================
-- 2.8: Fix storage policy RLS recursion on candidate-documents
-- Policies join users table → triggers users RLS → recursion.
-- Replace with JWT-based role check.
-- =====================================================================

DROP POLICY IF EXISTS "Staff can upload candidate documents" ON storage.objects;
DROP POLICY IF EXISTS "Staff can read candidate documents" ON storage.objects;
DROP POLICY IF EXISTS "Staff can delete candidate documents" ON storage.objects;

CREATE POLICY "Staff can upload candidate documents"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'candidate-documents'
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'director', 'manager', 'agent', 'pa')
  );

CREATE POLICY "Staff can read candidate documents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'candidate-documents'
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'director', 'manager', 'agent', 'pa')
  );

CREATE POLICY "Staff can delete candidate documents"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'candidate-documents'
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'director', 'manager', 'agent', 'pa')
  );


-- =====================================================================
-- 2.10: Redact PII from audit log
-- row_to_json(OLD/NEW) serializes phone, email, push_token, etc.
-- Strip sensitive keys per table before storage.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.redact_audit_data(p_table text, p_data jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE p_table
    WHEN 'users'              THEN p_data - ARRAY['phone','email','push_token']
    WHEN 'candidates'         THEN p_data - ARRAY['phone','email']
    WHEN 'leads'              THEN p_data - ARRAY['phone','email']
    WHEN 'candidate_profiles' THEN p_data - ARRAY['contact_number','email','date_of_birth','nric_fin']
    WHEN 'invitations'        THEN p_data - ARRAY['email']
    WHEN 'member_invitations' THEN p_data - ARRAY['phone','email']
    ELSE p_data
  END;
$$;

-- Rewrite audit trigger to use redaction
CREATE OR REPLACE FUNCTION public.zzz_audit_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id   uuid;
  v_actor_role text;
  v_source     text;
  v_old        jsonb;
  v_new        jsonb;
BEGIN
  BEGIN
    v_actor_id := COALESCE(
      auth.uid(),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
    );

    v_actor_role := (
      nullif(current_setting('request.jwt.claims', true), '')::jsonb
      -> 'app_metadata' ->> 'role'
    );

    IF v_actor_id IS NOT NULL THEN
      v_source := 'app';
    ELSIF current_user IN ('supabase_admin', 'postgres') THEN
      v_source := 'dashboard';
    ELSE
      v_source := 'service_role';
    END IF;

    IF TG_OP = 'DELETE' THEN
      v_old := public.redact_audit_data(TG_TABLE_NAME, row_to_json(OLD)::jsonb);
      v_new := NULL;
    ELSIF TG_OP = 'INSERT' THEN
      v_old := NULL;
      v_new := public.redact_audit_data(TG_TABLE_NAME, row_to_json(NEW)::jsonb);
    ELSE
      v_old := public.redact_audit_data(TG_TABLE_NAME, row_to_json(OLD)::jsonb);
      v_new := public.redact_audit_data(TG_TABLE_NAME, row_to_json(NEW)::jsonb);
    END IF;

    INSERT INTO public.audit_log (table_name, operation, actor_id, actor_role, source, old_data, new_data, tx_id)
    VALUES (TG_TABLE_NAME, TG_OP, v_actor_id, v_actor_role, v_source, v_old, v_new, txid_current());

  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[audit_log] write failed on %.%: %', TG_TABLE_NAME, TG_OP, SQLERRM;
  END;

  RETURN COALESCE(NEW, OLD);
END;
$$;


-- =====================================================================
-- 2.16 + 2.18: Fix FK constraints — add ON DELETE SET NULL
-- These nullable FK columns reference users(id) with default NO ACTION,
-- blocking user deletion if the delete-account function misses a row.
-- =====================================================================

-- lead_activities.user_id: make nullable + ON DELETE SET NULL
ALTER TABLE public.lead_activities ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.lead_activities DROP CONSTRAINT IF EXISTS lead_activities_user_id_fkey;
ALTER TABLE public.lead_activities
  ADD CONSTRAINT lead_activities_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- users.reports_to (self-reference)
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_reports_to_fkey;
ALTER TABLE public.users
  ADD CONSTRAINT users_reports_to_fkey
  FOREIGN KEY (reports_to) REFERENCES public.users(id) ON DELETE SET NULL;

-- roadshow_attendance.checked_in_by
ALTER TABLE public.roadshow_attendance DROP CONSTRAINT IF EXISTS roadshow_attendance_checked_in_by_fkey;
ALTER TABLE public.roadshow_attendance
  ADD CONSTRAINT roadshow_attendance_checked_in_by_fkey
  FOREIGN KEY (checked_in_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- candidate_module_progress.completed_by
ALTER TABLE public.candidate_module_progress DROP CONSTRAINT IF EXISTS candidate_module_progress_completed_by_fkey;
ALTER TABLE public.candidate_module_progress
  ADD CONSTRAINT candidate_module_progress_completed_by_fkey
  FOREIGN KEY (completed_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- candidate_module_item_progress.completed_by
ALTER TABLE public.candidate_module_item_progress DROP CONSTRAINT IF EXISTS candidate_module_item_progress_completed_by_fkey;
ALTER TABLE public.candidate_module_item_progress
  ADD CONSTRAINT candidate_module_item_progress_completed_by_fkey
  FOREIGN KEY (completed_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- candidate_programme_enrollment.unlocked_by
ALTER TABLE public.candidate_programme_enrollment DROP CONSTRAINT IF EXISTS candidate_programme_enrollment_unlocked_by_fkey;
ALTER TABLE public.candidate_programme_enrollment
  ADD CONSTRAINT candidate_programme_enrollment_unlocked_by_fkey
  FOREIGN KEY (unlocked_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- roadmap_programmes.archived_by
ALTER TABLE public.roadmap_programmes DROP CONSTRAINT IF EXISTS roadmap_programmes_archived_by_fkey;
ALTER TABLE public.roadmap_programmes
  ADD CONSTRAINT roadmap_programmes_archived_by_fkey
  FOREIGN KEY (archived_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- roadmap_modules.archived_by
ALTER TABLE public.roadmap_modules DROP CONSTRAINT IF EXISTS roadmap_modules_archived_by_fkey;
ALTER TABLE public.roadmap_modules
  ADD CONSTRAINT roadmap_modules_archived_by_fkey
  FOREIGN KEY (archived_by) REFERENCES public.users(id) ON DELETE SET NULL;


-- =====================================================================
-- 2.19: DELETE deny policies on non-deletable tables
-- Defence in depth: client-side DELETE should never succeed on these.
-- Service-role (delete-account, RPCs) bypasses RLS anyway.
-- =====================================================================

CREATE POLICY deny_delete_users ON public.users
  FOR DELETE TO authenticated USING (false);

CREATE POLICY deny_delete_candidates ON public.candidates
  FOR DELETE TO authenticated USING (false);

CREATE POLICY deny_delete_leads ON public.leads
  FOR DELETE TO authenticated USING (false);

CREATE POLICY deny_delete_exam_attempts ON public.exam_attempts
  FOR DELETE TO authenticated USING (false);

CREATE POLICY deny_delete_exam_answers ON public.exam_answers
  FOR DELETE TO authenticated USING (false);

CREATE POLICY deny_delete_jobs ON public.jobs
  FOR DELETE TO authenticated USING (false);

CREATE POLICY deny_delete_event_attendees ON public.event_attendees
  FOR DELETE TO authenticated USING (false);

CREATE POLICY deny_delete_candidate_activities ON public.candidate_activities
  FOR DELETE TO authenticated USING (false);

CREATE POLICY deny_delete_lead_activities ON public.lead_activities
  FOR DELETE TO authenticated USING (false);

CREATE POLICY deny_delete_candidate_module_progress ON public.candidate_module_progress
  FOR DELETE TO authenticated USING (false);

CREATE POLICY deny_delete_candidate_programme_enrollment ON public.candidate_programme_enrollment
  FOR DELETE TO authenticated USING (false);
