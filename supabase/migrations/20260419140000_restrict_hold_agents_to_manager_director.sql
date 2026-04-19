-- Enforce the business rule that only manager and director roles can hold
-- downlines: no admin, PA, agent, or candidate may be an upline on either
-- users.reports_to (the agent-manager link) or candidates.assigned_manager_id
-- (the candidate-manager link).
--
-- The app layer already rejects this (see PR1 edits in lib/recruitment,
-- create-candidate/create-member-invitation edge functions, and the lyfe-sg
-- server actions). This migration adds a defense-in-depth DB-level check so
-- direct SQL, future code paths, or admin-bypass-RLS writes cannot violate
-- the invariant.
--
-- Semantics:
--   * Triggers fire BEFORE INSERT or BEFORE UPDATE OF the relevant column,
--     so existing rows are grandfathered in (not re-validated on unrelated
--     updates). Any future write to these columns is validated.
--   * A NULL reports_to or NULL assigned_manager_id is always allowed
--     (candidates may be unassigned; staff may have no upline).
--   * Both triggers run SECURITY DEFINER so the role lookup can read the
--     target user regardless of RLS visibility from the invoking role.

-- ── Trigger function: validate users.reports_to holder role ───────────────
CREATE OR REPLACE FUNCTION public.validate_reports_to_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
    holder_role text;
    holder_active boolean;
BEGIN
    IF NEW.reports_to IS NULL THEN
        RETURN NEW;
    END IF;

    IF NEW.reports_to = NEW.id THEN
        RAISE EXCEPTION 'A user cannot report to themselves (reports_to = id)';
    END IF;

    SELECT role, is_active INTO holder_role, holder_active
    FROM public.users
    WHERE id = NEW.reports_to;

    IF holder_role IS NULL THEN
        RAISE EXCEPTION 'reports_to target % does not exist', NEW.reports_to;
    END IF;

    IF holder_active IS FALSE THEN
        RAISE EXCEPTION 'reports_to target % is inactive', NEW.reports_to;
    END IF;

    IF holder_role NOT IN ('manager', 'director') THEN
        RAISE EXCEPTION 'reports_to target must be a manager or director (got %)', holder_role;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_reports_to_role ON public.users;
CREATE TRIGGER trg_validate_reports_to_role
    BEFORE INSERT OR UPDATE OF reports_to ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_reports_to_role();

-- ── Trigger function: validate candidates.assigned_manager_id holder role ──
CREATE OR REPLACE FUNCTION public.validate_candidate_manager_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
    holder_role text;
    holder_active boolean;
BEGIN
    IF NEW.assigned_manager_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT role, is_active INTO holder_role, holder_active
    FROM public.users
    WHERE id = NEW.assigned_manager_id;

    IF holder_role IS NULL THEN
        RAISE EXCEPTION 'assigned_manager_id % does not exist', NEW.assigned_manager_id;
    END IF;

    IF holder_active IS FALSE THEN
        RAISE EXCEPTION 'assigned_manager_id % is inactive', NEW.assigned_manager_id;
    END IF;

    IF holder_role NOT IN ('manager', 'director') THEN
        RAISE EXCEPTION 'candidates.assigned_manager_id must be a manager or director (got %)', holder_role;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_candidate_manager_role ON public.candidates;
CREATE TRIGGER trg_validate_candidate_manager_role
    BEFORE INSERT OR UPDATE OF assigned_manager_id ON public.candidates
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_candidate_manager_role();

-- ── Audit queries (not executed here — run manually to surface drift) ─────
-- Find users currently held by an illegal upline (pre-migration data):
--   SELECT u.id, u.full_name, u.role, u.reports_to, h.role AS holder_role
--   FROM users u JOIN users h ON h.id = u.reports_to
--   WHERE h.role NOT IN ('manager', 'director');
--
-- Find candidates currently assigned to an illegal manager:
--   SELECT c.id, c.name, c.assigned_manager_id, h.role AS holder_role
--   FROM candidates c JOIN users h ON h.id = c.assigned_manager_id
--   WHERE h.role NOT IN ('manager', 'director');
--
-- Known gap not addressed here: demoting a user from manager/director to
-- agent/pa does not re-validate their existing downlines. If that becomes
-- a concern, add a trigger on users.role that checks for outstanding
-- reports_to / assigned_manager_id references before allowing the demotion.
