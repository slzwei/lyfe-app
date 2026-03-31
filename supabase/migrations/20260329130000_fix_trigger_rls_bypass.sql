CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_role  user_role := 'candidate';
  v_name  text;
  v_manager_id uuid;
  v_inv_id uuid;
BEGIN
  -- 1. Check member_invitations for matching phone
  SELECT id, intended_role, full_name, assigned_manager_id
  INTO v_inv_id, v_role, v_name, v_manager_id
  FROM public.member_invitations
  WHERE (phone = NEW.phone OR phone = '+' || NEW.phone)
    AND status = 'pending'
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    UPDATE public.member_invitations
    SET status         = 'accepted',
        accepted_by_id = NEW.id,
        accepted_at    = now()
    WHERE id = v_inv_id;
  ELSE
    v_name := COALESCE(NEW.raw_user_meta_data ->> 'full_name', 'New User');
  END IF;

  -- 2. Upsert into public.users
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
