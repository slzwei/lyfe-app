-- Third internship outcome: staff can blacklist a candidate from the ATS.
-- Additive enum extension — existing 'joined_internship' / 'dropped_out'
-- values and NULL semantics are unchanged.
ALTER TYPE public.internship_status ADD VALUE 'blacklisted';
