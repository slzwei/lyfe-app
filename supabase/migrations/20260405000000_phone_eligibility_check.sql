-- Pre-OTP phone eligibility check
--
-- Prevents uninvited phones from receiving OTP, which would create
-- orphaned auth.users + public.users rows that immediately get rejected.
--
-- Two components:
--   1. normalize_sg_phone() — shared phone normalization (SG +65 only)
--   2. check_phone_eligible() — returns eligibility status for login screen

-- ── 1. Shared phone normalization ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.normalize_sg_phone(raw_phone text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  digits text;
BEGIN
  -- Strip everything except digits and leading +
  digits := regexp_replace(raw_phone, '[^0-9+]', '', 'g');

  -- +65XXXXXXXX → 65XXXXXXXX
  IF digits ~ '^\+65[89]\d{7}$' THEN
    RETURN substring(digits, 2);
  END IF;

  -- 8-digit SG number → prepend 65
  IF digits ~ '^[89]\d{7}$' THEN
    RETURN '65' || digits;
  END IF;

  -- Already 65XXXXXXXX
  IF digits ~ '^65[89]\d{7}$' THEN
    RETURN digits;
  END IF;

  -- Invalid
  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.normalize_sg_phone IS
  'Normalize SG phone to 65XXXXXXXX format (no + prefix). Returns NULL if invalid.';


-- ── 2. Phone eligibility check ─────────────────────────────────────────────
--
-- Called from login screen BEFORE sending OTP.
-- Returns: { eligible: bool, reason: text }
--
-- Eligible if:
--   a) Phone exists in public.users (returning user), OR
--   b) Phone has a pending, non-expired member_invitations row (new invite)
--
-- SECURITY DEFINER so it can read users + member_invitations without a JWT.
-- Callable with anon key (user is not authenticated yet at login screen).

CREATE OR REPLACE FUNCTION public.check_phone_eligible(phone_input text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone text;
  v_user_id uuid;
  v_user_created_at timestamptz;
  v_invite_exists boolean;
  v_invite_expired boolean;
  v_has_accepted_invite boolean;
  v_has_legacy_invite boolean;
  -- Must match INVITATION_SYSTEM_CUTOFF in AuthContext.tsx
  CUTOFF constant timestamptz := '2026-03-29T00:00:00Z';
BEGIN
  -- Normalize input
  v_phone := normalize_sg_phone(phone_input);
  IF v_phone IS NULL THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'invalid_phone');
  END IF;

  -- Check 1: existing active user with this phone
  SELECT id, created_at INTO v_user_id, v_user_created_at
  FROM public.users
  WHERE phone = v_phone AND is_active = true
  LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    -- Grandfathered: created before invitation system went live
    IF v_user_created_at < CUTOFF THEN
      RETURN jsonb_build_object('eligible', true, 'reason', 'existing_user');
    END IF;

    -- Post-cutoff user: must have an accepted invitation
    SELECT EXISTS(
      SELECT 1 FROM public.member_invitations
      WHERE accepted_by_id = v_user_id AND status = 'accepted'
    ) INTO v_has_accepted_invite;

    IF v_has_accepted_invite THEN
      RETURN jsonb_build_object('eligible', true, 'reason', 'existing_user');
    END IF;

    -- Check legacy invitations table (lyfe-sg candidate flow)
    SELECT EXISTS(
      SELECT 1 FROM public.invitations WHERE user_id = v_user_id
    ) INTO v_has_legacy_invite;

    IF v_has_legacy_invite THEN
      RETURN jsonb_build_object('eligible', true, 'reason', 'existing_user');
    END IF;

    -- Post-cutoff user with no invitation → not eligible
    RETURN jsonb_build_object('eligible', false, 'reason', 'not_found');
  END IF;

  -- Check 2: pending, non-expired invitation (new user who hasn't signed up yet)
  SELECT EXISTS(
    SELECT 1 FROM public.member_invitations
    WHERE phone = v_phone AND status = 'pending' AND expires_at > now()
  ) INTO v_invite_exists;

  IF v_invite_exists THEN
    RETURN jsonb_build_object('eligible', true, 'reason', 'pending_invitation');
  END IF;

  -- Check 3: expired invitation (specific error message)
  SELECT EXISTS(
    SELECT 1 FROM public.member_invitations
    WHERE phone = v_phone AND status = 'pending' AND expires_at <= now()
  ) INTO v_invite_expired;

  IF v_invite_expired THEN
    RETURN jsonb_build_object('eligible', false, 'reason', 'invitation_expired');
  END IF;

  -- No user and no invitation
  RETURN jsonb_build_object('eligible', false, 'reason', 'not_found');
END;
$$;

COMMENT ON FUNCTION public.check_phone_eligible IS
  'Pre-OTP eligibility check. Returns {eligible, reason}. Called before sending SMS.';

-- Grant execute to anon role (called from login screen before auth)
GRANT EXECUTE ON FUNCTION public.check_phone_eligible(text) TO anon;
GRANT EXECUTE ON FUNCTION public.check_phone_eligible(text) TO authenticated;
