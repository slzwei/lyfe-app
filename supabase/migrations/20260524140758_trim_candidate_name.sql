-- Candidate name whitespace hygiene
--
-- Bug surfaced 2026-05-24: a candidate with name " Teo Wen Yen" (leading space)
-- was sorting to the top of the alphabetical Candidates list because ASCII
-- space (0x20) sorts before 'A' (0x41). Audit found 4 rows total with stray
-- leading or trailing whitespace, likely pasted from WhatsApp / spreadsheets:
--   " Teo Wen Yen"                  (leading)
--   "Gwen Wong Wen Ting "           (trailing)
--   "NURUL ZAHIRAH BINTE AMAN KHAN " (trailing)
--   "Shermaine Gau "                (trailing)
--
-- This migration installs a BEFORE INSERT/UPDATE trigger that auto-trims the
-- name column, then backfills the 4 dirty rows. Internal whitespace is
-- preserved — only leading/trailing characters are stripped. Empty / NULL
-- names are left untouched (the schema's NOT NULL constraint guards inserts).

-- ── 1. Trigger function ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.trim_candidate_name()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    IF NEW.name IS NOT NULL THEN
        NEW.name := trim(NEW.name);
    END IF;
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trim_candidate_name() IS
    'Strips leading/trailing whitespace from candidates.name on INSERT or UPDATE. '
    'Internal whitespace is preserved.';

-- ── 2. Attach trigger ──────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trim_candidate_name_trg ON public.candidates;

CREATE TRIGGER trim_candidate_name_trg
    BEFORE INSERT OR UPDATE OF name ON public.candidates
    FOR EACH ROW
    EXECUTE FUNCTION public.trim_candidate_name();

-- ── 3. Backfill existing dirty rows ────────────────────────────────────────
-- The trigger fires on these UPDATEs too, but trim(trim(x)) = trim(x), so the
-- double pass is a no-op.

UPDATE public.candidates
SET name = trim(name)
WHERE name <> trim(name);
