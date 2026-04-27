-- Null-guard the lead reassignment trigger so lead.unassigned UPDATEs work.
--
-- Surfaced by the synthetic mktr-lead-unassigned probe (see
-- docs/synthetic-monitoring-audit.md, R1c).
--
-- Bug: trigger_notify_lead_reassigned fires AFTER UPDATE on leads. When
-- MKTR's receive-mktr-lead edge function processes a lead.unassigned event
-- it runs `UPDATE leads SET assigned_to = NULL`, which fires this trigger.
-- The trigger then calls notify_insert(NEW.assigned_to, ...) — passing NULL
-- — which violates `notifications.user_id NOT NULL` and aborts the entire
-- UPDATE with a 500. Net effect: lead.unassigned has been silently broken
-- since the assigned_to column became nullable.
--
-- Fix: guard each notify_insert with a NOT NULL check. The cross-team
-- branch only fires when both OLD and NEW assigned_to are present.
--
-- Behavioural parity confirmed against staging via the synthetic probe.

CREATE OR REPLACE FUNCTION public.trigger_notify_lead_reassigned()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_old_manager_id uuid;
    v_new_manager_id uuid;
BEGIN
    IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
        -- Notify the previous owner the lead has moved away from them.
        IF OLD.assigned_to IS NOT NULL THEN
            PERFORM notify_insert(
                OLD.assigned_to,
                'lead_reassigned',
                'Lead Reassigned',
                NEW.full_name || ' has been reassigned to another agent',
                jsonb_build_object('route', '/(tabs)/leads/' || NEW.id, 'leadId', NEW.id)
            );
        END IF;

        -- Notify the new owner. Skipped on lead.unassigned (NEW is NULL).
        IF NEW.assigned_to IS NOT NULL THEN
            PERFORM notify_insert(
                NEW.assigned_to,
                'lead_reassigned',
                'Lead Assigned to You',
                NEW.full_name || ' has been assigned to you',
                jsonb_build_object('route', '/(tabs)/leads/' || NEW.id, 'leadId', NEW.id)
            );
        END IF;

        -- Cross-team alert is only meaningful when both endpoints are real
        -- agents — skip when either side is null.
        IF OLD.assigned_to IS NOT NULL AND NEW.assigned_to IS NOT NULL THEN
            SELECT reports_to INTO v_old_manager_id FROM users WHERE id = OLD.assigned_to;
            SELECT reports_to INTO v_new_manager_id FROM users WHERE id = NEW.assigned_to;

            IF v_old_manager_id IS DISTINCT FROM v_new_manager_id THEN
                INSERT INTO notifications (user_id, type, title, body, data)
                SELECT
                    u.id,
                    'lead_reassigned_global',
                    'Cross-Team Lead Reassignment',
                    NEW.full_name || ' reassigned across teams',
                    jsonb_build_object('route', '/(tabs)/leads/' || NEW.id, 'leadId', NEW.id)
                FROM users u
                WHERE u.role = 'admin';
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trigger_notify_lead_reassigned() IS
    'Fires AFTER UPDATE on leads when assigned_to changes. Guards every notify_insert against NULL endpoints so lead.unassigned (assigned_to → NULL) does not fail the parent UPDATE.';
