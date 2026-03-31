-- Add attached_files JSONB column to invitations for pre-acceptance document uploads
ALTER TABLE public.invitations
  ADD COLUMN IF NOT EXISTS attached_files jsonb DEFAULT '[]';

-- Ensure the candidate-resumes bucket exists (may already exist from mobile app)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('candidate-resumes', 'candidate-resumes', false, 5242880, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;
