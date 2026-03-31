-- Phase 1: Critical Security & Data Integrity
-- 1.1: Flip candidate-resumes bucket to private (data breach fix)
-- 1.2: Server-side exam scoring (exam integrity fix)
-- 1.6: FOR UPDATE SKIP LOCKED on handle_new_user (race condition fix)
-- 1.7: NULL-safe notify_push_dispatcher (silent failure fix)
-- 1.8: Protect email_verified in guard_user_self_update (auth bypass fix)


-- =====================================================================
-- 1.1: candidate-resumes bucket → private
--
-- Migration 20260306123638 created with public: true.
-- Migration 20260322085947 used ON CONFLICT DO NOTHING, never flipping.
-- Candidate resumes with PII are currently world-readable.
-- =====================================================================

UPDATE storage.buckets SET public = false WHERE id = 'candidate-resumes';
DROP POLICY IF EXISTS "Anyone can view resumes" ON storage.objects;


-- =====================================================================
-- 1.2: Rewrite submit_exam_attempt — compute score server-side
--
-- Old RPC accepted p_score, p_percentage, p_passed from the client.
-- Any candidate could call with p_passed = true regardless of answers.
-- New version: server joins exam_answers with exam_questions to compute
-- is_correct, score, percentage, and pass/fail. Personality quizzes
-- (p_personality_results IS NOT NULL) skip scoring (all NULLs).
-- =====================================================================

-- Drop old signature (has p_score, p_percentage, p_passed params)
DROP FUNCTION IF EXISTS public.submit_exam_attempt(UUID, UUID, TEXT, INT, INT, INT, BOOLEAN, TIMESTAMPTZ, TIMESTAMPTZ, INT, JSONB, JSONB);

CREATE FUNCTION public.submit_exam_attempt(
    p_user_id UUID,
    p_paper_id UUID,
    p_status TEXT,
    p_total_questions INT,
    p_started_at TIMESTAMPTZ,
    p_submitted_at TIMESTAMPTZ,
    p_duration_seconds INT,
    p_personality_results JSONB DEFAULT NULL,
    p_answers JSONB DEFAULT '[]'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_attempt_id UUID;
    v_score INT;
    v_percentage INT;
    v_passed BOOLEAN;
    v_pass_pct NUMERIC;
    v_is_personality BOOLEAN;
BEGIN
    -- Verify the caller is who they claim to be
    IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
        RAISE EXCEPTION 'Unauthorized: caller must match p_user_id';
    END IF;

    v_is_personality := (p_personality_results IS NOT NULL);

    -- 1. Insert attempt with NULL score fields (populated after answers)
    INSERT INTO exam_attempts (
        user_id, paper_id, status,
        score, total_questions, percentage, passed,
        started_at, submitted_at, duration_seconds,
        personality_results
    ) VALUES (
        p_user_id, p_paper_id, 'in_progress',
        NULL, p_total_questions, NULL, NULL,
        p_started_at, p_submitted_at, p_duration_seconds,
        p_personality_results
    )
    RETURNING id INTO v_attempt_id;

    -- 2. Insert answers — compute is_correct server-side
    INSERT INTO exam_answers (attempt_id, question_id, selected_answer, is_correct)
    SELECT
        v_attempt_id,
        (ans->>'question_id')::UUID,
        ans->>'selected_answer',
        CASE
            WHEN v_is_personality THEN NULL
            ELSE (ans->>'selected_answer' = eq.correct_answer)
        END
    FROM jsonb_array_elements(p_answers) AS ans
    LEFT JOIN exam_questions eq ON eq.id = (ans->>'question_id')::UUID;

    -- 3. Compute score server-side for non-personality exams
    IF NOT v_is_personality THEN
        SELECT COUNT(*) FILTER (WHERE is_correct = true)
        INTO v_score
        FROM exam_answers
        WHERE attempt_id = v_attempt_id;

        v_percentage := ROUND((v_score::numeric / GREATEST(p_total_questions, 1)) * 100);

        SELECT COALESCE(pass_percentage, 70) INTO v_pass_pct
        FROM exam_papers WHERE id = p_paper_id;

        v_passed := (v_percentage >= v_pass_pct);
    END IF;

    -- 4. Finalize attempt with computed values
    UPDATE exam_attempts
    SET status     = p_status,
        score      = v_score,
        percentage = v_percentage,
        passed     = v_passed
    WHERE id = v_attempt_id;

    RETURN jsonb_build_object(
        'attempt_id', v_attempt_id,
        'score', v_score,
        'percentage', v_percentage,
        'passed', v_passed
    );
END;
$$;


-- =====================================================================
-- 1.6: FOR UPDATE SKIP LOCKED on handle_new_user invitation lookup
--
-- Without row-level locking, concurrent signups with the same phone
-- can both claim a single pending member_invitation.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role  user_role := 'candidate';
  v_name  text;
  v_manager_id uuid;
  v_inv_id uuid;
  v_onboarding boolean := false;
  v_phone text;
BEGIN
  -- Normalize phone (strip '+' to match DB format)
  v_phone := CASE WHEN NEW.phone LIKE '+%' THEN substr(NEW.phone, 2) ELSE NEW.phone END;

  SELECT id, intended_role, full_name, assigned_manager_id
  INTO v_inv_id, v_role, v_name, v_manager_id
  FROM public.member_invitations
  WHERE phone = v_phone
    AND status = 'pending'
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    v_name := COALESCE(NEW.raw_user_meta_data ->> 'full_name', 'New User');
    v_role := 'candidate';
  END IF;

  IF v_role IN ('admin', 'director', 'manager', 'agent', 'pa') THEN
    v_onboarding := true;
  END IF;

  INSERT INTO public.users (id, phone, full_name, role, reports_to, onboarding_complete, email_verified)
  VALUES (
    NEW.id,
    v_phone,
    COALESCE(v_name, 'New User'),
    v_role,
    v_manager_id,
    v_onboarding,
    v_onboarding
  )
  ON CONFLICT (id) DO UPDATE SET
    last_login_at = now(),
    phone         = COALESCE(EXCLUDED.phone, users.phone);

  IF v_inv_id IS NOT NULL THEN
    UPDATE public.member_invitations
    SET status         = 'accepted',
        accepted_by_id = NEW.id,
        accepted_at    = now()
    WHERE id = v_inv_id;
  END IF;

  RETURN NEW;
END;
$$;


-- =====================================================================
-- 1.7: NULL-safe notify_push_dispatcher
--
-- current_setting('supabase.service_role_key', true) returns NULL when
-- the GUC is unset, producing 'Bearer ' → edge function silently
-- rejects. Add explicit NULL check with RAISE WARNING.
-- Also fix missing search_path.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.notify_push_dispatcher()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_key text;
BEGIN
    v_key := current_setting('supabase.service_role_key', true);
    IF v_key IS NULL OR v_key = '' THEN
        RAISE WARNING '[push] service_role_key not configured — push notification skipped for notification %', NEW.id;
        RETURN NEW;
    END IF;

    PERFORM net.http_post(
        url := 'https://nvtedkyjwulkzjeoqjgx.supabase.co/functions/v1/send-push-notification',
        body := jsonb_build_object(
            'record', jsonb_build_object(
                'id', NEW.id,
                'user_id', NEW.user_id,
                'type', NEW.type,
                'title', NEW.title,
                'body', NEW.body,
                'data', NEW.data
            )
        ),
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_key
        )
    );
    RETURN NEW;
END;
$$;


-- =====================================================================
-- 1.8: Protect email_verified in guard_user_self_update
--
-- The trigger pins role, is_active, reports_to, lifecycle_stage,
-- and onboarding_complete — but NOT email_verified.
-- Any user can currently set email_verified = true directly.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.guard_user_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Only enforce when a non-admin user updates their own record
    IF OLD.id = auth.uid()
       AND COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') != 'admin'
    THEN
        NEW.role               := OLD.role;
        NEW.is_active          := OLD.is_active;
        NEW.reports_to         := OLD.reports_to;
        NEW.lifecycle_stage    := OLD.lifecycle_stage;
        NEW.email_verified     := OLD.email_verified;

        -- Allow onboarding_complete to go false->true (one-way latch),
        -- but prevent resetting it back to false.
        IF OLD.onboarding_complete = true THEN
            NEW.onboarding_complete := true;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;
