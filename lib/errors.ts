/**
 * Map Supabase/Postgres error codes to user-friendly messages.
 * Keep original error in Sentry context; show friendly text to user.
 */

const ERROR_MAP: Record<string, string> = {
    // PostgREST errors
    PGRST116: 'Record not found',
    PGRST301: 'Request timed out. Please try again.',

    // Postgres constraint violations
    '23505': 'This record already exists',
    '23503': 'This record is referenced by other data and cannot be modified',
    '23514': 'The value provided is out of the allowed range',

    // Auth / permissions
    '42501': 'You do not have permission to perform this action',
    '42P01': 'Something went wrong. Please try again.',

    // Network / generic
    PGRST000: 'Unable to connect to the server. Check your internet connection.',
};

/**
 * Convert a Supabase error message to a user-friendly string.
 * Returns the friendly message if matched, otherwise a generic fallback.
 */
export function friendlyError(errorMessage: string, code?: string): string {
    if (code && ERROR_MAP[code]) {
        return ERROR_MAP[code];
    }

    // Try to extract a Postgres error code from the message
    for (const [key, friendly] of Object.entries(ERROR_MAP)) {
        if (errorMessage.includes(key)) {
            return friendly;
        }
    }

    // Common message patterns
    if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
        return 'Unable to connect to the server. Check your internet connection.';
    }
    if (errorMessage.includes('JWT expired') || errorMessage.includes('token is expired')) {
        return 'Your session has expired. Please sign in again.';
    }
    if (errorMessage.includes('duplicate key')) {
        return 'This record already exists';
    }
    if (errorMessage.includes('violates row-level security')) {
        return 'You do not have permission to perform this action';
    }

    return 'Something went wrong. Please try again.';
}
