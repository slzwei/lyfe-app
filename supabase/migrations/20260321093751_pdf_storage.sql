-- Add PDF storage path columns to invitations
ALTER TABLE public.invitations
  ADD COLUMN IF NOT EXISTS profile_pdf_path text,
  ADD COLUMN IF NOT EXISTS disc_pdf_path text;

-- Create private storage bucket for candidate PDFs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('candidate-pdfs', 'candidate-pdfs', false, 5242880, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;
