-- Phase 6: Document that candidate_id in progress tables references users.id, not candidates.id
-- This is intentional: roadmap progress is tracked per auth user (who has role='candidate'),
-- and the RLS function can_access_candidate_user() uses the users table hierarchy.
COMMENT ON COLUMN candidate_module_progress.candidate_id IS
  'References users.id (not candidates.id). Named candidate_id because it tracks a candidate-role user''s progress through training modules.';

COMMENT ON COLUMN candidate_module_item_progress.candidate_id IS
  'References users.id (not candidates.id). Named candidate_id because it tracks a candidate-role user''s progress through module items.';
