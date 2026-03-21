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
--   +6580000004 = agent
--   +6580000005 = pa
--   +6580000006 = candidate
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Resolve mock user IDs by phone from auth.users
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    v_admin_id      UUID;
    v_director_id   UUID;
    v_manager_id    UUID;
    v_agent_id      UUID;
    v_pa_id         UUID;
    v_candidate_id  UUID;
    v_event_id      UUID;
    v_lead1_id      UUID;
    v_lead2_id      UUID;
    v_lead3_id      UUID;
    v_cand1_id      UUID;
    v_cand2_id      UUID;
BEGIN
    -- Look up auth user IDs by phone
    SELECT id INTO v_admin_id    FROM auth.users WHERE phone = '+6580000001';
    SELECT id INTO v_director_id FROM auth.users WHERE phone = '+6580000002';
    SELECT id INTO v_manager_id  FROM auth.users WHERE phone = '+6580000003';
    SELECT id INTO v_agent_id    FROM auth.users WHERE phone = '+6580000004';
    SELECT id INTO v_pa_id       FROM auth.users WHERE phone = '+6580000005';
    SELECT id INTO v_candidate_id FROM auth.users WHERE phone = '+6580000006';

    -- Abort if any mock user hasn't logged in yet
    IF v_admin_id IS NULL THEN RAISE EXCEPTION 'Admin user (+6580000001) not found. Log in first.'; END IF;
    IF v_director_id IS NULL THEN RAISE EXCEPTION 'Director user (+6580000002) not found. Log in first.'; END IF;
    IF v_manager_id IS NULL THEN RAISE EXCEPTION 'Manager user (+6580000003) not found. Log in first.'; END IF;
    IF v_agent_id IS NULL THEN RAISE EXCEPTION 'Agent user (+6580000004) not found. Log in first.'; END IF;
    IF v_pa_id IS NULL THEN RAISE EXCEPTION 'PA user (+6580000005) not found. Log in first.'; END IF;
    IF v_candidate_id IS NULL THEN RAISE EXCEPTION 'Candidate user (+6580000006) not found. Log in first.'; END IF;

    RAISE NOTICE 'Found all 6 mock users. Seeding E2E data...';

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
        reports_to = v_manager_id
    WHERE id = v_agent_id;

    UPDATE public.users SET
        full_name = 'Priya PA',
        role = 'pa',
        onboarding_complete = true,
        is_active = true,
        reports_to = v_manager_id
    WHERE id = v_pa_id;

    UPDATE public.users SET
        full_name = 'Charlie Candidate',
        role = 'candidate',
        onboarding_complete = true,
        is_active = true,
        reports_to = NULL
    WHERE id = v_candidate_id;

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
        (v_lead1_id, 'John Tan', '+6591111111', 'john.tan@test.com', 'referral', 'new', 'life', v_agent_id, v_manager_id),
        (v_lead2_id, 'Sarah Lim', '+6592222222', 'sarah.lim@test.com', 'online', 'contacted', 'health', v_agent_id, v_manager_id),
        (v_lead3_id, 'Michael Wong', '+6593333333', 'michael.w@test.com', 'event', 'qualified', 'ilp', v_manager_id, v_manager_id)
    ON CONFLICT DO NOTHING;

    -- Lead activities
    INSERT INTO public.lead_activities (lead_id, user_id, type, description, metadata)
    VALUES
        (v_lead1_id, v_manager_id, 'created', NULL, '{}'),
        (v_lead2_id, v_manager_id, 'created', NULL, '{}'),
        (v_lead2_id, v_agent_id, 'call', 'Called to discuss health plans', '{}'),
        (v_lead3_id, v_manager_id, 'created', NULL, '{}'),
        (v_lead3_id, v_manager_id, 'note', 'Met at roadshow, very interested in ILP', '{}')
    ON CONFLICT DO NOTHING;

    RAISE NOTICE 'Leads and activities seeded.';

    -- -----------------------------------------------------------------------
    -- 4. Candidates (created by manager, assigned to manager)
    -- -----------------------------------------------------------------------
    v_cand1_id := gen_random_uuid();
    v_cand2_id := gen_random_uuid();

    INSERT INTO public.candidates (id, name, phone, email, status, assigned_manager_id, created_by_id)
    VALUES
        (v_cand1_id, 'Emily Chen', '+6594444444', 'emily.chen@test.com', 'interview_scheduled', v_manager_id, v_manager_id),
        (v_cand2_id, 'Kevin Lee', '+6595555555', 'kevin.lee@test.com', 'applied', v_manager_id, v_pa_id)
    ON CONFLICT DO NOTHING;

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

    INSERT INTO public.events (id, title, description, event_type, event_date, start_time, end_time, location, created_by)
    VALUES
        (v_event_id, 'Weekly Team Meeting', 'Regular team sync', 'team_meeting',
         CURRENT_DATE + 1, '10:00', '11:00', 'Conference Room A', v_manager_id),
        (gen_random_uuid(), 'Product Training', 'ILP product deep dive', 'training',
         CURRENT_DATE + 3, '14:00', '16:00', 'Training Room B', v_manager_id),
        (gen_random_uuid(), 'Past Roadshow', 'Completed roadshow event', 'roadshow',
         CURRENT_DATE - 7, '09:00', '17:00', 'MBS Convention Hall', v_manager_id)
    ON CONFLICT DO NOTHING;

    -- Add attendees to the team meeting
    INSERT INTO public.event_attendees (event_id, user_id, attendee_role)
    VALUES
        (v_event_id, v_manager_id, 'host'),
        (v_event_id, v_agent_id, 'attendee'),
        (v_event_id, v_pa_id, 'attendee'),
        (v_event_id, v_candidate_id, 'attendee')
    ON CONFLICT DO NOTHING;

    RAISE NOTICE 'Events and attendees seeded.';

    -- -----------------------------------------------------------------------
    -- 6. Notifications
    -- -----------------------------------------------------------------------
    INSERT INTO public.notifications (user_id, title, body, type, is_read)
    VALUES
        (v_manager_id, 'New Lead Assigned', 'John Tan has been assigned to your team', 'lead_assigned', false),
        (v_manager_id, 'Interview Tomorrow', 'Emily Chen interview at 10:00 AM', 'interview_reminder', false),
        (v_agent_id, 'New Lead', 'You have a new lead: John Tan', 'lead_assigned', false)
    ON CONFLICT DO NOTHING;

    RAISE NOTICE 'Notifications seeded.';

    -- -----------------------------------------------------------------------
    -- Done
    -- -----------------------------------------------------------------------
    RAISE NOTICE '✅ E2E seed complete. All 6 mock users ready.';
END $$;
