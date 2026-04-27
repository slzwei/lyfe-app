-- Narrow the four `notify_progress_change` triggers so they only fire on
-- meaningful column changes. Today they fire on every UPDATE — including
-- `updated_at`-only touches from sibling BEFORE triggers — which means a
-- bulk metadata sweep of 500 rows produces 500 Realtime events broadcast
-- to every subscriber in lyfe-app + lyfe-sg.
--
-- INSERT and DELETE always fire — those are always meaningful. The WHEN
-- clauses below only constrain UPDATE.
--
-- Conservative column lists: we include every column that drives a UI
-- update on either app, plus a couple that don't today but plausibly
-- could. False positives are harmless; false negatives silently break
-- Realtime. When in doubt, include the column.

-- ─────────────────────────────────────────────────────────────────────
-- candidates
-- ─────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_candidates_progress_signal ON public.candidates;

CREATE TRIGGER trg_candidates_progress_signal_ins_del
  AFTER INSERT OR DELETE ON public.candidates
  FOR EACH ROW EXECUTE FUNCTION public.notify_progress_change();

CREATE TRIGGER trg_candidates_progress_signal_upd
  AFTER UPDATE ON public.candidates
  FOR EACH ROW
  WHEN (
    OLD.status IS DISTINCT FROM NEW.status OR
    OLD.assigned_manager_id IS DISTINCT FROM NEW.assigned_manager_id OR
    OLD.stage_before_hold IS DISTINCT FROM NEW.stage_before_hold OR
    OLD.rejected_at IS DISTINCT FROM NEW.rejected_at OR
    OLD.rejected_reason IS DISTINCT FROM NEW.rejected_reason OR
    OLD.rejected_by_user_id IS DISTINCT FROM NEW.rejected_by_user_id OR
    OLD.converted_to_agent_at IS DISTINCT FROM NEW.converted_to_agent_at OR
    OLD.current_stage_id IS DISTINCT FROM NEW.current_stage_id OR
    OLD.stage_entered_at IS DISTINCT FROM NEW.stage_entered_at OR
    OLD.job_id IS DISTINCT FROM NEW.job_id OR
    OLD.name IS DISTINCT FROM NEW.name OR
    OLD.phone IS DISTINCT FROM NEW.phone OR
    OLD.email IS DISTINCT FROM NEW.email OR
    OLD.notes IS DISTINCT FROM NEW.notes OR
    OLD.resume_url IS DISTINCT FROM NEW.resume_url OR
    OLD.invite_token IS DISTINCT FROM NEW.invite_token
  )
  EXECUTE FUNCTION public.notify_progress_change();

-- ─────────────────────────────────────────────────────────────────────
-- candidate_paper_attempts
--   columns: candidate_id, paper_code, exam_at, cost, result,
--   logged_by_user_id, created_at, updated_at
-- ─────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_cpa_signal ON public.candidate_paper_attempts;

CREATE TRIGGER trg_cpa_signal_ins_del
  AFTER INSERT OR DELETE ON public.candidate_paper_attempts
  FOR EACH ROW EXECUTE FUNCTION public.notify_progress_change();

CREATE TRIGGER trg_cpa_signal_upd
  AFTER UPDATE ON public.candidate_paper_attempts
  FOR EACH ROW
  WHEN (
    OLD.candidate_id IS DISTINCT FROM NEW.candidate_id OR
    OLD.paper_code IS DISTINCT FROM NEW.paper_code OR
    OLD.exam_at IS DISTINCT FROM NEW.exam_at OR
    OLD.cost IS DISTINCT FROM NEW.cost OR
    OLD.result IS DISTINCT FROM NEW.result OR
    OLD.logged_by_user_id IS DISTINCT FROM NEW.logged_by_user_id
  )
  EXECUTE FUNCTION public.notify_progress_change();

-- ─────────────────────────────────────────────────────────────────────
-- candidate_milestones
--   columns: candidate_id, milestone_code, status, scheduled_date,
--   scheduled_end_date, completed_date, reference_number,
--   verified_by_user_id, note, created_at, updated_at
-- ─────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_cm_signal ON public.candidate_milestones;

CREATE TRIGGER trg_cm_signal_ins_del
  AFTER INSERT OR DELETE ON public.candidate_milestones
  FOR EACH ROW EXECUTE FUNCTION public.notify_progress_change();

CREATE TRIGGER trg_cm_signal_upd
  AFTER UPDATE ON public.candidate_milestones
  FOR EACH ROW
  WHEN (
    OLD.candidate_id IS DISTINCT FROM NEW.candidate_id OR
    OLD.milestone_code IS DISTINCT FROM NEW.milestone_code OR
    OLD.status IS DISTINCT FROM NEW.status OR
    OLD.scheduled_date IS DISTINCT FROM NEW.scheduled_date OR
    OLD.scheduled_end_date IS DISTINCT FROM NEW.scheduled_end_date OR
    OLD.completed_date IS DISTINCT FROM NEW.completed_date OR
    OLD.reference_number IS DISTINCT FROM NEW.reference_number OR
    OLD.verified_by_user_id IS DISTINCT FROM NEW.verified_by_user_id OR
    OLD.note IS DISTINCT FROM NEW.note
  )
  EXECUTE FUNCTION public.notify_progress_change();

-- ─────────────────────────────────────────────────────────────────────
-- candidate_prep_course_bookings
--   columns: candidate_id, course_code, booked_by_user_id, booked_date,
--   booked_end_date, attended, note, created_at, updated_at
-- ─────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_cpcb_signal ON public.candidate_prep_course_bookings;

CREATE TRIGGER trg_cpcb_signal_ins_del
  AFTER INSERT OR DELETE ON public.candidate_prep_course_bookings
  FOR EACH ROW EXECUTE FUNCTION public.notify_progress_change();

CREATE TRIGGER trg_cpcb_signal_upd
  AFTER UPDATE ON public.candidate_prep_course_bookings
  FOR EACH ROW
  WHEN (
    OLD.candidate_id IS DISTINCT FROM NEW.candidate_id OR
    OLD.course_code IS DISTINCT FROM NEW.course_code OR
    OLD.booked_by_user_id IS DISTINCT FROM NEW.booked_by_user_id OR
    OLD.booked_date IS DISTINCT FROM NEW.booked_date OR
    OLD.booked_end_date IS DISTINCT FROM NEW.booked_end_date OR
    OLD.attended IS DISTINCT FROM NEW.attended OR
    OLD.note IS DISTINCT FROM NEW.note
  )
  EXECUTE FUNCTION public.notify_progress_change();

COMMENT ON TRIGGER trg_candidates_progress_signal_upd ON public.candidates IS
    'Fires notify_progress_change only when a meaningful column changes — excludes updated_at-only touches that the sibling BEFORE trigger applies on every write.';
