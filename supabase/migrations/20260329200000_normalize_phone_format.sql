-- Enforce phone format: strip '+' prefix at the database level
-- This guarantees consistency regardless of what the app sends

-- 1. Trigger to strip '+' on member_invitations INSERT/UPDATE
CREATE OR REPLACE FUNCTION public.normalize_phone()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.phone IS NOT NULL AND NEW.phone LIKE '+%' THEN
    NEW.phone := substr(NEW.phone, 2);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_normalize_phone_member_inv
  BEFORE INSERT OR UPDATE OF phone ON public.member_invitations
  FOR EACH ROW EXECUTE FUNCTION public.normalize_phone();

-- 2. Same for users table
CREATE TRIGGER trg_normalize_phone_users
  BEFORE INSERT OR UPDATE OF phone ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.normalize_phone();

-- 3. Same for candidates table
CREATE TRIGGER trg_normalize_phone_candidates
  BEFORE INSERT OR UPDATE OF phone ON public.candidates
  FOR EACH ROW EXECUTE FUNCTION public.normalize_phone();

-- 4. Same for leads table
CREATE TRIGGER trg_normalize_phone_leads
  BEFORE INSERT OR UPDATE OF phone ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.normalize_phone();

-- 5. Simplify handle_new_user — no more OR conditions needed
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
  LIMIT 1;

  IF NOT FOUND THEN
    v_name := COALESCE(NEW.raw_user_meta_data ->> 'full_name', 'New User');
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
