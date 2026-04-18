-- Phase A2: candidate lifecycle tables, helpers, triggers, RLS, backfill.
--
-- Depends on: 20260417100000_expand_candidate_lifecycle_enum.sql (must be
-- deployed first — this migration uses eapp_done/on_hold/rejected values).
--
-- Purely additive. Does not drop, rename, or alter existing columns/policies.

-- -----------------------------------------------------------------------------
-- 1. New columns on candidates
-- -----------------------------------------------------------------------------

ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS stage_before_hold candidate_status,
  ADD COLUMN IF NOT EXISTS converted_to_agent_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_reason text,
  ADD COLUMN IF NOT EXISTS rejected_by_user_id uuid REFERENCES users(id);

-- stage_before_hold must never itself be 'on_hold' (would create a resume loop).
ALTER TABLE candidates
  ADD CONSTRAINT candidates_stage_before_hold_not_on_hold
  CHECK (stage_before_hold IS NULL OR stage_before_hold <> 'on_hold');

-- -----------------------------------------------------------------------------
-- 2. is_bdm on interviews (orthogonal flag — does not touch existing type enum)
-- -----------------------------------------------------------------------------

ALTER TABLE interviews
  ADD COLUMN IF NOT EXISTS is_bdm boolean NOT NULL DEFAULT false;

-- -----------------------------------------------------------------------------
-- 3. New tables
-- -----------------------------------------------------------------------------

-- 3a/b. Paper attempts — the single source of truth for paper progress. Each
--     row represents one sitting (or planned sitting). The paper is "passed"
--     for a requirement iff any attempt for an accepted code has
--     result='passed' (see fn_all_papers_passed below).
--
--     `result` is nullable: NULL = scheduled / upcoming exam, 'passed' and
--     'failed' come in after the sitting. `exam_at` is timestamptz so the UI
--     captures booking time-of-day.
CREATE TABLE IF NOT EXISTS candidate_paper_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  paper_code text NOT NULL
    CHECK (paper_code IN ('M9','M9A','M5','RES5','HI','CM_LIP')),
  exam_at timestamptz,
  cost numeric(10,2),
  result text CHECK (result IN ('passed','failed')),
  logged_by_user_id uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cpa_candidate ON candidate_paper_attempts(candidate_id);
CREATE INDEX IF NOT EXISTS idx_cpa_candidate_code ON candidate_paper_attempts(candidate_id, paper_code);

-- 3c. Post-exam milestones — BES Induction, SOAR, RNF (with reference_number),
--     Sales Authority. Preferred order shown in UI but not DB-enforced.
CREATE TABLE IF NOT EXISTS candidate_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  milestone_code text NOT NULL
    CHECK (milestone_code IN ('bes_induction','soar','rnf','sales_authority')),
  status text NOT NULL DEFAULT 'not_started',
  -- timestamptz so the UI can capture time (e.g. 10:00am BES induction), not
  -- just date. Rendering code should always format in the user's local tz.
  scheduled_date timestamptz,
  -- Optional end of scheduled range. NULL for single-day/moment milestones.
  -- UI shows a range picker when the user toggles multi-day.
  scheduled_end_date timestamptz,
  completed_date timestamptz,
  reference_number text,
  verified_by_user_id uuid REFERENCES users(id),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (candidate_id, milestone_code),
  CONSTRAINT cm_status_valid_per_code CHECK (
    (milestone_code IN ('bes_induction','soar')
      AND status IN ('not_started','scheduled','completed'))
    OR (milestone_code = 'rnf'
      AND status IN ('not_started','lodged_to_mas','issued'))
    OR (milestone_code = 'sales_authority'
      AND status IN ('not_started','issued'))
  )
);
CREATE INDEX IF NOT EXISTS idx_cm_candidate ON candidate_milestones(candidate_id);

-- 3d. Prep course bookings — three external prep courses that the manager books
--     on the candidate's behalf. Decoupled from paper pass/fail entirely.
CREATE TABLE IF NOT EXISTS candidate_prep_course_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  course_code text NOT NULL
    CHECK (course_code IN ('M9_M9A','RES5','HI')),
  booked_by_user_id uuid REFERENCES users(id),
  -- timestamptz so we capture class start time, not just the day.
  booked_date timestamptz,
  -- Optional end of booking range (multi-day prep courses).
  booked_end_date timestamptz,
  attended boolean NOT NULL DEFAULT false,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (candidate_id, course_code)
);
CREATE INDEX IF NOT EXISTS idx_cpcb_candidate ON candidate_prep_course_bookings(candidate_id);

-- -----------------------------------------------------------------------------
-- 4. Helper: "all 4 exam requirements met" — encodes M5~RES5 and CM_LIP~M9+M9A
--    equivalencies. Called by client-side "promote to licensed" guards and by
--    the LicensedReadinessBanner.
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_all_papers_passed(c uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    (
      EXISTS (SELECT 1 FROM candidate_paper_attempts
              WHERE candidate_id = c AND paper_code = 'CM_LIP' AND result = 'passed')
      OR (
        EXISTS (SELECT 1 FROM candidate_paper_attempts
                WHERE candidate_id = c AND paper_code = 'M9' AND result = 'passed')
        AND
        EXISTS (SELECT 1 FROM candidate_paper_attempts
                WHERE candidate_id = c AND paper_code = 'M9A' AND result = 'passed')
      )
    )
    AND (
      EXISTS (SELECT 1 FROM candidate_paper_attempts
              WHERE candidate_id = c AND paper_code = 'M5' AND result = 'passed')
      OR
      EXISTS (SELECT 1 FROM candidate_paper_attempts
              WHERE candidate_id = c AND paper_code = 'RES5' AND result = 'passed')
    )
    AND
    EXISTS (SELECT 1 FROM candidate_paper_attempts
            WHERE candidate_id = c AND paper_code = 'HI' AND result = 'passed');
$$;

-- -----------------------------------------------------------------------------
-- 5. Triggers on candidates
--
--    Trigger firing order is alphabetical by name within the same event.
--    All four are BEFORE UPDATE OF status so they run before
--    sync_candidate_status_to_lifecycle (AFTER UPDATE).
-- -----------------------------------------------------------------------------

-- 5a. eapp_done auto-advances to exam_prep — eapp_done is a transient
--     click-target, not a resting stage. The row never stores eapp_done.
CREATE OR REPLACE FUNCTION fn_auto_advance_from_eapp_done()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'eapp_done' AND OLD.status IS DISTINCT FROM 'eapp_done' THEN
    NEW.status := 'exam_prep';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_advance_eapp_done
  BEFORE UPDATE OF status ON candidates
  FOR EACH ROW
  WHEN (NEW.status = 'eapp_done')
  EXECUTE FUNCTION fn_auto_advance_from_eapp_done();

-- 5b. On entering on_hold, capture the prior stage so resume can restore it.
CREATE OR REPLACE FUNCTION fn_capture_stage_before_hold()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'on_hold' AND OLD.status <> 'on_hold' THEN
    NEW.stage_before_hold := OLD.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_capture_stage_before_hold
  BEFORE UPDATE OF status ON candidates
  FOR EACH ROW
  WHEN (NEW.status = 'on_hold' AND OLD.status <> 'on_hold')
  EXECUTE FUNCTION fn_capture_stage_before_hold();

-- 5c. On leaving on_hold (to any other stage), clear stage_before_hold.
CREATE OR REPLACE FUNCTION fn_clear_stage_before_hold()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'on_hold' AND NEW.status <> 'on_hold' THEN
    NEW.stage_before_hold := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_clear_stage_before_hold
  BEFORE UPDATE OF status ON candidates
  FOR EACH ROW
  WHEN (OLD.status = 'on_hold' AND NEW.status <> 'on_hold')
  EXECUTE FUNCTION fn_clear_stage_before_hold();

-- 5d. On entering rejected, stamp rejected_at. The client-supplied
--     rejected_reason and rejected_by_user_id pass through untouched.
CREATE OR REPLACE FUNCTION fn_stamp_rejected()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'rejected' AND OLD.status IS DISTINCT FROM 'rejected' THEN
    NEW.rejected_at := COALESCE(NEW.rejected_at, now());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_stamp_rejected
  BEFORE UPDATE OF status ON candidates
  FOR EACH ROW
  WHEN (NEW.status = 'rejected' AND OLD.status <> 'rejected')
  EXECUTE FUNCTION fn_stamp_rejected();

-- -----------------------------------------------------------------------------
-- 6. updated_at + progress_signals triggers on new tables
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_candidate_lifecycle_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- candidate_paper_attempts — updates edit existing rows (result change after
-- exam, cost correction), so maintain updated_at + broadcast progress.
CREATE TRIGGER trg_cpa_updated_at
  BEFORE UPDATE ON candidate_paper_attempts
  FOR EACH ROW EXECUTE FUNCTION fn_candidate_lifecycle_set_updated_at();

CREATE TRIGGER trg_cpa_signal
  AFTER INSERT OR UPDATE OR DELETE ON candidate_paper_attempts
  FOR EACH ROW EXECUTE FUNCTION notify_progress_change();

-- candidate_milestones
CREATE TRIGGER trg_cm_updated_at
  BEFORE UPDATE ON candidate_milestones
  FOR EACH ROW EXECUTE FUNCTION fn_candidate_lifecycle_set_updated_at();

CREATE TRIGGER trg_cm_signal
  AFTER INSERT OR UPDATE OR DELETE ON candidate_milestones
  FOR EACH ROW EXECUTE FUNCTION notify_progress_change();

-- candidate_prep_course_bookings
CREATE TRIGGER trg_cpcb_updated_at
  BEFORE UPDATE ON candidate_prep_course_bookings
  FOR EACH ROW EXECUTE FUNCTION fn_candidate_lifecycle_set_updated_at();

CREATE TRIGGER trg_cpcb_signal
  AFTER INSERT OR UPDATE OR DELETE ON candidate_prep_course_bookings
  FOR EACH ROW EXECUTE FUNCTION notify_progress_change();

-- -----------------------------------------------------------------------------
-- 7. RLS
--
--    READ   uses the existing can_access_candidate_user(uuid) SECURITY DEFINER
--           helper (defined in 20260331020000_phase2_data_integrity.sql). That
--           function already encodes: self-access via candidate_profiles,
--           direct manager, director via reports_to, PA via
--           pa_manager_assignments, and admin/director role. Reusing it keeps
--           access rules in one place.
--
--    WRITE  explicitly excludes the candidate role. Even though
--           can_access_candidate_user would return true for the candidate
--           themselves (read access), the WITH CHECK / USING clauses for
--           INSERT/UPDATE add a JWT role check so a candidate cannot
--           self-certify a paper or milestone.
--
--    DELETE gated to admin/director/manager (PA excluded — PAs don't undo).
-- -----------------------------------------------------------------------------

ALTER TABLE candidate_paper_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_prep_course_bookings ENABLE ROW LEVEL SECURITY;

-- candidate_paper_attempts
CREATE POLICY cpa_select ON candidate_paper_attempts
  FOR SELECT TO authenticated
  USING (can_access_candidate_user(candidate_id));
CREATE POLICY cpa_insert ON candidate_paper_attempts
  FOR INSERT TO authenticated
  WITH CHECK (
    can_access_candidate_user(candidate_id)
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','director','manager','pa')
  );
CREATE POLICY cpa_update ON candidate_paper_attempts
  FOR UPDATE TO authenticated
  USING (
    can_access_candidate_user(candidate_id)
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','director','manager','pa')
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','director','manager','pa')
  );
CREATE POLICY cpa_delete ON candidate_paper_attempts
  FOR DELETE TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','director','manager')
  );

-- candidate_milestones
CREATE POLICY cm_select ON candidate_milestones
  FOR SELECT TO authenticated
  USING (can_access_candidate_user(candidate_id));
CREATE POLICY cm_insert ON candidate_milestones
  FOR INSERT TO authenticated
  WITH CHECK (
    can_access_candidate_user(candidate_id)
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','director','manager','pa')
  );
CREATE POLICY cm_update ON candidate_milestones
  FOR UPDATE TO authenticated
  USING (
    can_access_candidate_user(candidate_id)
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','director','manager','pa')
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','director','manager','pa')
  );
CREATE POLICY cm_delete ON candidate_milestones
  FOR DELETE TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','director','manager')
  );

-- candidate_prep_course_bookings
CREATE POLICY cpcb_select ON candidate_prep_course_bookings
  FOR SELECT TO authenticated
  USING (can_access_candidate_user(candidate_id));
CREATE POLICY cpcb_insert ON candidate_prep_course_bookings
  FOR INSERT TO authenticated
  WITH CHECK (
    can_access_candidate_user(candidate_id)
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','director','manager','pa')
  );
CREATE POLICY cpcb_update ON candidate_prep_course_bookings
  FOR UPDATE TO authenticated
  USING (
    can_access_candidate_user(candidate_id)
    AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','director','manager','pa')
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','director','manager','pa')
  );
CREATE POLICY cpcb_delete ON candidate_prep_course_bookings
  FOR DELETE TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin','director','manager')
  );

-- -----------------------------------------------------------------------------
-- 8. Seed rows for the new per-candidate tables.
--
--    Legacy 'approved' -> 'eapp_done' UPDATE is INTENTIONALLY NOT in this
--    migration. Any existing 'approved' row, if rewritten here, would be
--    unreadable by mobile clients that haven't yet shipped Phase B
--    (CANDIDATE_STATUS_CONFIG with 'eapp_done' key). The rewrite is deferred
--    to a follow-up migration that MUST ship AFTER the Phase B app deploy.
--
--    These seed INSERTs are safe: they populate new tables that existing app
--    versions do not query.
-- -----------------------------------------------------------------------------

-- No paper-attempts seed. Rows are created only when a manager schedules an
-- exam sitting; "not started" is the absence of any row for that code.

-- Seed milestone rows (4 codes per candidate, all 'not_started').
INSERT INTO candidate_milestones (candidate_id, milestone_code)
SELECT c.id, code
FROM candidates c
CROSS JOIN (VALUES ('bes_induction'),('soar'),('rnf'),('sales_authority')) AS p(code)
ON CONFLICT (candidate_id, milestone_code) DO NOTHING;

-- Seed prep-course booking rows (3 codes per candidate, no booking yet).
INSERT INTO candidate_prep_course_bookings (candidate_id, course_code)
SELECT c.id, code
FROM candidates c
CROSS JOIN (VALUES ('M9_M9A'),('RES5'),('HI')) AS p(code)
ON CONFLICT (candidate_id, course_code) DO NOTHING;

-- (No paper-attempts seeds; the absence of rows is a valid "not started" state.)
