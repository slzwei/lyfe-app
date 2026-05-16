-- Re-apply the candidate_milestones milestone_code CHECK to ensure 'bdm' is
-- accepted. The original migration 20260418110000_bdm_as_milestone.sql was
-- recorded as applied on staging but the DDL silently did not take effect
-- (constraint def confirmed via pg_get_constraintdef without 'bdm' in the
-- accepted set). Replaying it idempotently fixes the drift on staging and
-- guards against the same drift ever surfacing on prod.
--
-- Discovered during synthetic monitoring B1.2 (activate-agent probe).

ALTER TABLE candidate_milestones
  DROP CONSTRAINT IF EXISTS candidate_milestones_milestone_code_check;

ALTER TABLE candidate_milestones
  ADD CONSTRAINT candidate_milestones_milestone_code_check
  CHECK (milestone_code IN ('bdm','bes_induction','soar','rnf','sales_authority'));

ALTER TABLE candidate_milestones
  DROP CONSTRAINT IF EXISTS cm_status_valid_per_code;

ALTER TABLE candidate_milestones
  ADD CONSTRAINT cm_status_valid_per_code CHECK (
    (milestone_code IN ('bdm','bes_induction','soar')
      AND status IN ('not_started','scheduled','completed'))
    OR (milestone_code = 'rnf'
      AND status IN ('not_started','lodged_to_mas','issued'))
    OR (milestone_code = 'sales_authority'
      AND status IN ('not_started','issued'))
  );
