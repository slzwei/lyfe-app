CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv_id uuid;
BEGIN
  -- Minimal test: just SELECT, don't use the result
  SELECT id INTO v_inv_id
  FROM public.member_invitations
  WHERE phone = NEW.phone
  LIMIT 1;

  -- Original logic unchanged
  INSERT INTO public.users (id, phone, full_name, role)
  VALUES (
    NEW.id,
    NEW.phone,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
    'candidate'
  )
  ON CONFLICT (id) DO UPDATE SET
    last_login_at = now(),
    phone = COALESCE(EXCLUDED.phone, users.phone);
  RETURN NEW;
END;
$$;
