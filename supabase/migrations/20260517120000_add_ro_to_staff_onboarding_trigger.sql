-- Ensure Recruitment Officers created through member invitations skip the
-- candidate onboarding flow like other staff roles.

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
  -- Normalize phone (strip '+' to match member_invitations.phone format).
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

  IF v_role IN ('admin', 'director', 'manager', 'agent', 'pa', 'ro') THEN
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
