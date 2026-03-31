
-- Phase 4: Search indexes + document storage

-- 1. Enable trigram extension for fuzzy text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. GIN indexes for fast text search on candidates
CREATE INDEX IF NOT EXISTS idx_candidates_name_trgm
  ON public.candidates USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_candidates_email_trgm
  ON public.candidates USING gin (email gin_trgm_ops);

-- 3. Index for filtering candidates by job and stage
CREATE INDEX IF NOT EXISTS idx_candidates_job_stage
  ON public.candidates (job_id, current_stage_id);

-- 4. Create candidate-documents storage bucket (private, 10MB limit)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'candidate-documents',
  'candidate-documents',
  false,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO NOTHING;

-- 5. Storage policy: staff can upload/read candidate documents
CREATE POLICY "Staff can upload candidate documents"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'candidate-documents'
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'director', 'manager', 'agent')
    )
  );

CREATE POLICY "Staff can read candidate documents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'candidate-documents'
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'director', 'manager', 'agent')
    )
  );

CREATE POLICY "Staff can delete candidate documents"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'candidate-documents'
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'director', 'manager', 'agent')
    )
  );
