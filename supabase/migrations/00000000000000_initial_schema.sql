-- =============================================================================
-- Lyfe App — Full Schema Snapshot
-- Generated from live Supabase DB on 2026-03-08
-- =============================================================================

-- ── Custom Enum Types ────────────────────────────────────────────────────────

CREATE TYPE candidate_status AS ENUM (
  'applied', 'interview_scheduled', 'interviewed', 'approved', 'exam_prep', 'licensed', 'active_agent'
);

CREATE TYPE event_type AS ENUM (
  'team_meeting', 'training', 'agency_event', 'roadshow', 'other'
);

CREATE TYPE interview_status AS ENUM (
  'scheduled', 'completed', 'cancelled', 'rescheduled'
);

CREATE TYPE interview_type AS ENUM (
  'zoom', 'in_person'
);

CREATE TYPE lead_activity_type AS ENUM (
  'created', 'note', 'call', 'status_change', 'reassignment', 'email', 'meeting', 'follow_up'
);

CREATE TYPE lead_source AS ENUM (
  'referral', 'walk_in', 'online', 'event', 'cold_call', 'other'
);

CREATE TYPE lead_status AS ENUM (
  'new', 'contacted', 'qualified', 'proposed', 'won', 'lost'
);

CREATE TYPE lifecycle_stage AS ENUM (
  'applied', 'interview_scheduled', 'interviewed', 'approved', 'exam_prep', 'licensed', 'active_agent'
);

CREATE TYPE product_interest AS ENUM (
  'life', 'health', 'ilp', 'general'
);

CREATE TYPE user_role AS ENUM (
  'admin', 'director', 'manager', 'agent', 'pa', 'candidate'
);


-- ── Tables ───────────────────────────────────────────────────────────────────

CREATE TABLE users (
  id uuid NOT NULL,
  email text,
  phone text,
  full_name text NOT NULL,
  avatar_url text,
  role user_role NOT NULL DEFAULT 'candidate'::user_role,
  reports_to uuid,
  lifecycle_stage lifecycle_stage,
  date_of_birth date,
  last_login_at timestamptz,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  external_id text,
  push_token text,
  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_reports_to_fkey FOREIGN KEY (reports_to) REFERENCES users(id)
);

CREATE TABLE candidates (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL,
  email text,
  status candidate_status NOT NULL DEFAULT 'applied'::candidate_status,
  assigned_manager_id uuid NOT NULL,
  created_by_id uuid NOT NULL,
  invite_token text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  resume_url text,
  CONSTRAINT candidates_pkey PRIMARY KEY (id),
  CONSTRAINT candidates_invite_token_key UNIQUE (invite_token),
  CONSTRAINT candidates_assigned_manager_id_fkey FOREIGN KEY (assigned_manager_id) REFERENCES users(id),
  CONSTRAINT candidates_created_by_id_fkey FOREIGN KEY (created_by_id) REFERENCES users(id)
);

CREATE TABLE candidate_activities (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL,
  user_id uuid NOT NULL,
  type text NOT NULL,
  outcome text,
  note text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT candidate_activities_pkey PRIMARY KEY (id),
  CONSTRAINT candidate_activities_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
);

CREATE TABLE candidate_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL,
  label text NOT NULL,
  file_url text NOT NULL,
  file_name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT candidate_documents_pkey PRIMARY KEY (id),
  CONSTRAINT candidate_documents_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
);

CREATE TABLE events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  event_type event_type NOT NULL DEFAULT 'other'::event_type,
  event_date date NOT NULL,
  start_time time NOT NULL,
  end_time time,
  location text,
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  external_attendees jsonb NOT NULL DEFAULT '[]'::jsonb,
  CONSTRAINT events_pkey PRIMARY KEY (id),
  CONSTRAINT events_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE event_attendees (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  user_id uuid NOT NULL,
  attendee_role text NOT NULL DEFAULT 'attendee'::text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT event_attendees_pkey PRIMARY KEY (id),
  CONSTRAINT event_attendees_event_id_user_id_key UNIQUE (event_id, user_id),
  CONSTRAINT event_attendees_event_id_fkey FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  CONSTRAINT event_attendees_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE exam_papers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL,
  title text NOT NULL,
  description text,
  duration_minutes integer NOT NULL DEFAULT 60,
  pass_percentage integer NOT NULL DEFAULT 70,
  question_count integer NOT NULL DEFAULT 50,
  is_active boolean DEFAULT true,
  is_mandatory boolean DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT exam_papers_pkey PRIMARY KEY (id),
  CONSTRAINT exam_papers_code_key UNIQUE (code)
);

CREATE TABLE exam_questions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  paper_id uuid NOT NULL,
  question_number integer NOT NULL,
  question_text text NOT NULL,
  has_latex boolean DEFAULT false,
  options jsonb NOT NULL,
  correct_answer text NOT NULL,
  explanation text,
  explanation_has_latex boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT exam_questions_pkey PRIMARY KEY (id),
  CONSTRAINT exam_questions_paper_id_question_number_key UNIQUE (paper_id, question_number),
  CONSTRAINT exam_questions_paper_id_fkey FOREIGN KEY (paper_id) REFERENCES exam_papers(id) ON DELETE CASCADE
);

CREATE TABLE exam_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  paper_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'in_progress'::text,
  score integer,
  total_questions integer NOT NULL,
  percentage numeric,
  passed boolean,
  started_at timestamptz DEFAULT now(),
  submitted_at timestamptz,
  duration_seconds integer,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT exam_attempts_pkey PRIMARY KEY (id),
  CONSTRAINT exam_attempts_paper_id_fkey FOREIGN KEY (paper_id) REFERENCES exam_papers(id),
  CONSTRAINT exam_attempts_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE exam_answers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL,
  question_id uuid NOT NULL,
  selected_answer text,
  is_correct boolean,
  answered_at timestamptz DEFAULT now(),
  CONSTRAINT exam_answers_pkey PRIMARY KEY (id),
  CONSTRAINT exam_answers_attempt_id_question_id_key UNIQUE (attempt_id, question_id),
  CONSTRAINT exam_answers_attempt_id_fkey FOREIGN KEY (attempt_id) REFERENCES exam_attempts(id) ON DELETE CASCADE,
  CONSTRAINT exam_answers_question_id_fkey FOREIGN KEY (question_id) REFERENCES exam_questions(id)
);

CREATE TABLE interviews (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL,
  manager_id uuid NOT NULL,
  scheduled_by_id uuid NOT NULL,
  round_number integer NOT NULL DEFAULT 1,
  type interview_type NOT NULL DEFAULT 'zoom'::interview_type,
  datetime timestamptz NOT NULL,
  location text,
  zoom_link text,
  google_calendar_event_id text,
  status interview_status NOT NULL DEFAULT 'scheduled'::interview_status,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT interviews_pkey PRIMARY KEY (id),
  CONSTRAINT interviews_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
  CONSTRAINT interviews_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES users(id),
  CONSTRAINT interviews_scheduled_by_id_fkey FOREIGN KEY (scheduled_by_id) REFERENCES users(id)
);

CREATE TABLE invite_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  token text NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'::text),
  intended_role user_role NOT NULL DEFAULT 'candidate'::user_role,
  assigned_manager_id uuid,
  created_by uuid NOT NULL,
  consumed_by uuid,
  consumed_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + '7 days'::interval),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT invite_tokens_pkey PRIMARY KEY (id),
  CONSTRAINT invite_tokens_token_key UNIQUE (token),
  CONSTRAINT invite_tokens_assigned_manager_id_fkey FOREIGN KEY (assigned_manager_id) REFERENCES users(id),
  CONSTRAINT invite_tokens_consumed_by_fkey FOREIGN KEY (consumed_by) REFERENCES users(id),
  CONSTRAINT invite_tokens_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE leads (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  assigned_to uuid NOT NULL,
  created_by uuid NOT NULL,
  full_name text NOT NULL,
  phone text,
  email text,
  source lead_source DEFAULT 'other'::lead_source,
  source_name text,
  external_id text,
  status lead_status NOT NULL DEFAULT 'new'::lead_status,
  product_interest product_interest DEFAULT 'general'::product_interest,
  notes text,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT leads_pkey PRIMARY KEY (id),
  CONSTRAINT leads_external_id_source_name_key UNIQUE (external_id, source_name),
  CONSTRAINT leads_external_id_unique UNIQUE (external_id),
  CONSTRAINT leads_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES users(id),
  CONSTRAINT leads_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE lead_activities (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL,
  user_id uuid NOT NULL,
  type lead_activity_type NOT NULL,
  description text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT lead_activities_pkey PRIMARY KEY (id),
  CONSTRAINT lead_activities_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
  CONSTRAINT lead_activities_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE pa_manager_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pa_id uuid NOT NULL,
  manager_id uuid NOT NULL,
  assigned_at timestamptz DEFAULT now(),
  CONSTRAINT pa_manager_assignments_pkey PRIMARY KEY (id),
  CONSTRAINT pa_manager_assignments_pa_id_manager_id_key UNIQUE (pa_id, manager_id),
  CONSTRAINT pa_manager_assignments_pa_id_fkey FOREIGN KEY (pa_id) REFERENCES users(id),
  CONSTRAINT pa_manager_assignments_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES users(id)
);

CREATE TABLE roadshow_configs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  weekly_cost numeric NOT NULL,
  slots_per_day integer NOT NULL DEFAULT 3,
  expected_start_time time NOT NULL,
  late_grace_minutes integer NOT NULL DEFAULT 15,
  suggested_sitdowns integer NOT NULL DEFAULT 5,
  suggested_pitches integer NOT NULL DEFAULT 3,
  suggested_closed integer NOT NULL DEFAULT 1,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT roadshow_configs_pkey PRIMARY KEY (id),
  CONSTRAINT roadshow_configs_event_id_key UNIQUE (event_id),
  CONSTRAINT roadshow_configs_event_id_fkey FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE roadshow_attendance (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  user_id uuid NOT NULL,
  checked_in_at timestamptz NOT NULL DEFAULT now(),
  late_reason text,
  checked_in_by uuid,
  pledged_sitdowns integer NOT NULL DEFAULT 0,
  pledged_pitches integer NOT NULL DEFAULT 0,
  pledged_closed integer NOT NULL DEFAULT 0,
  pledged_afyc numeric NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT roadshow_attendance_pkey PRIMARY KEY (id),
  CONSTRAINT roadshow_attendance_event_id_user_id_key UNIQUE (event_id, user_id),
  CONSTRAINT roadshow_attendance_event_id_fkey FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  CONSTRAINT roadshow_attendance_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT roadshow_attendance_checked_in_by_fkey FOREIGN KEY (checked_in_by) REFERENCES users(id)
);

CREATE TABLE roadshow_activities (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  user_id uuid NOT NULL,
  type text NOT NULL,
  afyc_amount numeric,
  logged_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT roadshow_activities_pkey PRIMARY KEY (id),
  CONSTRAINT roadshow_activities_event_id_fkey FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  CONSTRAINT roadshow_activities_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);


-- ── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX idx_candidates_assigned_manager_id ON candidates (assigned_manager_id);
CREATE INDEX idx_candidates_created_by ON candidates (created_by_id);
CREATE INDEX idx_candidates_created_by_id ON candidates (created_by_id);
CREATE INDEX idx_candidates_manager ON candidates (assigned_manager_id);
CREATE INDEX idx_candidates_status ON candidates (status);

CREATE INDEX idx_exam_answers_attempt ON exam_answers (attempt_id);
CREATE INDEX idx_exam_answers_attempt_id ON exam_answers (attempt_id);
CREATE INDEX idx_exam_answers_question_id ON exam_answers (question_id);
CREATE INDEX idx_exam_attempts_paper_id ON exam_attempts (paper_id);
CREATE INDEX idx_exam_attempts_user ON exam_attempts (user_id, paper_id);
CREATE INDEX idx_exam_attempts_user_id ON exam_attempts (user_id);
CREATE INDEX idx_exam_questions_paper ON exam_questions (paper_id, question_number);
CREATE INDEX idx_exam_questions_paper_id ON exam_questions (paper_id);

CREATE INDEX idx_interviews_candidate ON interviews (candidate_id);
CREATE INDEX idx_interviews_candidate_id ON interviews (candidate_id);
CREATE INDEX idx_interviews_manager ON interviews (manager_id);
CREATE INDEX idx_interviews_manager_id ON interviews (manager_id);
CREATE INDEX idx_interviews_scheduled_by_id ON interviews (scheduled_by_id);

CREATE INDEX idx_invite_tokens_assigned_manager_id ON invite_tokens (assigned_manager_id);
CREATE INDEX idx_invite_tokens_consumed_by ON invite_tokens (consumed_by);
CREATE INDEX idx_invite_tokens_created_by ON invite_tokens (created_by);
CREATE INDEX idx_invite_tokens_token ON invite_tokens (token);

CREATE INDEX idx_lead_activities_created_at ON lead_activities (created_at DESC);
CREATE INDEX idx_lead_activities_lead_id ON lead_activities (lead_id);
CREATE INDEX idx_lead_activities_user_id ON lead_activities (user_id);
CREATE INDEX idx_leads_assigned_to ON leads (assigned_to);
CREATE INDEX idx_leads_created_at ON leads (created_at DESC);
CREATE INDEX idx_leads_created_by ON leads (created_by);
CREATE INDEX idx_leads_status ON leads (status);

CREATE INDEX idx_pa_manager_assignments_manager_id ON pa_manager_assignments (manager_id);
CREATE INDEX idx_pa_manager_assignments_pa_id ON pa_manager_assignments (pa_id);

CREATE INDEX roadshow_activities_event_user_idx ON roadshow_activities (event_id, user_id);

CREATE INDEX idx_users_reports_to ON users (reports_to);
CREATE INDEX idx_users_role ON users (role);


-- ── Functions ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION auth_user_role()
RETURNS user_role
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION get_team_member_ids(superior_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH RECURSIVE team AS (
    SELECT id FROM public.users WHERE reports_to = superior_id AND is_active = true
    UNION ALL
    SELECT u.id FROM public.users u INNER JOIN team t ON u.reports_to = t.id WHERE u.is_active = true
  )
  SELECT id FROM team;
$$;

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.users (id, phone, full_name, role)
  VALUES (
    NEW.id,
    NEW.phone,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
    'candidate'
  )
  ON CONFLICT (id) DO UPDATE SET
    last_login_at = now(),
    phone = COALESCE(EXCLUDED.phone, users.phone);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION sync_role_to_jwt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', NEW.role::text)
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_candidates_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION create_roadshow_bulk(p_events jsonb, p_config jsonb, p_attendees jsonb, p_created_by uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_event_ids uuid[] := '{}';
  v_event_id uuid;
  v_event jsonb;
BEGIN
  FOR v_event IN SELECT * FROM jsonb_array_elements(p_events)
  LOOP
    INSERT INTO events (
      title, description, event_type, event_date, start_time, end_time,
      location, created_by, external_attendees
    ) VALUES (
      v_event->>'title',
      NULLIF(v_event->>'description', ''),
      'roadshow',
      (v_event->>'event_date')::date,
      (v_event->>'start_time')::time,
      CASE WHEN v_event->>'end_time' IS NOT NULL AND v_event->>'end_time' != ''
           THEN (v_event->>'end_time')::time ELSE NULL END,
      NULLIF(v_event->>'location', ''),
      p_created_by,
      '[]'::jsonb
    )
    RETURNING id INTO v_event_id;

    v_event_ids := array_append(v_event_ids, v_event_id);

    INSERT INTO roadshow_configs (
      event_id, weekly_cost, slots_per_day, expected_start_time,
      late_grace_minutes, suggested_sitdowns, suggested_pitches, suggested_closed
    ) VALUES (
      v_event_id,
      (p_config->>'weekly_cost')::numeric,
      (p_config->>'slots_per_day')::int,
      (p_config->>'expected_start_time')::time,
      (p_config->>'late_grace_minutes')::int,
      (p_config->>'suggested_sitdowns')::int,
      (p_config->>'suggested_pitches')::int,
      (p_config->>'suggested_closed')::int
    );
  END LOOP;

  IF jsonb_array_length(p_attendees) > 0 THEN
    INSERT INTO event_attendees (event_id, user_id, attendee_role)
    SELECT v_eid, (att->>'user_id')::uuid, att->>'attendee_role'
    FROM unnest(v_event_ids) v_eid
    CROSS JOIN jsonb_array_elements(p_attendees) att;
  END IF;

  RETURN jsonb_build_object(
    'event_ids', to_jsonb(v_event_ids),
    'count', array_length(v_event_ids, 1)
  );
END;
$$;


-- ── Triggers ─────────────────────────────────────────────────────────────────

CREATE TRIGGER candidates_updated_at
  BEFORE UPDATE ON candidates
  FOR EACH ROW EXECUTE FUNCTION update_candidates_updated_at();

CREATE TRIGGER exam_papers_updated_at
  BEFORE UPDATE ON exam_papers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER interviews_updated_at
  BEFORE UPDATE ON interviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER on_user_role_change
  AFTER INSERT OR UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION sync_role_to_jwt();

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE candidate_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE invite_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE pa_manager_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE roadshow_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE roadshow_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE roadshow_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;


-- ── RLS Policies ─────────────────────────────────────────────────────────────

-- candidate_activities
CREATE POLICY insert_own ON candidate_activities FOR INSERT TO public
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY read_all ON candidate_activities FOR SELECT TO public
  USING (true);

-- candidate_documents
CREATE POLICY delete_auth ON candidate_documents FOR DELETE TO public
  USING (auth.role() = 'authenticated'::text);
CREATE POLICY insert_auth ON candidate_documents FOR INSERT TO public
  WITH CHECK (auth.role() = 'authenticated'::text);
CREATE POLICY read_all ON candidate_documents FOR SELECT TO public
  USING (true);

-- candidates
CREATE POLICY "Authenticated users can read candidates" ON candidates FOR SELECT TO authenticated
  USING (true);
CREATE POLICY candidates_insert_own ON candidates FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by_id);
CREATE POLICY candidates_update ON candidates FOR UPDATE TO public
  USING (
    (auth.uid() = assigned_manager_id) OR
    (auth.uid() = created_by_id) OR
    (EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role = ANY (ARRAY['manager'::user_role, 'director'::user_role, 'admin'::user_role, 'pa'::user_role])
    ))
  );

-- event_attendees
CREATE POLICY manage_attendees ON event_attendees FOR ALL TO public
  USING (
    (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = ANY (ARRAY['pa'::user_role, 'admin'::user_role])))
    OR (EXISTS (SELECT 1 FROM events WHERE events.id = event_attendees.event_id AND events.created_by = auth.uid()))
  )
  WITH CHECK (
    (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = ANY (ARRAY['pa'::user_role, 'admin'::user_role])))
    OR (EXISTS (SELECT 1 FROM events WHERE events.id = event_attendees.event_id AND events.created_by = auth.uid()))
  );
CREATE POLICY read_event_attendees ON event_attendees FOR SELECT TO authenticated
  USING (true);

-- events
CREATE POLICY authenticated_insert_events ON events FOR INSERT TO public
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY delete_events ON events FOR DELETE TO public
  USING (
    (created_by = auth.uid()) OR
    (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'::user_role))
  );
CREATE POLICY read_events ON events FOR SELECT TO authenticated
  USING (true);
CREATE POLICY update_events ON events FOR UPDATE TO public
  USING (
    (created_by = auth.uid()) OR
    (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'::user_role)) OR
    (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'pa'::user_role AND users.reports_to = events.created_by))
  );

-- exam_answers
CREATE POLICY exam_answers_insert_own ON exam_answers FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM exam_attempts
    WHERE exam_attempts.id = exam_answers.attempt_id
      AND exam_attempts.user_id = auth.uid()
      AND exam_attempts.status = 'in_progress'::text
  ));
CREATE POLICY exam_answers_select_own ON exam_answers FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM exam_attempts
    WHERE exam_attempts.id = exam_answers.attempt_id
      AND exam_attempts.user_id = auth.uid()
  ));
CREATE POLICY exam_answers_update_own ON exam_answers FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM exam_attempts
    WHERE exam_attempts.id = exam_answers.attempt_id
      AND exam_attempts.user_id = auth.uid()
      AND exam_attempts.status = 'in_progress'::text
  ));

-- exam_attempts
CREATE POLICY exam_attempts_insert_own ON exam_attempts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY exam_attempts_select_own ON exam_attempts FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY exam_attempts_select_team ON exam_attempts FOR SELECT TO authenticated
  USING (user_id IN (SELECT get_team_member_ids(auth.uid())));
CREATE POLICY exam_attempts_update_own ON exam_attempts FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status = 'in_progress'::text);

-- exam_papers
CREATE POLICY exam_papers_admin ON exam_papers FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'::user_role));
CREATE POLICY exam_papers_select ON exam_papers FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

-- exam_questions
CREATE POLICY exam_questions_admin ON exam_questions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'::user_role));
CREATE POLICY exam_questions_select ON exam_questions FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

-- interviews
CREATE POLICY "Authenticated users can read interviews" ON interviews FOR SELECT TO authenticated
  USING (true);
CREATE POLICY interviews_delete ON interviews FOR DELETE TO public
  USING (
    (auth.uid() = manager_id) OR
    (auth.uid() = scheduled_by_id) OR
    (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = ANY (ARRAY['manager'::user_role, 'director'::user_role, 'admin'::user_role, 'pa'::user_role])))
  );
CREATE POLICY interviews_insert_own ON interviews FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = scheduled_by_id);
CREATE POLICY interviews_update ON interviews FOR UPDATE TO public
  USING (
    (auth.uid() = manager_id) OR
    (auth.uid() = scheduled_by_id) OR
    (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = ANY (ARRAY['manager'::user_role, 'director'::user_role, 'admin'::user_role, 'pa'::user_role])))
  );

-- invite_tokens
CREATE POLICY invite_tokens_insert ON invite_tokens FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
      AND users.role = ANY (ARRAY['pa'::user_role, 'admin'::user_role, 'director'::user_role, 'manager'::user_role])
  ));
CREATE POLICY invite_tokens_select ON invite_tokens FOR SELECT TO authenticated
  USING (
    (created_by = auth.uid()) OR
    (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'::user_role))
  );

-- lead_activities
CREATE POLICY "Authenticated users can read activities" ON lead_activities FOR SELECT TO authenticated
  USING (true);
CREATE POLICY lead_activities_insert_own ON lead_activities FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- leads
CREATE POLICY "Authenticated users can read leads" ON leads FOR SELECT TO authenticated
  USING (true);
CREATE POLICY leads_insert_own ON leads FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);
CREATE POLICY leads_update_own ON leads FOR UPDATE TO authenticated
  USING ((auth.uid() = assigned_to) OR (auth.uid() = created_by));

-- pa_manager_assignments
CREATE POLICY pa_assignments_select ON pa_manager_assignments FOR SELECT TO authenticated
  USING (
    (pa_id = auth.uid()) OR
    (manager_id = auth.uid()) OR
    ((auth.jwt() -> 'app_metadata'::text ->> 'role'::text) = 'admin'::text)
  );

-- roadshow_activities
CREATE POLICY roadshow_activities_insert ON roadshow_activities FOR INSERT TO public
  WITH CHECK (user_id = auth.uid());
CREATE POLICY roadshow_activities_select ON roadshow_activities FOR SELECT TO public
  USING (
    (event_id IN (SELECT event_attendees.event_id FROM event_attendees WHERE event_attendees.user_id = auth.uid()))
    OR (event_id IN (SELECT events.id FROM events WHERE events.created_by = auth.uid()))
  );

-- roadshow_attendance
CREATE POLICY roadshow_attendance_insert ON roadshow_attendance FOR INSERT TO public
  WITH CHECK (
    (user_id = auth.uid()) OR
    (checked_in_by = auth.uid() AND event_id IN (SELECT events.id FROM events WHERE events.created_by = auth.uid()))
  );
CREATE POLICY roadshow_attendance_select ON roadshow_attendance FOR SELECT TO public
  USING (
    (event_id IN (SELECT event_attendees.event_id FROM event_attendees WHERE event_attendees.user_id = auth.uid()))
    OR (event_id IN (SELECT events.id FROM events WHERE events.created_by = auth.uid()))
  );

-- roadshow_configs
CREATE POLICY roadshow_configs_insert ON roadshow_configs FOR INSERT TO public
  WITH CHECK (event_id IN (SELECT events.id FROM events WHERE events.created_by = auth.uid()));
CREATE POLICY roadshow_configs_select ON roadshow_configs FOR SELECT TO public
  USING (
    (event_id IN (SELECT event_attendees.event_id FROM event_attendees WHERE event_attendees.user_id = auth.uid()))
    OR (event_id IN (SELECT events.id FROM events WHERE events.created_by = auth.uid()))
  );
CREATE POLICY roadshow_configs_update ON roadshow_configs FOR UPDATE TO public
  USING (event_id IN (SELECT events.id FROM events WHERE events.created_by = auth.uid()));

-- users
CREATE POLICY users_insert_admin ON users FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() -> 'app_metadata'::text ->> 'role'::text) = 'admin'::text);
CREATE POLICY users_insert_self ON users FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);
CREATE POLICY users_select_admin ON users FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata'::text ->> 'role'::text) = 'admin'::text);
CREATE POLICY users_select_own ON users FOR SELECT TO authenticated
  USING (auth.uid() = id);
CREATE POLICY users_select_pa ON users FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM pa_manager_assignments
    WHERE pa_manager_assignments.pa_id = auth.uid()
      AND pa_manager_assignments.manager_id = users.id
  ));
CREATE POLICY users_select_team ON users FOR SELECT TO authenticated
  USING (reports_to = auth.uid());
CREATE POLICY users_update_admin ON users FOR UPDATE TO authenticated
  USING ((auth.jwt() -> 'app_metadata'::text ->> 'role'::text) = 'admin'::text);
CREATE POLICY users_update_own ON users FOR UPDATE TO authenticated
  USING (auth.uid() = id);
