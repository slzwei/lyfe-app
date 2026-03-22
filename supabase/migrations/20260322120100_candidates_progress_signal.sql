-- Add candidates table to progress_signals triggers.
-- When staff update candidate status on mobile, lyfe-sg picks it up via Realtime.
-- When staff update on lyfe-sg, lyfe-app picks it up via the same signal.
CREATE TRIGGER trg_candidates_progress_signal
  AFTER INSERT OR UPDATE ON candidates
  FOR EACH ROW EXECUTE FUNCTION notify_progress_change();
