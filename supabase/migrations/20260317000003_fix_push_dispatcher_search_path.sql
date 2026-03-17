-- Fix notify_push_dispatcher — add SET search_path = public
-- SECURITY DEFINER functions without explicit search_path are vulnerable
-- to search_path manipulation attacks.

CREATE OR REPLACE FUNCTION public.notify_push_dispatcher()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    PERFORM net.http_post(
        url := 'https://nvtedkyjwulkzjeoqjgx.supabase.co/functions/v1/send-push-notification',
        body := jsonb_build_object(
            'record', jsonb_build_object(
                'id', NEW.id,
                'user_id', NEW.user_id,
                'type', NEW.type,
                'title', NEW.title,
                'body', NEW.body,
                'data', NEW.data
            )
        ),
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true)
        )
    );
    RETURN NEW;
END;
$$;
