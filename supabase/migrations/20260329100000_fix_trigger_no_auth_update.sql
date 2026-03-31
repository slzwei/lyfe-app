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
  SELECT * INTO v_inv
  FROM public.member_invitations
  WHERE (phone = NEW.phone OR phone = '+' || NEW.phone)
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
