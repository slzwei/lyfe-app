import { friendlyError } from '@/lib/errors';

describe('friendlyError', () => {
    it('maps known error codes directly', () => {
        expect(friendlyError('some message', 'PGRST116')).toBe('Record not found');
        expect(friendlyError('some message', 'PGRST301')).toBe('Request timed out. Please try again.');
        expect(friendlyError('some message', '23505')).toBe('This record already exists');
        expect(friendlyError('some message', '23503')).toBe(
            'This record is referenced by other data and cannot be modified',
        );
        expect(friendlyError('some message', '23514')).toBe('The value provided is out of the allowed range');
        expect(friendlyError('some message', '42501')).toBe('You do not have permission to perform this action');
        expect(friendlyError('some message', 'PGRST000')).toBe(
            'Unable to connect to the server. Check your internet connection.',
        );
    });

    it('extracts error codes from message body when code not provided', () => {
        expect(friendlyError('Error PGRST116: not found')).toBe('Record not found');
        expect(friendlyError('constraint 23505 violated')).toBe('This record already exists');
    });

    it('matches network error patterns', () => {
        expect(friendlyError('Failed to fetch')).toBe(
            'Unable to connect to the server. Check your internet connection.',
        );
        expect(friendlyError('NetworkError when trying to fetch')).toBe(
            'Unable to connect to the server. Check your internet connection.',
        );
    });

    it('matches JWT expiry patterns', () => {
        expect(friendlyError('JWT expired')).toBe('Your session has expired. Please sign in again.');
        expect(friendlyError('token is expired or invalid')).toBe('Your session has expired. Please sign in again.');
    });

    it('matches duplicate key pattern', () => {
        expect(friendlyError('duplicate key value violates unique constraint')).toBe('This record already exists');
    });

    it('matches RLS violation pattern', () => {
        expect(friendlyError('new row violates row-level security policy')).toBe(
            'You do not have permission to perform this action',
        );
    });

    it('returns generic fallback for unknown errors', () => {
        expect(friendlyError('something completely unknown')).toBe('Something went wrong. Please try again.');
    });

    it('prefers code match over message pattern', () => {
        // If code is provided and matches, use code's message even if message also matches
        expect(friendlyError('Failed to fetch', '23505')).toBe('This record already exists');
    });
});
