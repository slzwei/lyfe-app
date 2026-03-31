-- Drop debug functions left from trigger debugging session
DROP FUNCTION IF EXISTS public.debug_trigger_source();
DROP FUNCTION IF EXISTS public.debug_invitation_match(text);

-- Fix C-6: Add COALESCE fallback for v_name in handle_new_user
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
BEGIN
  SELECT id, intended_role, full_name, assigned_manager_id
  INTO v_inv_id, v_role, v_name, v_manager_id
  FROM public.member_invitations
  WHERE (phone = NEW.phone OR phone = '+' || NEW.phone)
    AND status = 'pending'
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    v_name := COALESCE(NEW.raw_user_meta_data ->> 'full_name', 'New User');
  END IF;

  -- Staff roles skip onboarding (candidate-specific)
  IF v_role IN ('admin', 'director', 'manager', 'agent', 'pa') THEN
    v_onboarding := true;
  END IF;

  INSERT INTO public.users (id, phone, full_name, role, reports_to, onboarding_complete, email_verified)
  VALUES (
    NEW.id,
    NEW.phone,
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

-- Fix I-9: Only fire sync_role_to_jwt when role actually changes
DROP TRIGGER IF EXISTS on_user_role_change ON public.users;
CREATE TRIGGER on_user_role_change
  AFTER INSERT OR UPDATE OF role ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_role_to_jwt();
