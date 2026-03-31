
-- Phase 1A: Link orphaned candidate_profiles to new candidates records
-- 5 of 6 candidate_profiles have candidate_id = NULL
DO $$
DECLARE
  rec RECORD;
  new_cid uuid;
  admin_id uuid;
BEGIN
  -- Get a fallback admin user for assigned_manager_id / created_by_id
  SELECT id INTO admin_id FROM users WHERE role = 'admin' LIMIT 1;

  IF admin_id IS NULL THEN
    RAISE EXCEPTION 'No admin user found for fallback assignment';
  END IF;

  FOR rec IN
    SELECT cp.id, cp.user_id, cp.full_name, cp.email, cp.contact_number, cp.invitation_id
    FROM candidate_profiles cp
    WHERE cp.candidate_id IS NULL
  LOOP
    INSERT INTO candidates (name, phone, email, status, assigned_manager_id, created_by_id)
    VALUES (
      COALESCE(NULLIF(rec.full_name, ''), 'Unknown'),
      COALESCE(rec.contact_number, ''),
      rec.email,
      'applied',
      admin_id,
      admin_id
    )
    RETURNING id INTO new_cid;

    UPDATE candidate_profiles SET candidate_id = new_cid WHERE id = rec.id;

    -- Also link the invitation if present
    IF rec.invitation_id IS NOT NULL THEN
      UPDATE invitations SET candidate_record_id = new_cid
      WHERE id = rec.invitation_id AND candidate_record_id IS NULL;
    END IF;
  END LOOP;
END $$;
