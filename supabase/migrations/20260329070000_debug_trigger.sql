CREATE OR REPLACE FUNCTION public.debug_trigger_source()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT prosrc FROM pg_proc WHERE proname = 'handle_new_user';
$$;
