-- RPC to sync public.users name + role into auth.users metadata
-- Called after login to ensure auth JWT has correct name and role
CREATE OR REPLACE FUNCTION public.sync_auth_metadata()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_role text;
BEGIN
  SELECT full_name, role::text INTO v_name, v_role
  FROM public.users
  WHERE id = auth.uid();

  IF v_name IS NOT NULL THEN
    UPDATE auth.users
    SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
                             || jsonb_build_object('full_name', v_name),
        raw_app_meta_data  = COALESCE(raw_app_meta_data, '{}'::jsonb)
                             || jsonb_build_object('role', v_role)
    WHERE id = auth.uid();
  END IF;
END;
$$;
