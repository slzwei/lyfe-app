import { sendEmailOtp, verifyEmailOtp } from '@/lib/email-verification';

jest.mock('@/lib/supabase');
const mockSupabase = require('@/lib/supabase').supabase;

beforeEach(() => {
    mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: { access_token: 'test-token' } },
    });
});

describe('sendEmailOtp', () => {
    it('returns null error on success', async () => {
        mockSupabase.functions.invoke.mockResolvedValue({ data: {}, error: null });

        const result = await sendEmailOtp('test@example.com');
        expect(result.error).toBeNull();
        expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('send-email-otp', {
            body: { email: 'test@example.com' },
        });
    });

    it('returns error when not authenticated', async () => {
        mockSupabase.auth.getSession.mockResolvedValue({ data: { session: null } });

        const result = await sendEmailOtp('test@example.com');
        expect(result.error).toBe('Not authenticated');
    });

    it('returns error from edge function failure', async () => {
        mockSupabase.functions.invoke.mockResolvedValue({
            data: null,
            error: { message: 'Function error' },
        });

        const result = await sendEmailOtp('test@example.com');
        expect(result.error).toBe('Function error');
    });

    it('returns error from response body', async () => {
        mockSupabase.functions.invoke.mockResolvedValue({
            data: { error: 'Rate limited' },
            error: null,
        });

        const result = await sendEmailOtp('test@example.com');
        expect(result.error).toBe('Rate limited');
    });
});

describe('verifyEmailOtp', () => {
    it('returns null error on success', async () => {
        mockSupabase.functions.invoke.mockResolvedValue({ data: {}, error: null });

        const result = await verifyEmailOtp('test@example.com', '123456');
        expect(result.error).toBeNull();
        expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('verify-email-otp', {
            body: { email: 'test@example.com', code: '123456' },
        });
    });

    it('returns error when not authenticated', async () => {
        mockSupabase.auth.getSession.mockResolvedValue({ data: { session: null } });

        const result = await verifyEmailOtp('test@example.com', '123456');
        expect(result.error).toBe('Not authenticated');
    });

    it('returns error from edge function failure', async () => {
        mockSupabase.functions.invoke.mockResolvedValue({
            data: null,
            error: { message: 'Verification failed' },
        });

        const result = await verifyEmailOtp('test@example.com', '123456');
        expect(result.error).toBe('Verification failed');
    });

    it('returns error from response body', async () => {
        mockSupabase.functions.invoke.mockResolvedValue({
            data: { error: 'Invalid code' },
            error: null,
        });

        const result = await verifyEmailOtp('test@example.com', '123456');
        expect(result.error).toBe('Invalid code');
    });
});
