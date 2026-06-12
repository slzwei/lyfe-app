-- ============================================================================
-- Security Hardening Migration
-- ============================================================================
-- Fixes:
--   C-1  Roadmap tables wide-open RLS (candidate_module_progress, enrollment)
--   C-2  create_roadshow_bulk SECURITY DEFINER without auth check
--   H-1  Users can self-escalate role via users_update_own
--   H-2  Leads readable by all authenticated users
--   H-3  Candidates readable by all authenticated users
--   H-4  candidate-resumes storage bucket is public
--   M-4  candidate_documents DELETE policy too broad
--   M-5  candidate_documents INSERT policy too broad
--   +    candidate_activities read_all too broad
-- ============================================================================


-- ============================================================================
-- 1. Helper functions (SECURITY DEFINER to bypass inner-table RLS)
-- ============================================================================

-- Check if current user has a relationship to a lead
CREATE OR REPLACE FUNCTION public.can_access_lead(lead_assigned_to uuid, lead_created_by uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT
        -- Own lead (assigned to me or I created it)
        lead_assigned_to = auth.uid()
        OR lead_created_by = auth.uid()
        -- Direct report's lead
        OR EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = lead_assigned_to AND u.reports_to = auth.uid()
        )
        -- PA: lead belongs to one of my managers or their reports
        OR EXISTS (
            SELECT 1 FROM pa_manager_assignments pma
            WHERE pma.pa_id = auth.uid()
            AND (
                lead_assigned_to = pma.manager_id
                OR EXISTS (
                    SELECT 1 FROM users u
                    WHERE u.id = lead_assigned_to AND u.reports_to = pma.manager_id
                )
            )
        )
        -- Admin or director sees all
        OR (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'director');
$$;

-- Check if current user has a relationship to a candidate
CREATE OR REPLACE FUNCTION public.can_access_candidate(cand_manager_id uuid, cand_created_by uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT
        -- I am the assigned manager or creator
        cand_manager_id = auth.uid()
        OR cand_created_by = auth.uid()
        -- The candidate's manager is my direct report
        OR EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = cand_manager_id AND u.reports_to = auth.uid()
        )
        -- PA: the candidate's manager is one of my assigned managers
        OR EXISTS (
            SELECT 1 FROM pa_manager_assignments pma
            WHERE pma.pa_id = auth.uid()
            AND pma.manager_id = cand_manager_id
        )
        -- Admin or director sees all
        OR (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'director');
$$;


-- ============================================================================
-- 2. Guard user self-update (prevent role escalation)  [H-1]
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
        NEW.role        := OLD.role;
        NEW.is_active   := OLD.is_active;
        NEW.reports_to  := OLD.reports_to;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER guard_user_self_update
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.guard_user_self_update();


-- ============================================================================
-- 3. Fix create_roadshow_bulk — add auth.uid() check  [C-2]
-- ============================================================================

CREATE OR REPLACE FUNCTION create_roadshow_bulk(
    p_events jsonb,
    p_config jsonb,
    p_attendees jsonb,
    p_created_by uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_event_ids uuid[] := '{}';
    v_event_id uuid;
    v_event jsonb;
BEGIN
    -- Verify the caller is who they claim to be
    IF auth.uid() IS NULL OR auth.uid() != p_created_by THEN
        RAISE EXCEPTION 'Unauthorized: caller must match p_created_by';
    END IF;

    FOR v_event IN SELECT * FROM jsonb_array_elements(p_events)
    LOOP
        INSERT INTO events (
            title, description, event_type, event_date, start_time, end_time,
            location, created_by, external_attendees
        ) VALUES (
            v_event->>'title',
            NULLIF(v_event->>'description', ''),
            'roadshow',
            (v_event->>'event_date')::date,
            (v_event->>'start_time')::time,
            CASE WHEN v_event->>'end_time' IS NOT NULL AND v_event->>'end_time' != ''
                 THEN (v_event->>'end_time')::time ELSE NULL END,
            NULLIF(v_event->>'location', ''),
            p_created_by,
            '[]'::jsonb
        )
        RETURNING id INTO v_event_id;

        v_event_ids := array_append(v_event_ids, v_event_id);

        INSERT INTO roadshow_configs (
            event_id, weekly_cost, slots_per_day, expected_start_time,
            late_grace_minutes, suggested_sitdowns, suggested_pitches, suggested_closed
        ) VALUES (
            v_event_id,
            (p_config->>'weekly_cost')::numeric,
            (p_config->>'slots_per_day')::int,
            (p_config->>'expected_start_time')::time,
            (p_config->>'late_grace_minutes')::int,
            (p_config->>'suggested_sitdowns')::int,
            (p_config->>'suggested_pitches')::int,
            (p_config->>'suggested_closed')::int
        );
    END LOOP;

    IF jsonb_array_length(p_attendees) > 0 THEN
        INSERT INTO event_attendees (event_id, user_id, attendee_role)
        SELECT v_eid, (att->>'user_id')::uuid, att->>'attendee_role'
        FROM unnest(v_event_ids) v_eid
        CROSS JOIN jsonb_array_elements(p_attendees) att;
    END IF;

    RETURN jsonb_build_object(
        'event_ids', to_jsonb(v_event_ids),
        'count', array_length(v_event_ids, 1)
    );
END;
$$;


-- ============================================================================
-- 4. Harden leads RLS  [H-2]
-- ============================================================================

-- Drop old permissive policies
DROP POLICY IF EXISTS "Authenticated users can read leads" ON leads;
DROP POLICY IF EXISTS "Authenticated users can insert leads" ON leads;
DROP POLICY IF EXISTS "Authenticated users can update leads" ON leads;
DROP POLICY IF EXISTS leads_insert_own ON leads;
DROP POLICY IF EXISTS leads_update_own ON leads;

-- SELECT: only if you have a relationship to the lead
CREATE POLICY leads_select ON leads
    FOR SELECT TO authenticated
    USING (can_access_lead(assigned_to, created_by));

-- INSERT: creator must be the current user
CREATE POLICY leads_insert ON leads
    FOR INSERT TO authenticated
    WITH CHECK (created_by = auth.uid());

-- UPDATE: same relationship check as SELECT
CREATE POLICY leads_update ON leads
    FOR UPDATE TO authenticated
    USING (can_access_lead(assigned_to, created_by));


-- ============================================================================
-- 5. Harden lead_activities RLS
-- ============================================================================

DROP POLICY IF EXISTS "Authenticated users can read activities" ON lead_activities;
DROP POLICY IF EXISTS "Authenticated users can insert activities" ON lead_activities;
DROP POLICY IF EXISTS lead_activities_insert_own ON lead_activities;

-- SELECT: can see activities if you can access the parent lead
CREATE POLICY lead_activities_select ON lead_activities
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM leads l WHERE l.id = lead_activities.lead_id
        AND can_access_lead(l.assigned_to, l.created_by)
    ));

-- INSERT: must be the actor AND have access to the lead
CREATE POLICY lead_activities_insert ON lead_activities
    FOR INSERT TO authenticated
    WITH CHECK (
        user_id = auth.uid()
        AND EXISTS (SELECT 1 FROM leads l WHERE l.id = lead_activities.lead_id
                    AND can_access_lead(l.assigned_to, l.created_by))
    );


-- ============================================================================
-- 6. Harden candidates RLS  [H-3]
-- ============================================================================

DROP POLICY IF EXISTS "Authenticated users can read candidates" ON candidates;
DROP POLICY IF EXISTS "Authenticated users can insert candidates" ON candidates;
DROP POLICY IF EXISTS "Authenticated users can update candidates" ON candidates;
DROP POLICY IF EXISTS candidates_insert_own ON candidates;
DROP POLICY IF EXISTS candidates_update ON candidates;

-- SELECT: only if you have a relationship
CREATE POLICY candidates_select ON candidates
    FOR SELECT TO authenticated
    USING (can_access_candidate(assigned_manager_id, created_by_id));

-- INSERT: creator must be the current user
CREATE POLICY candidates_insert ON candidates
    FOR INSERT TO authenticated
    WITH CHECK (created_by_id = auth.uid());

-- UPDATE: same relationship check
CREATE POLICY candidates_update ON candidates
    FOR UPDATE TO authenticated
    USING (can_access_candidate(assigned_manager_id, created_by_id));


-- ============================================================================
-- 7. Harden interviews RLS
-- ============================================================================

DROP POLICY IF EXISTS "Authenticated users can read interviews" ON interviews;
DROP POLICY IF EXISTS "Authenticated users can insert interviews" ON interviews;
DROP POLICY IF EXISTS "Authenticated users can update interviews" ON interviews;
DROP POLICY IF EXISTS interviews_insert_own ON interviews;
-- Repair for fresh rebuilds (audit C3, 2026-06-12): 20260306140441 creates
-- interviews_update, and on prod it was evidently hand-dropped via Dashboard
-- before this file ran — without this guard a `db reset` replay dies here.
-- Final shape is settled by 20260404000000 either way.
DROP POLICY IF EXISTS interviews_update ON interviews;

-- SELECT: can see if you can access the parent candidate
CREATE POLICY interviews_select ON interviews
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM candidates c WHERE c.id = interviews.candidate_id
        AND can_access_candidate(c.assigned_manager_id, c.created_by_id)
    ));

-- INSERT: must be the scheduler or manager, and can access the candidate
CREATE POLICY interviews_insert ON interviews
    FOR INSERT TO authenticated
    WITH CHECK (
        (scheduled_by_id = auth.uid() OR manager_id = auth.uid())
        AND EXISTS (SELECT 1 FROM candidates c WHERE c.id = interviews.candidate_id
                    AND can_access_candidate(c.assigned_manager_id, c.created_by_id))
    );

-- UPDATE: same as insert check
CREATE POLICY interviews_update ON interviews
    FOR UPDATE TO authenticated
    USING (
        scheduled_by_id = auth.uid()
        OR manager_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM candidates c
            WHERE c.id = interviews.candidate_id
            AND can_access_candidate(c.assigned_manager_id, c.created_by_id)
        )
    );


-- ============================================================================
-- 8. Harden candidate_activities RLS
-- ============================================================================

DROP POLICY IF EXISTS "read_all" ON candidate_activities;
-- insert_own is fine (auth.uid() = user_id)

-- SELECT: can see if you can access the parent candidate
CREATE POLICY candidate_activities_select ON candidate_activities
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM candidates c WHERE c.id = candidate_activities.candidate_id
        AND can_access_candidate(c.assigned_manager_id, c.created_by_id)
    ));


-- ============================================================================
-- 9. Harden candidate_documents RLS  [M-4, M-5]
-- ============================================================================

DROP POLICY IF EXISTS "read_all" ON candidate_documents;
DROP POLICY IF EXISTS "insert_auth" ON candidate_documents;
DROP POLICY IF EXISTS "delete_auth" ON candidate_documents;

-- SELECT: can see if you can access the parent candidate
CREATE POLICY candidate_documents_select ON candidate_documents
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM candidates c WHERE c.id = candidate_documents.candidate_id
        AND can_access_candidate(c.assigned_manager_id, c.created_by_id)
    ));

-- INSERT: can insert if you can access the candidate
CREATE POLICY candidate_documents_insert ON candidate_documents
    FOR INSERT TO authenticated
    WITH CHECK (EXISTS (
        SELECT 1 FROM candidates c
        WHERE c.id = candidate_documents.candidate_id
        AND can_access_candidate(c.assigned_manager_id, c.created_by_id)
    ));

-- DELETE: can delete if you can access the candidate
CREATE POLICY candidate_documents_delete ON candidate_documents
    FOR DELETE TO authenticated
    USING (EXISTS (
        SELECT 1 FROM candidates c
        WHERE c.id = candidate_documents.candidate_id
        AND can_access_candidate(c.assigned_manager_id, c.created_by_id)
    ));


-- ============================================================================
-- 10. Harden roadmap tables RLS  [C-1]
-- ============================================================================

-- Drop wide-open policies
DROP POLICY IF EXISTS "Manage candidate progress" ON candidate_module_progress;
DROP POLICY IF EXISTS "Manage enrollment" ON candidate_programme_enrollment;

-- candidate_module_progress: SELECT if you can access the candidate
CREATE POLICY progress_select ON candidate_module_progress
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM candidates c
        WHERE c.id = candidate_module_progress.candidate_id
        AND can_access_candidate(c.assigned_manager_id, c.created_by_id)
    ));

-- candidate_module_progress: INSERT/UPDATE only by managers/PAs/admins/directors
CREATE POLICY progress_upsert ON candidate_module_progress
    FOR INSERT TO authenticated
    WITH CHECK (EXISTS (
        SELECT 1 FROM candidates c
        WHERE c.id = candidate_module_progress.candidate_id
        AND can_access_candidate(c.assigned_manager_id, c.created_by_id)
    ));

CREATE POLICY progress_update ON candidate_module_progress
    FOR UPDATE TO authenticated
    USING (EXISTS (
        SELECT 1 FROM candidates c
        WHERE c.id = candidate_module_progress.candidate_id
        AND can_access_candidate(c.assigned_manager_id, c.created_by_id)
    ));

-- candidate_module_progress: DELETE only by admin
CREATE POLICY progress_delete ON candidate_module_progress
    FOR DELETE TO authenticated
    USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- candidate_programme_enrollment: SELECT if you can access the candidate
CREATE POLICY enrollment_select ON candidate_programme_enrollment
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM candidates c
        WHERE c.id = candidate_programme_enrollment.candidate_id
        AND can_access_candidate(c.assigned_manager_id, c.created_by_id)
    ));

-- candidate_programme_enrollment: INSERT/UPDATE by managers/PAs/admins/directors
CREATE POLICY enrollment_upsert ON candidate_programme_enrollment
    FOR INSERT TO authenticated
    WITH CHECK (EXISTS (
        SELECT 1 FROM candidates c
        WHERE c.id = candidate_programme_enrollment.candidate_id
        AND can_access_candidate(c.assigned_manager_id, c.created_by_id)
    ));

CREATE POLICY enrollment_update ON candidate_programme_enrollment
    FOR UPDATE TO authenticated
    USING (EXISTS (
        SELECT 1 FROM candidates c
        WHERE c.id = candidate_programme_enrollment.candidate_id
        AND can_access_candidate(c.assigned_manager_id, c.created_by_id)
    ));

-- candidate_programme_enrollment: DELETE only by admin
CREATE POLICY enrollment_delete ON candidate_programme_enrollment
    FOR DELETE TO authenticated
    USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');


-- ============================================================================
-- 11. Make candidate-resumes storage bucket private  [H-4]
-- ============================================================================

UPDATE storage.buckets
SET public = false
WHERE id = 'candidate-resumes';

-- Drop the old public SELECT policy
DROP POLICY IF EXISTS "Anyone can view resumes" ON storage.objects;

-- Replace with authenticated-only SELECT, scoped to the bucket
CREATE POLICY "Authenticated users can view resumes"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'candidate-resumes');
