CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
