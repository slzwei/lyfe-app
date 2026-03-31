-- ============================================================================
-- Unified Invitation System
-- Adds member_invitations table for gating all role signups,
-- email_otp_codes for candidate email verification,
-- email_verified column on users, and updates handle_new_user trigger.
-- ============================================================================

-- ── 1. member_invitations table ─────────────────────────────────────────────

CREATE TABLE public.member_invitations (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  phone               text        NOT NULL,
  full_name           text        NOT NULL,
  intended_role       user_role   NOT NULL,
  status              text        NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  invited_by_id       uuid        NOT NULL REFERENCES public.users(id),
  assigned_manager_id uuid        REFERENCES public.users(id),
  notes               text,
  accepted_by_id      uuid        REFERENCES public.users(id),
  accepted_at         timestamptz,
  expires_at          timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.member_invitations IS 'Phone-based invitations for all roles. Gates mobile app signup.';

-- Only one pending invitation per phone number
CREATE UNIQUE INDEX idx_member_inv_phone_pending
  ON public.member_invitations(phone) WHERE status = 'pending';

CREATE INDEX idx_member_inv_invited_by
  ON public.member_invitations(invited_by_id);

CREATE INDEX idx_member_inv_status
  ON public.member_invitations(status);

ALTER TABLE public.member_invitations ENABLE ROW LEVEL SECURITY;

-- Staff can read invitations they created; admin can read all
CREATE POLICY member_invitations_select ON public.member_invitations
  FOR SELECT USING (
    invited_by_id = auth.uid()
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- Inserts handled via service-role in edge functions (no client INSERT policy)

-- ── 2. email_otp_codes table ────────────────────────────────────────────────

CREATE TABLE public.email_otp_codes (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email       text        NOT NULL,
  code_hash   text        NOT NULL,
  expires_at  timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.email_otp_codes IS 'OTP codes for candidate email verification. Accessed via edge functions only.';

CREATE INDEX idx_email_otp_user
  ON public.email_otp_codes(user_id, created_at DESC);

ALTER TABLE public.email_otp_codes ENABLE ROW LEVEL SECURITY;
-- No RLS policies: accessed exclusively via service-role in edge functions

-- ── 3. Add email_verified to users ──────────────────────────────────────────

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email_verified boolean DEFAULT false;

-- Backfill: all existing users are grandfathered in (skip email verification)
UPDATE public.users SET email_verified = true WHERE email_verified IS NOT true;

-- ── 4. Update handle_new_user trigger ───────────────────────────────────────
--
-- New logic:
--   1. Check member_invitations for a pending, non-expired match by phone
--      → If found: use the invitation's role + name, mark accepted
--   2. Otherwise: fall through to default 'candidate' role (preserves lyfe-sg flow)
--   3. ON CONFLICT: existing users just get last_login_at updated (unchanged)
--
-- The app layer (AuthContext) separately checks whether the user has a valid
-- invitation and rejects uninvited users. The trigger remains permissive.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv   RECORD;
  v_role  user_role := 'candidate';
  v_name  text;
  v_manager_id uuid;
BEGIN
  -- 1. Check member_invitations for matching phone (pending + not expired)
  --    Normalize: auth.users stores phone without '+', member_invitations stores with '+'
  SELECT * INTO v_inv
  FROM public.member_invitations
  WHERE (phone = NEW.phone OR phone = '+' || NEW.phone OR '+' || phone = '+' || NEW.phone)
    AND status = 'pending'
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF FOUND THEN
    v_role       := v_inv.intended_role;
    v_name       := v_inv.full_name;
    v_manager_id := v_inv.assigned_manager_id;

    -- Mark invitation as accepted
    UPDATE public.member_invitations
    SET status         = 'accepted',
        accepted_by_id = NEW.id,
        accepted_at    = now()
    WHERE id = v_inv.id;
  ELSE
    -- 2. No member_invitation match — default candidate (preserves lyfe-sg flow)
    v_name := COALESCE(NEW.raw_user_meta_data ->> 'full_name', 'New User');
  END IF;

  -- 3. Upsert into public.users
  INSERT INTO public.users (id, phone, full_name, role, reports_to)
  VALUES (
    NEW.id,
    NEW.phone,
    v_name,
    v_role,
    v_manager_id
  )
  ON CONFLICT (id) DO UPDATE SET
    last_login_at = now(),
    phone         = COALESCE(EXCLUDED.phone, users.phone);

  RETURN NEW;
END;
$$;
