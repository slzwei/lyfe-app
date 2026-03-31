CREATE OR REPLACE FUNCTION public.debug_invitation_match(p_phone text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv RECORD;
  v_count int;
BEGIN
  -- Count all invitations for this phone
  SELECT count(*) INTO v_count
  FROM public.member_invitations
  WHERE phone = p_phone;

  -- Try the exact same query as the trigger
  SELECT * INTO v_inv
  FROM public.member_invitations
  WHERE (phone = p_phone OR phone = '+' || p_phone OR '+' || phone = '+' || p_phone)
    AND status = 'pending'
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  RETURN json_build_object(
    'input_phone', p_phone,
    'total_for_phone', v_count,
    'match_found', v_inv IS NOT NULL,
    'match_id', v_inv.id,
    'match_role', v_inv.intended_role,
    'match_status', v_inv.status
  );
END;
$$;
