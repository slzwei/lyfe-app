-- =============================================================================
-- E2E Test Data Seed Script
-- =============================================================================
-- Run after all 6 mock users have logged in at least once (to create auth entries).
-- Usage: supabase db execute --file supabase/seed-e2e.sql
--   or:  psql $DATABASE_URL -f supabase/seed-e2e.sql
--
-- Mock users:
--   +6580000001 = admin
--   +6580000002 = director
--   +6580000003 = manager
--   +6580000004 = agent          (face_registered_at set for E2E roadshow flow)
--   +6580000005 = pa
--   +6580000006 = candidate      (onboarding_complete=true)
--   +6590000007 = e2e candidate  (onboarding_complete=false, used by lifecycle flow)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0a. Defensive: normalize public.users RLS so self-select works.
-- ---------------------------------------------------------------------------
-- Maestro symptom: profile fetch returns PGRST116 ("0 rows") with the user's
-- own JWT, even though the seed inserts the row with the matching id and the
-- service-role diagnostic confirms the row is present. The CI workflow does
-- not apply migrations to staging — it only seeds — so if staging's RLS has
-- drifted from 20260305194752_fix_rls_roles_triggers_indexes.sql, the
-- `users_select_own` policy may be missing or different. Re-create it here
-- so a freshly OTP-signed-in user can read their own profile row.
DROP POLICY IF EXISTS users_select_own ON public.users;
CREATE POLICY users_select_own ON public.users
    FOR SELECT TO authenticated
    USING (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- 0. Resolve mock user IDs by phone from auth.users
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    v_admin_id          UUID;
    v_director_id       UUID;
    v_manager_id        UUID;
    v_agent_id          UUID;
    v_pa_id             UUID;
    v_pa2_id            UUID;
    v_candidate_id      UUID;
    v_e2e_candidate_id  UUID;
    v_event_id          UUID;
    v_roadshow_event_id UUID;
    v_lead1_id          UUID;
    v_lead2_id          UUID;
    v_lead3_id          UUID;
    v_mktr_lead_id      UUID;
    v_cand1_id          UUID;
    v_cand2_id          UUID;
BEGIN
    -- Look up auth user IDs by phone. Match either format ('+6580000001' or
    -- '6580000001'). Prefer the E164 (+prefix) form — that is what GoTrue OTP
    -- signs in as — and fall back to created_at ASC to be deterministic if
    -- both formats somehow coexist (see e2e-bootstrap.mjs ensureUser cleanup).
    SELECT id INTO v_admin_id         FROM auth.users WHERE REPLACE(phone, '+', '') = '6580000001'
        ORDER BY CASE WHEN phone LIKE '+%' THEN 0 ELSE 1 END, created_at ASC LIMIT 1;
    SELECT id INTO v_director_id      FROM auth.users WHERE REPLACE(phone, '+', '') = '6580000002'
        ORDER BY CASE WHEN phone LIKE '+%' THEN 0 ELSE 1 END, created_at ASC LIMIT 1;
    SELECT id INTO v_manager_id       FROM auth.users WHERE REPLACE(phone, '+', '') = '6580000003'
        ORDER BY CASE WHEN phone LIKE '+%' THEN 0 ELSE 1 END, created_at ASC LIMIT 1;
    SELECT id INTO v_agent_id         FROM auth.users WHERE REPLACE(phone, '+', '') = '6580000004'
        ORDER BY CASE WHEN phone LIKE '+%' THEN 0 ELSE 1 END, created_at ASC LIMIT 1;
    SELECT id INTO v_pa_id            FROM auth.users WHERE REPLACE(phone, '+', '') = '6580000005'
        ORDER BY CASE WHEN phone LIKE '+%' THEN 0 ELSE 1 END, created_at ASC LIMIT 1;
    SELECT id INTO v_pa2_id           FROM auth.users WHERE REPLACE(phone, '+', '') = '6580000101'
        ORDER BY CASE WHEN phone LIKE '+%' THEN 0 ELSE 1 END, created_at ASC LIMIT 1;
    SELECT id INTO v_candidate_id     FROM auth.users WHERE REPLACE(phone, '+', '') = '6580000006'
        ORDER BY CASE WHEN phone LIKE '+%' THEN 0 ELSE 1 END, created_at ASC LIMIT 1;
    SELECT id INTO v_e2e_candidate_id FROM auth.users WHERE REPLACE(phone, '+', '') = '6590000007'
        ORDER BY CASE WHEN phone LIKE '+%' THEN 0 ELSE 1 END, created_at ASC LIMIT 1;

    -- Abort if any mock user hasn't logged in yet
    IF v_admin_id IS NULL THEN RAISE EXCEPTION 'Admin user (+6580000001) not found. Log in first.'; END IF;
    IF v_director_id IS NULL THEN RAISE EXCEPTION 'Director user (+6580000002) not found. Log in first.'; END IF;
    IF v_manager_id IS NULL THEN RAISE EXCEPTION 'Manager user (+6580000003) not found. Log in first.'; END IF;
    IF v_agent_id IS NULL THEN RAISE EXCEPTION 'Agent user (+6580000004) not found. Log in first.'; END IF;
    IF v_pa_id IS NULL THEN RAISE EXCEPTION 'PA user (+6580000005) not found. Log in first.'; END IF;
    IF v_pa2_id IS NULL THEN RAISE EXCEPTION 'PA2 user (+6580000101) not found. Log in first.'; END IF;
    IF v_candidate_id IS NULL THEN RAISE EXCEPTION 'Candidate user (+6580000006) not found. Log in first.'; END IF;
    IF v_e2e_candidate_id IS NULL THEN RAISE EXCEPTION 'E2E candidate user (+6590000007) not found. Log in first.'; END IF;

    RAISE NOTICE 'Found all 7 mock users. Seeding E2E data...';

    -- -----------------------------------------------------------------------
    -- 0.5. Ensure public.users rows exist for every mock user
    -- -----------------------------------------------------------------------
    -- handle_new_user() fires on auth.users INSERT for OTP-flow signups but
    -- not always for admin-API-created users (depends on trigger + RLS),
    -- so we cannot assume the public.users mirror row exists. INSERT with
    -- ON CONFLICT DO NOTHING ensures every row is present before the
    -- UPDATEs below; reports_to stays NULL here to avoid an FK chicken-and-
    -- egg (the UPDATEs in step 1 set the hierarchy in dependency order).
    -- Phone columns are constrained to '^\d{7,15}$' (digits only, no '+') by
    -- the 20260427130700_phone_format_normalize_and_check.sql migration.
    INSERT INTO public.users (id, phone, full_name)
    VALUES
        (v_admin_id,         '6580000001', 'Alice Admin'),
        (v_director_id,      '6580000002', 'Diana Director'),
        (v_manager_id,       '6580000003', 'Rachel Manager'),
        (v_agent_id,         '6580000004', 'David Agent'),
        (v_pa_id,            '6580000005', 'Priya PA'),
        (v_pa2_id,           '6580000101', 'Naomi PA2'),
        (v_candidate_id,     '6580000006', 'Charlie Candidate'),
        (v_e2e_candidate_id, '6590000007', 'E2E Candidate')
    ON CONFLICT (id) DO NOTHING;

    -- Grandfather the mock users so the check_phone_eligible() RPC treats
    -- them as pre-invitation-system accounts (created before 2026-03-29).
    -- Without this, the post-cutoff branch demands an accepted
    -- member_invitations row + login is blocked with "No account found".
    -- Also backfill PDPA consent timestamps so the auth gate doesn't route
    -- post-login traffic to /onboarding/Consent (which would prevent
    -- home-scroll-view from rendering and time out the flows).
    UPDATE public.users
    SET created_at = '2026-01-01T00:00:00Z',
        consent_tos_at = NOW(),
        consent_privacy_at = NOW(),
        consent_operational_push_at = NOW()
    WHERE id IN (v_admin_id, v_director_id, v_manager_id, v_agent_id, v_pa_id, v_pa2_id, v_candidate_id, v_e2e_candidate_id);

    -- -----------------------------------------------------------------------
    -- 1. Update user profiles: roles, names, hierarchy, onboarding
    -- -----------------------------------------------------------------------
    UPDATE public.users SET
        full_name = 'Alice Admin',
        role = 'admin',
        onboarding_complete = true,
        is_active = true,
        reports_to = NULL
    WHERE id = v_admin_id;

    UPDATE public.users SET
        full_name = 'Diana Director',
        role = 'director',
        onboarding_complete = true,
        is_active = true,
        reports_to = v_admin_id
    WHERE id = v_director_id;

    UPDATE public.users SET
        full_name = 'Rachel Manager',
        role = 'manager',
        onboarding_complete = true,
        is_active = true,
        reports_to = v_director_id
    WHERE id = v_manager_id;

    UPDATE public.users SET
        full_name = 'David Agent',
        role = 'agent',
        onboarding_complete = true,
        is_active = true,
        reports_to = v_manager_id,
        face_registered_at = NOW()
    WHERE id = v_agent_id;

    UPDATE public.users SET
        full_name = 'Priya PA',
        role = 'pa',
        onboarding_complete = true,
        is_active = true,
        reports_to = v_manager_id
    WHERE id = v_pa_id;

    -- pa2 — PA without pa_manager_assignments. Used by Phase 4c flow
    -- 09-pa-without-manager-blocked. Note: NO INSERT into
    -- pa_manager_assignments below for this user — that absence is the
    -- precondition the negative-path flow exercises.
    UPDATE public.users SET
        full_name = 'Naomi PA2',
        role = 'pa',
        onboarding_complete = true,
        is_active = true,
        reports_to = v_manager_id
    WHERE id = v_pa2_id;

    UPDATE public.users SET
        full_name = 'Charlie Candidate',
        role = 'candidate',
        onboarding_complete = true,
        is_active = true,
        reports_to = NULL
    WHERE id = v_candidate_id;

    -- E2E candidate — used by lifecycle flow. Onboarding NOT complete so the
    -- flow lands on the welcome screen and walks through it on each run.
    -- Consents + email_verified ARE pre-set so the auth gate doesn't first
    -- detour through Consent / EmailVerification (those require real email
    -- infrastructure to drive end-to-end and have their own dedicated flows).
    -- full_name is NOT NULL — use empty string so ProfileSetup's TextInput
    -- starts blank and the flow's inputText writes the real value cleanly.
    UPDATE public.users SET
        full_name = '',
        role = 'candidate',
        onboarding_complete = false,
        is_active = true,
        reports_to = NULL,
        email_verified = true,
        consent_tos_at = NOW(),
        consent_privacy_at = NOW(),
        consent_operational_push_at = NOW()
    WHERE id = v_e2e_candidate_id;

    RAISE NOTICE 'Users updated (roles, names, onboarding_complete).';

    -- -----------------------------------------------------------------------
    -- 2. PA ↔ Manager assignment
    -- -----------------------------------------------------------------------
    INSERT INTO public.pa_manager_assignments (pa_id, manager_id)
    VALUES (v_pa_id, v_manager_id)
    ON CONFLICT DO NOTHING;

    -- -----------------------------------------------------------------------
    -- 3. Leads (assigned to agent, created by manager)
    -- -----------------------------------------------------------------------
    v_lead1_id := gen_random_uuid();
    v_lead2_id := gen_random_uuid();
    v_lead3_id := gen_random_uuid();

    INSERT INTO public.leads (id, full_name, phone, email, source, status, product_interest, assigned_to, created_by)
    VALUES
        (v_lead1_id, 'John Tan', '6591111111', 'john.tan@test.com', 'referral', 'new', 'life', v_agent_id, v_manager_id),
        (v_lead2_id, 'Sarah Lim', '6592222222', 'sarah.lim@test.com', 'online', 'contacted', 'health', v_agent_id, v_manager_id),
        (v_lead3_id, 'Michael Wong', '6593333333', 'michael.w@test.com', 'event', 'qualified', 'ilp', v_manager_id, v_manager_id)
    ON CONFLICT DO NOTHING;

    -- MKTR lead — simulates a webhook arrival for the manager. Used by the
    -- E2E mktr-arrival flow which asserts the badge updates + tap navigates.
    -- source_name='mktr' + external_id is the dedup key the receive-mktr-lead
    -- edge function uses; recreating with the same external_id is idempotent.
    v_mktr_lead_id := gen_random_uuid();
    INSERT INTO public.leads (id, full_name, phone, email, source, source_name, external_id, status, product_interest, assigned_to, created_by)
    VALUES (v_mktr_lead_id, 'E2E MKTR Lead', '6597777777', 'e2e-mktr@test.com', 'online', 'mktr', 'e2e-mktr-fixed-001', 'new', 'life', v_manager_id, v_manager_id)
    ON CONFLICT (external_id, source_name) DO UPDATE SET
        assigned_to = EXCLUDED.assigned_to,
        status = 'new',
        updated_at = NOW()
    RETURNING id INTO v_mktr_lead_id;

    -- Lead activities
    INSERT INTO public.lead_activities (lead_id, user_id, type, description, metadata)
    VALUES
        (v_lead1_id, v_manager_id, 'created', NULL, '{}'),
        (v_lead2_id, v_manager_id, 'created', NULL, '{}'),
        (v_lead2_id, v_agent_id, 'call', 'Called to discuss health plans', '{}'),
        (v_lead3_id, v_manager_id, 'created', NULL, '{}'),
        (v_lead3_id, v_manager_id, 'note', 'Met at roadshow, very interested in ILP', '{}'),
        (v_mktr_lead_id, v_manager_id, 'created', 'Arrived via MKTR (E2E fixture)', '{"source":"mktr"}')
    ON CONFLICT DO NOTHING;

    RAISE NOTICE 'Leads and activities seeded.';

    -- -----------------------------------------------------------------------
    -- 4. Candidates (created by manager, assigned to manager)
    -- -----------------------------------------------------------------------
    -- Pre-clean candidates accumulated by Phase 4b create flows (03-create-
    -- from-staff, 04-create-from-pa). The flows use static phone numbers
    -- (87654321, 87654322 — no email so no UNIQUE-index dedup), but the
    -- create-candidate edge function checks for existing rows by phone and
    -- 409s on conflict. Without this clean-up every CI run after the first
    -- would fail the create flows. CASCADE deletes attached interviews/docs.
    DELETE FROM public.candidates WHERE name LIKE 'E2E Phase4b %';

    -- Idempotent: prefer the row that already exists (matched by email,
    -- which has a partial unique index), otherwise insert. Either way
    -- v_cand1_id / v_cand2_id end up matching the canonical DB row so
    -- downstream interviews INSERT succeeds.
    SELECT id INTO v_cand1_id FROM public.candidates WHERE email = 'emily.chen@test.com';
    IF v_cand1_id IS NULL THEN
        v_cand1_id := gen_random_uuid();
        INSERT INTO public.candidates (id, name, phone, email, status, assigned_manager_id, created_by_id)
        VALUES (v_cand1_id, 'Emily Chen', '6594444444', 'emily.chen@test.com', 'interview_scheduled', v_manager_id, v_manager_id);
    ELSE
        UPDATE public.candidates SET name = 'Emily Chen', phone = '6594444444', assigned_manager_id = v_manager_id WHERE id = v_cand1_id;
    END IF;

    SELECT id INTO v_cand2_id FROM public.candidates WHERE email = 'kevin.lee@test.com';
    IF v_cand2_id IS NULL THEN
        v_cand2_id := gen_random_uuid();
        INSERT INTO public.candidates (id, name, phone, email, status, assigned_manager_id, created_by_id)
        VALUES (v_cand2_id, 'Kevin Lee', '6595555555', 'kevin.lee@test.com', 'applied', v_manager_id, v_pa_id);
    ELSE
        UPDATE public.candidates SET name = 'Kevin Lee', phone = '6595555555', assigned_manager_id = v_manager_id WHERE id = v_cand2_id;
    END IF;

    -- Interview for candidate 1
    INSERT INTO public.interviews (candidate_id, manager_id, scheduled_by_id, datetime, type, location, status)
    VALUES
        (v_cand1_id, v_manager_id, v_pa_id, NOW() + INTERVAL '3 days', 'in_person', 'Office Level 5', 'scheduled')
    ON CONFLICT DO NOTHING;

    RAISE NOTICE 'Candidates and interviews seeded.';

    -- -----------------------------------------------------------------------
    -- 5. Events (upcoming + past)
    -- -----------------------------------------------------------------------
    v_event_id := gen_random_uuid();

    -- Live roadshow event for the E2E check-in flow. Coordinates are Marina
    -- Bay Sands (Singapore CBD); the proximity check is bypassed in E2E
    -- builds via EXPO_PUBLIC_E2E_LOCATION_BYPASS so coords just need to be
    -- non-null. event_date=TODAY with start_time before NOW and end_time
    -- after, so the event is "live" when the flow runs.
    v_roadshow_event_id := gen_random_uuid();

    INSERT INTO public.events (id, title, description, event_type, event_date, start_time, end_time, location, latitude, longitude, location_radius_meters, created_by)
    VALUES
        (v_event_id, 'Weekly Team Meeting', 'Regular team sync', 'team_meeting',
         CURRENT_DATE + 1, '10:00', '11:00', 'Conference Room A', NULL, NULL, 100, v_manager_id),
        (gen_random_uuid(), 'Product Training', 'ILP product deep dive', 'training',
         CURRENT_DATE + 3, '14:00', '16:00', 'Training Room B', NULL, NULL, 100, v_manager_id),
        (gen_random_uuid(), 'Past Roadshow', 'Completed roadshow event', 'roadshow',
         CURRENT_DATE - 7, '09:00', '17:00', 'MBS Convention Hall', 1.2834, 103.8607, 100, v_manager_id),
        (v_roadshow_event_id, 'E2E Live Roadshow', 'Live roadshow for E2E flow', 'roadshow',
         CURRENT_DATE, '00:01', '23:59', 'MBS Convention Hall', 1.2834, 103.8607, 100, v_manager_id)
    ON CONFLICT DO NOTHING;

    -- Add attendees to the team meeting
    INSERT INTO public.event_attendees (event_id, user_id, attendee_role)
    VALUES
        (v_event_id, v_manager_id, 'host'),
        (v_event_id, v_agent_id, 'attendee'),
        (v_event_id, v_pa_id, 'attendee'),
        (v_event_id, v_candidate_id, 'attendee')
    ON CONFLICT DO NOTHING;

    -- Roadshow attendees: agent attends, manager hosts.
    INSERT INTO public.event_attendees (event_id, user_id, attendee_role)
    VALUES
        (v_roadshow_event_id, v_manager_id, 'host'),
        (v_roadshow_event_id, v_agent_id, 'attendee')
    ON CONFLICT DO NOTHING;

    -- Roadshow config — required for the check-in flow's pledge sheet to
    -- pre-populate suggested_*. Idempotent via ON CONFLICT (event_id).
    INSERT INTO public.roadshow_configs (event_id, weekly_cost, slots_per_day, expected_start_time, late_grace_minutes, suggested_sitdowns, suggested_pitches, suggested_closed)
    VALUES (v_roadshow_event_id, 1500, 3, '10:00', 15, 5, 3, 1)
    ON CONFLICT (event_id) DO UPDATE SET
        weekly_cost = EXCLUDED.weekly_cost,
        slots_per_day = EXCLUDED.slots_per_day,
        suggested_sitdowns = EXCLUDED.suggested_sitdowns;

    -- Wipe any prior attendance for the agent on the live roadshow event so
    -- the flow can re-run from a clean slate.
    DELETE FROM public.roadshow_attendance
    WHERE event_id = v_roadshow_event_id AND user_id = v_agent_id;

    RAISE NOTICE 'Events, roadshow config, and attendees seeded.';

    -- -----------------------------------------------------------------------
    -- 6. Notifications
    -- -----------------------------------------------------------------------
    INSERT INTO public.notifications (user_id, title, body, type, is_read)
    VALUES
        (v_manager_id, 'New Lead Assigned', 'John Tan has been assigned to your team', 'lead_assigned', false),
        (v_manager_id, 'Interview Tomorrow', 'Emily Chen interview at 10:00 AM', 'interview_reminder', false),
        (v_agent_id, 'New Lead', 'You have a new lead: John Tan', 'lead_assigned', false),
        (v_manager_id, 'New MKTR Lead', 'E2E MKTR Lead just arrived', 'mktr_lead', false)
    ON CONFLICT DO NOTHING;

    RAISE NOTICE 'Notifications seeded.';

    -- -----------------------------------------------------------------------
    -- Done
    -- -----------------------------------------------------------------------
    RAISE NOTICE '✅ E2E seed complete. All 6 mock users ready.';
END $$;

