-- Allow candidates.phone to be NULL for email-link auth flow
-- (candidates authenticate via invitation token; phone collected during onboarding)
ALTER TABLE public.candidates ALTER COLUMN phone DROP NOT NULL;

-- Add email-based dedup index for invite flow where phone may be null initially
CREATE UNIQUE INDEX IF NOT EXISTS idx_candidates_email_unique
  ON public.candidates (email)
  WHERE email IS NOT NULL AND email != '';
