-- Allow non-admin users to set their own onboarding_complete from false to true.
-- The guard_user_self_update trigger (M-5 in 20260314200000) pins
-- onboarding_complete for all self-updates, which blocks the onboarding
-- completion flow entirely. Fix: allow the false→true transition only.

CREATE OR REPLACE FUNCTION public.guard_user_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Only enforce when a non-admin user updates their own record
    IF OLD.id = auth.uid()
       AND COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') != 'admin'
    THEN
        NEW.role               := OLD.role;
        NEW.is_active          := OLD.is_active;
        NEW.reports_to         := OLD.reports_to;
        NEW.lifecycle_stage    := OLD.lifecycle_stage;

        -- Allow onboarding_complete to go false→true (one-way latch),
        -- but prevent resetting it back to false.
        IF OLD.onboarding_complete = true THEN
            NEW.onboarding_complete := true;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;
