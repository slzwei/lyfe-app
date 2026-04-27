-- Add a per-code failed-attempt counter so verify-email-otp can reject after
-- N wrong guesses. Without this, an attacker who learns one OTP-send window
-- could brute-force the 6-digit space (~1M combinations) at 3 verifies/sec
-- inside the 10-minute window.
--
-- Strategy: store the counter on the code row itself, increment on every
-- failed timing-safe compare, reject once it crosses MAX_ATTEMPTS (5). On
-- success the verify path deletes all of the user's codes anyway, so we
-- don't need a separate "locked until" timestamp.

ALTER TABLE public.email_otp_codes
    ADD COLUMN IF NOT EXISTS failed_attempts integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.email_otp_codes.failed_attempts IS
    'Incremented by verify-email-otp on each wrong code submission. Ceiling enforced in the edge function (current MAX_ATTEMPTS=5).';
