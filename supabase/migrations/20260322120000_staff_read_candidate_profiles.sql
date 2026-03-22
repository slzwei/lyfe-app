-- Allow staff (admin, director, manager, pa) to read candidate profiles
-- Required for Task 2: showing application details on mobile
CREATE POLICY staff_read_candidate_profiles
  ON public.candidate_profiles
  FOR SELECT
  USING (
    (((auth.jwt() -> 'app_metadata'::text) ->> 'role'::text) IN ('admin', 'director', 'manager', 'pa'))
  );
