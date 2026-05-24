-- Candidate delete & archive support for the lyfe-app mobile app.
-- Phase 1 of CANDIDATE_DELETE_ARCHIVE_PLAN.md.
--
-- Adds archive columns to `candidates`, a guarded archive RPC the mobile client
-- can call directly, and a transactional hard-delete RPC invoked only by the
-- `delete-candidate` edge function (service role). Widens the progress-signal
-- UPDATE trigger so mobile candidate lists refresh on archive / unarchive.
--
-- Cascade verified against the live schema on 2026-05-22:
--   * candidate_module_progress / candidate_module_item_progress key their
--     `candidate_id` column to users.id (NOT candidates.id) — deleted by user
--     id. (This contradicts the FK Chains note in lyfe-master/CLAUDE.md, which
--     is stale and should be corrected.)
--   * event_attendees.user_id -> users is NO ACTION — must be deleted here or
--     the edge function's auth-user deletion is blocked by the FK.
--   * roadshow_attendance / roadshow_activities are CASCADE on users; deleted
--     here too so the RPC transaction is self-contained.
--   * candidate_profiles and invitations are NO ACTION on candidates — deleted
--     before the candidates row. candidate_profiles also FKs invitations, so it
--     is deleted before invitations.
--   * All other candidate-keyed tables are CASCADE on candidates; deleted
--     explicitly anyway for clarity and order-independence.
--   * exam_answers is CASCADE on exam_attempts; deleted explicitly first.

-- ── Archive columns ──────────────────────────────────────────────────────────

ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by_id uuid;

ALTER TABLE public.candidates
  DROP CONSTRAINT IF EXISTS candidates_archived_by_id_fkey;

ALTER TABLE public.candidates
  ADD CONSTRAINT candidates_archived_by_id_fkey
  FOREIGN KEY (archived_by_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- archived_by_id may only be set when archived_at is set; archived_at may stand
-- alone (e.g. the archiving user was later deleted via the SET NULL above).
ALTER TABLE public.candidates
  DROP CONSTRAINT IF EXISTS candidates_archive_pair_check;

ALTER TABLE public.candidates
  ADD CONSTRAINT candidates_archive_pair_check
  CHECK (
    (archived_at IS NULL AND archived_by_id IS NULL)
    OR archived_at IS NOT NULL
  );

CREATE INDEX IF NOT EXISTS idx_candidates_active_updated_at
  ON public.candidates (updated_at DESC)
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_candidates_archived_at
  ON public.candidates (archived_at DESC)
  WHERE archived_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_candidates_archived_by_id
  ON public.candidates (archived_by_id)
  WHERE archived_by_id IS NOT NULL;

-- ── Archive RPC (mobile-callable, self-authorizing) ──────────────────────────
-- SECURITY DEFINER so it can write regardless of table RLS, but it enforces
-- caller role and candidate access itself. Reversible, so no edge function.

CREATE OR REPLACE FUNCTION public.set_candidate_archived(
  p_candidate_id uuid,
  p_archived boolean
)
RETURNS TABLE (
  candidate_id uuid,
  archived_at timestamptz,
  archived_by_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_actor_role text;
  v_now timestamptz := now();
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
  END IF;

  SELECT u.role::text
  INTO v_actor_role
  FROM public.users u
  WHERE u.id = v_actor_id
    AND u.is_active IS TRUE;

  IF v_actor_role IS NULL THEN
    RAISE EXCEPTION 'User is inactive or missing' USING ERRCODE = '42501';
  END IF;

  IF v_actor_role NOT IN ('admin', 'director', 'manager', 'pa', 'ro') THEN
    RAISE EXCEPTION 'Insufficient permissions' USING ERRCODE = '42501';
  END IF;

  PERFORM 1
  FROM public.candidates c
  WHERE c.id = p_candidate_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Candidate not found' USING ERRCODE = 'P0002';
  END IF;

  -- admin / director / ro have global candidate access; everyone else is
  -- team-scoped via can_access_candidate_user().
  IF NOT (
    public.can_access_candidate_user(p_candidate_id)
    OR v_actor_role IN ('admin', 'director', 'ro')
  ) THEN
    RAISE EXCEPTION 'You do not have access to this candidate' USING ERRCODE = '42501';
  END IF;

  IF p_archived THEN
    UPDATE public.candidates c
    SET archived_at = COALESCE(c.archived_at, v_now),
        archived_by_id = COALESCE(c.archived_by_id, v_actor_id),
        updated_at = v_now
    WHERE c.id = p_candidate_id;

    -- Mirror onto linked invitations so lyfe-sg's invitation-centric list
    -- stays consistent with a mobile-originated archive.
    UPDATE public.invitations i
    SET archived_at = COALESCE(i.archived_at, v_now)
    WHERE i.candidate_record_id = p_candidate_id
      AND i.archived_at IS NULL;
  ELSE
    UPDATE public.candidates c
    SET archived_at = NULL,
        archived_by_id = NULL,
        updated_at = v_now
    WHERE c.id = p_candidate_id;

    UPDATE public.invitations i
    SET archived_at = NULL
    WHERE i.candidate_record_id = p_candidate_id
      AND i.archived_at IS NOT NULL;
  END IF;

  RETURN QUERY
  SELECT c.id, c.archived_at, c.archived_by_id
  FROM public.candidates c
  WHERE c.id = p_candidate_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_candidate_archived(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_candidate_archived(uuid, boolean) TO authenticated, service_role;

-- ── Hard-delete cascade RPC (service-role only) ──────────────────────────────
-- SECURITY INVOKER + granted only to service_role: all caller authorization
-- (JWT, role, team access, delete eligibility) lives in the edge function.

CREATE OR REPLACE FUNCTION public.delete_candidate_cascade(p_candidate_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_ids uuid[] := ARRAY[]::uuid[];
  v_invitation_ids uuid[] := ARRAY[]::uuid[];
  v_phone text;
  v_phone_digits text;
  v_normalized_phone text;
BEGIN
  -- Lock the candidate row; fail fast if it is already gone.
  SELECT c.phone
  INTO v_phone
  FROM public.candidates c
  WHERE c.id = p_candidate_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Candidate not found' USING ERRCODE = 'P0002';
  END IF;

  -- Every auth user linked through candidate_profiles. A candidate can have
  -- more than one profile row (e.g. an SMS-OTP record plus a /join-us
  -- applicant), so collect them all.
  SELECT COALESCE(array_agg(DISTINCT cp.user_id) FILTER (WHERE cp.user_id IS NOT NULL), ARRAY[]::uuid[])
  INTO v_user_ids
  FROM public.candidate_profiles cp
  WHERE cp.candidate_id = p_candidate_id;

  -- Invitations linked by candidate record or by any linked user.
  SELECT COALESCE(array_agg(DISTINCT i.id), ARRAY[]::uuid[])
  INTO v_invitation_ids
  FROM public.invitations i
  WHERE i.candidate_record_id = p_candidate_id
     OR (cardinality(v_user_ids) > 0 AND i.user_id = ANY(v_user_ids));

  -- ── User-keyed rows ────────────────────────────────────────────────────────
  IF cardinality(v_user_ids) > 0 THEN
    -- exam_answers cascades from exam_attempts; delete explicitly first.
    DELETE FROM public.exam_answers
    WHERE attempt_id IN (
      SELECT id FROM public.exam_attempts WHERE user_id = ANY(v_user_ids)
    );
    DELETE FROM public.exam_attempts WHERE user_id = ANY(v_user_ids);

    DELETE FROM public.email_otp_codes WHERE user_id = ANY(v_user_ids);
    DELETE FROM public.emock_tutorial_progress WHERE user_id = ANY(v_user_ids);
    DELETE FROM public.emock_attempts WHERE user_id = ANY(v_user_ids);
    DELETE FROM public.notifications WHERE user_id = ANY(v_user_ids);

    DELETE FROM public.enneagram_results WHERE user_id = ANY(v_user_ids);
    DELETE FROM public.enneagram_responses WHERE user_id = ANY(v_user_ids);
    DELETE FROM public.disc_results WHERE user_id = ANY(v_user_ids);
    DELETE FROM public.disc_responses WHERE user_id = ANY(v_user_ids);

    -- candidate_module_progress / candidate_module_item_progress key
    -- `candidate_id` to users.id (verified against live schema 2026-05-22).
    DELETE FROM public.candidate_module_item_progress WHERE candidate_id = ANY(v_user_ids);
    DELETE FROM public.candidate_module_progress WHERE candidate_id = ANY(v_user_ids);

    -- event_attendees.user_id -> users is NO ACTION: must be removed here or
    -- the edge function's auth-user deletion is blocked by the FK.
    DELETE FROM public.event_attendees WHERE user_id = ANY(v_user_ids);

    -- roadshow rows cascade from users; deleted here for a self-contained txn.
    DELETE FROM public.roadshow_activities WHERE user_id = ANY(v_user_ids);
    DELETE FROM public.roadshow_attendance WHERE user_id = ANY(v_user_ids);
  END IF;

  -- ── Candidate-keyed rows (CASCADE on candidates; explicit for clarity) ──────
  DELETE FROM public.candidate_programme_enrollment WHERE candidate_id = p_candidate_id;
  DELETE FROM public.candidate_paper_attempts WHERE candidate_id = p_candidate_id;
  DELETE FROM public.candidate_milestones WHERE candidate_id = p_candidate_id;
  DELETE FROM public.candidate_prep_course_bookings WHERE candidate_id = p_candidate_id;
  DELETE FROM public.stage_transitions WHERE candidate_id = p_candidate_id;
  DELETE FROM public.interviews WHERE candidate_id = p_candidate_id;
  DELETE FROM public.candidate_activities WHERE candidate_id = p_candidate_id;
  DELETE FROM public.candidate_documents WHERE candidate_id = p_candidate_id;

  -- candidate_profiles is NO ACTION on both candidates and invitations:
  -- remove before either.
  DELETE FROM public.candidate_profiles
  WHERE candidate_id = p_candidate_id
     OR (cardinality(v_user_ids) > 0 AND user_id = ANY(v_user_ids));

  -- invitations.candidate_record_id is NO ACTION on candidates.
  IF cardinality(v_invitation_ids) > 0 THEN
    DELETE FROM public.invitations WHERE id = ANY(v_invitation_ids);
  END IF;

  -- Mirrored phone-based candidate member invitations (normalized SG phone).
  IF v_phone IS NOT NULL THEN
    v_phone_digits := regexp_replace(v_phone, '\D', '', 'g');
    v_normalized_phone := CASE
      WHEN length(v_phone_digits) = 8 THEN '65' || v_phone_digits
      ELSE v_phone_digits
    END;

    DELETE FROM public.member_invitations mi
    WHERE mi.intended_role = 'candidate'
      AND (
        CASE
          WHEN length(regexp_replace(mi.phone, '\D', '', 'g')) = 8
            THEN '65' || regexp_replace(mi.phone, '\D', '', 'g')
          ELSE regexp_replace(mi.phone, '\D', '', 'g')
        END
      ) = v_normalized_phone;
  END IF;

  DELETE FROM public.candidates WHERE id = p_candidate_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Candidate delete returned zero rows' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_candidate_cascade(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_candidate_cascade(uuid) TO service_role;

-- ── Widen the progress-signal UPDATE trigger to include archive columns ──────
-- Reproduces the existing trigger's WHEN clause verbatim (verified 2026-05-22)
-- plus archived_at / archived_by_id, so mobile candidate lists refresh on
-- archive / unarchive via the progress_signals Realtime channel.

DROP TRIGGER IF EXISTS trg_candidates_progress_signal_upd ON public.candidates;

CREATE TRIGGER trg_candidates_progress_signal_upd
  AFTER UPDATE ON public.candidates
  FOR EACH ROW
  WHEN (
    OLD.status IS DISTINCT FROM NEW.status OR
    OLD.assigned_manager_id IS DISTINCT FROM NEW.assigned_manager_id OR
    OLD.stage_before_hold IS DISTINCT FROM NEW.stage_before_hold OR
    OLD.rejected_at IS DISTINCT FROM NEW.rejected_at OR
    OLD.rejected_reason IS DISTINCT FROM NEW.rejected_reason OR
    OLD.rejected_by_user_id IS DISTINCT FROM NEW.rejected_by_user_id OR
    OLD.converted_to_agent_at IS DISTINCT FROM NEW.converted_to_agent_at OR
    OLD.current_stage_id IS DISTINCT FROM NEW.current_stage_id OR
    OLD.stage_entered_at IS DISTINCT FROM NEW.stage_entered_at OR
    OLD.job_id IS DISTINCT FROM NEW.job_id OR
    OLD.name IS DISTINCT FROM NEW.name OR
    OLD.phone IS DISTINCT FROM NEW.phone OR
    OLD.email IS DISTINCT FROM NEW.email OR
    OLD.notes IS DISTINCT FROM NEW.notes OR
    OLD.resume_url IS DISTINCT FROM NEW.resume_url OR
    OLD.invite_token IS DISTINCT FROM NEW.invite_token OR
    OLD.archived_at IS DISTINCT FROM NEW.archived_at OR
    OLD.archived_by_id IS DISTINCT FROM NEW.archived_by_id
  )
  EXECUTE FUNCTION public.notify_progress_change();

-- ── Documentation ────────────────────────────────────────────────────────────

COMMENT ON FUNCTION public.set_candidate_archived(uuid, boolean) IS
  'Archives/unarchives a candidate for mobile staff. SECURITY DEFINER with caller role (admin/director/manager/pa/ro) and candidate-access checks. Mirrors archive state onto linked invitations.';

COMMENT ON FUNCTION public.delete_candidate_cascade(uuid) IS
  'Service-role-only transactional hard delete of a candidate and every dependent row. Called by the delete-candidate edge function, which enforces caller auth/eligibility and handles storage + auth-user cleanup.';
