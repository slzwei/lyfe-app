-- Callback log for candidates (lyfe-sg ATS). One row per call attempt:
-- the SG-local date it happened (separate date/time columns — no TZ math on
-- display), an optional time and note, and a mandatory outcome. Each log also
-- writes a candidate_activities breadcrumb, mirroring the interviews pattern.
CREATE TABLE public.candidate_callbacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  logged_by_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  callback_date date NOT NULL,
  callback_time time,
  note text,
  outcome text NOT NULL CHECK (outcome IN ('reached', 'no_answer', 'callback_requested', 'not_interested')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- "Latest callback per candidate" for the list view.
CREATE INDEX idx_candidate_callbacks_candidate_date
  ON public.candidate_callbacks (candidate_id, callback_date DESC, created_at DESC);

ALTER TABLE public.candidate_callbacks ENABLE ROW LEVEL SECURITY;

-- Staff may read; all writes go through the lyfe-sg service role (no
-- INSERT/UPDATE/DELETE policies on purpose). JWT-role pattern — joining
-- users inside a policy recurses (see shared-supabase reference).
CREATE POLICY candidate_callbacks_staff_select ON public.candidate_callbacks
  FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'director', 'manager', 'pa', 'ro'));
