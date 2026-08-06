-- Internship outcome marker on candidates. Deliberately orthogonal to
-- candidates.status: status drives the recruitment pipeline (and syncs to
-- users.lifecycle_stage via trg_sync_candidate_lifecycle, whose enum cast
-- requires candidate_status and lifecycle_stage to stay value-identical),
-- while this column records the outcome staff mark in the lyfe-sg ATS.
CREATE TYPE public.internship_status AS ENUM ('joined_internship', 'dropped_out');

ALTER TABLE public.candidates
  ADD COLUMN internship_status public.internship_status;

COMMENT ON COLUMN public.candidates.internship_status IS
  'ATS marker set by staff (pa/ro/manager/director/admin) in lyfe-sg: joined_internship | dropped_out. NULL = not marked.';
