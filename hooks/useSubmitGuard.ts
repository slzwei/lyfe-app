import { useCallback, useState } from 'react';

/**
 * Reusable hook to prevent double-submissions on form screens.
 * Wrap your async submit handler with `guard()` — it will no-op
 * if a submission is already in flight and reset automatically
 * when the promise settles (success or error).
 */
export function useSubmitGuard() {
    const [isSubmitting, setIsSubmitting] = useState(false);

    const guard = useCallback(
        async <T>(fn: () => Promise<T>): Promise<T | undefined> => {
            if (isSubmitting) return undefined;
            setIsSubmitting(true);
            try {
                return await fn();
            } finally {
                setIsSubmitting(false);
            }
        },
        [isSubmitting],
    );

    return { isSubmitting, guard };
}
