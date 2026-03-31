
-- Phase 2A: When a candidates row is inserted, auto-create a candidate_profiles
-- row if a matching auth user exists (by phone). This bridges mobile-created
-- candidates to the lyfe-sg profile/onboarding system.
CREATE OR REPLACE FUNCTION create_candidate_profile_on_insert()
RETURNS trigger AS $$
DECLARE
  matched_user_id uuid;
BEGIN
  -- Skip if this candidate already has a linked profile
  IF EXISTS (SELECT 1 FROM candidate_profiles WHERE candidate_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  -- Try to find an auth user by phone match
  SELECT id INTO matched_user_id
  FROM auth.users
  WHERE phone = NEW.phone
  LIMIT 1;

  IF matched_user_id IS NOT NULL THEN
    -- Create profile linked to both the auth user and the candidate record
    INSERT INTO candidate_profiles (user_id, full_name, email, contact_number, candidate_id)
    VALUES (matched_user_id, NEW.name, NEW.email, NEW.phone, NEW.id)
    ON CONFLICT (user_id) DO UPDATE SET candidate_id = NEW.id
    WHERE candidate_profiles.candidate_id IS NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_candidates_create_profile
  AFTER INSERT ON candidates
  FOR EACH ROW EXECUTE FUNCTION create_candidate_profile_on_insert();
