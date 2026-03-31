
-- Jobs + Pipeline Stages for ATS Phase 2

-- 1. Enums
DO $$ BEGIN
  CREATE TYPE job_status AS ENUM ('draft', 'open', 'paused', 'closed', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE stage_type AS ENUM ('sourced', 'screening', 'assessment', 'interview', 'offer', 'hired', 'custom');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Jobs table
CREATE TABLE IF NOT EXISTS public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  department text,
  location text,
  description text,
  status job_status NOT NULL DEFAULT 'draft',
  created_by uuid NOT NULL REFERENCES public.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  closed_at timestamptz,
  archived_at timestamptz
);

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read all jobs" ON public.jobs FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin','director','manager','agent')));

CREATE POLICY "Staff can insert jobs" ON public.jobs FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin','director','manager')));

CREATE POLICY "Staff can update jobs" ON public.jobs FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin','director','manager')));

CREATE TRIGGER trg_jobs_updated_at
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 3. Pipeline stages table
CREATE TABLE IF NOT EXISTS public.pipeline_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  name text NOT NULL,
  stage_type stage_type NOT NULL DEFAULT 'custom',
  display_order smallint NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read pipeline stages" ON public.pipeline_stages FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin','director','manager','agent')));

CREATE POLICY "Managers can manage pipeline stages" ON public.pipeline_stages FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin','director','manager')));

CREATE UNIQUE INDEX IF NOT EXISTS idx_pipeline_stages_order ON public.pipeline_stages (job_id, display_order);

-- 4. Add job + stage columns to candidates
ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS job_id uuid REFERENCES public.jobs(id),
  ADD COLUMN IF NOT EXISTS current_stage_id uuid REFERENCES public.pipeline_stages(id),
  ADD COLUMN IF NOT EXISTS stage_entered_at timestamptz;

-- 5. Stage transitions log
CREATE TABLE IF NOT EXISTS public.stage_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  from_stage_id uuid REFERENCES public.pipeline_stages(id),
  to_stage_id uuid NOT NULL REFERENCES public.pipeline_stages(id),
  moved_by uuid NOT NULL REFERENCES public.users(id),
  note text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.stage_transitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read transitions" ON public.stage_transitions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin','director','manager','agent')));

CREATE POLICY "Staff can insert transitions" ON public.stage_transitions FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin','director','manager','agent')));

-- 6. Add job_id to invitations
ALTER TABLE public.invitations ADD COLUMN IF NOT EXISTS job_id uuid REFERENCES public.jobs(id);

-- 7. Default pipeline helper
CREATE OR REPLACE FUNCTION public.create_default_pipeline(p_job_id uuid)
RETURNS void AS $$
BEGIN
  INSERT INTO public.pipeline_stages (job_id, name, stage_type, display_order) VALUES
    (p_job_id, 'Applied',    'sourced',    0),
    (p_job_id, 'Screening',  'screening',  1),
    (p_job_id, 'Assessment', 'assessment', 2),
    (p_job_id, 'Interview',  'interview',  3),
    (p_job_id, 'Offer',      'offer',      4),
    (p_job_id, 'Hired',      'hired',      5);
END;
$$ LANGUAGE plpgsql;
