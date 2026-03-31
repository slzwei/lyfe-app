
-- Bridge invitation-flow candidates to ATS pipeline candidates
-- Lightweight approach: add FK link, no destructive merge

-- 1. Link candidate_profiles to ATS candidates record
ALTER TABLE public.candidate_profiles
  ADD COLUMN IF NOT EXISTS candidate_id uuid REFERENCES public.candidates(id);

-- 2. Link invitations to ATS candidates record (for reverse lookup)
ALTER TABLE public.invitations
  ADD COLUMN IF NOT EXISTS candidate_record_id uuid REFERENCES public.candidates(id);

-- 3. Index for lookups
CREATE INDEX IF NOT EXISTS idx_candidate_profiles_candidate_id
  ON public.candidate_profiles (candidate_id) WHERE candidate_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invitations_candidate_record_id
  ON public.invitations (candidate_record_id) WHERE candidate_record_id IS NOT NULL;
