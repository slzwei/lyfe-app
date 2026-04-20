-- Clean up the diagnostic function introduced in 20260419110000.
-- No longer needed — realtime state verified in-session.

DROP FUNCTION IF EXISTS public._diag_realtime_state();
