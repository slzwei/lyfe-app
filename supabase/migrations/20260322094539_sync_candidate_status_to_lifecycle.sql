-- Phase 5: Sync candidates.status → users.lifecycle_stage
-- When a candidate's status is updated, automatically update the
-- corresponding user's lifecycle_stage via the candidate_profiles bridge.
CREATE OR REPLACE FUNCTION sync_candidate_status_to_lifecycle()
RETURNS trigger AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    UPDATE users SET lifecycle_stage = NEW.status::text::lifecycle_stage
    FROM candidate_profiles cp
    WHERE cp.candidate_id = NEW.id
      AND users.id = cp.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_sync_candidate_lifecycle
  AFTER UPDATE ON candidates
  FOR EACH ROW EXECUTE FUNCTION sync_candidate_status_to_lifecycle();
