-- Phase E (pivot): BDM is a post-license formality with the principal, NOT a
-- recruitment-stage interview flag. Move it into the candidate_milestones
-- family (alongside BES / SOAR / RNF / Sales Authority).
--
-- This migration supersedes the is_bdm column that was added in
-- 20260417100100 before Phase E was redesigned. The column was never read by
-- shipped code (Phase E UI was reverted before any client build went out), so
-- dropping it is safe.

-- -----------------------------------------------------------------------------
-- 1. Drop the orphaned is_bdm column on interviews.
-- -----------------------------------------------------------------------------

ALTER TABLE interviews
  DROP COLUMN IF EXISTS is_bdm;

-- -----------------------------------------------------------------------------
-- 2. Extend candidate_milestones.milestone_code CHECK to accept 'bdm'.
--    Postgres does not support modifying an existing CHECK in place, so drop
--    and re-add with the broader accepted set.
-- -----------------------------------------------------------------------------

ALTER TABLE candidate_milestones
  DROP CONSTRAINT IF EXISTS candidate_milestones_milestone_code_check;

ALTER TABLE candidate_milestones
  ADD CONSTRAINT candidate_milestones_milestone_code_check
  CHECK (milestone_code IN ('bdm','bes_induction','soar','rnf','sales_authority'));

-- -----------------------------------------------------------------------------
-- 3. Extend cm_status_valid_per_code CHECK: BDM shares the BES/SOAR status
--    group (not_started / scheduled / completed). A BDM interview never
--    "fails" — it's a pre-contracting formality — so it does not need a
--    fail status.
-- -----------------------------------------------------------------------------

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
