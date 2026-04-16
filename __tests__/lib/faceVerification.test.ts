import { checkFaceRegistration, registerFace, verifyFace, MATCH_THRESHOLD } from '@/lib/faceVerification';

jest.mock('@/lib/supabase');
const mockSupabase = require('@/lib/supabase').supabase;

jest.mock('../../modules/face-detection/src', () => ({
    convertToJpeg: jest.fn().mockResolvedValue('/tmp/converted.jpg'),
}));

jest.mock('expo-file-system/next', () => ({
    File: jest.fn().mockImplementation(() => ({
        bytes: jest.fn().mockResolvedValue(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])),
    })),
}));

beforeEach(() => {
    jest.clearAllMocks();
});

// ── checkFaceRegistration ──────────────────────────────────

describe('checkFaceRegistration', () => {
    it('returns registered=true with timestamp', async () => {
        mockSupabase.functions.invoke.mockResolvedValue({
            data: { registered: true, registered_at: '2026-04-10T00:00:00Z' },
            error: null,
        });

        const result = await checkFaceRegistration();
        expect(result).toEqual({ registered: true, registeredAt: '2026-04-10T00:00:00Z' });
        expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('verify-face', {
            body: { action: 'check' },
        });
    });

    it('returns registered=false when no reference exists', async () => {
        mockSupabase.functions.invoke.mockResolvedValue({
            data: { registered: false },
            error: null,
        });

        const result = await checkFaceRegistration();
        expect(result).toEqual({ registered: false, registeredAt: null });
    });

    it('throws on invoke error', async () => {
        mockSupabase.functions.invoke.mockResolvedValue({
            data: null,
            error: { message: 'Auth required' },
        });

        await expect(checkFaceRegistration()).rejects.toThrow('Auth required');
    });

    it('throws on data-level error', async () => {
        mockSupabase.functions.invoke.mockResolvedValue({
            data: { error: 'Internal server error' },
            error: null,
        });

        await expect(checkFaceRegistration()).rejects.toThrow('Internal server error');
    });
});

// ── registerFace ───────────────────────────────────────────

describe('registerFace', () => {
    it('returns success on valid registration', async () => {
        mockSupabase.functions.invoke.mockResolvedValue({
            data: { success: true },
            error: null,
        });

        const result = await registerFace('/photos/selfie.jpg');
        expect(result).toEqual({ success: true });
        expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('verify-face', {
            body: { action: 'register', photo: expect.any(String) },
        });
    });

    it('returns quality failure with reason', async () => {
        mockSupabase.functions.invoke.mockResolvedValue({
            data: { success: false, reason: 'occluded', message: 'Face is partially covered' },
            error: null,
        });

        const result = await registerFace('/photos/selfie.jpg');
        expect(result).toEqual({
            success: false,
            reason: 'occluded',
            message: 'Face is partially covered',
        });
    });

    it('returns failure for multiple faces', async () => {
        mockSupabase.functions.invoke.mockResolvedValue({
            data: { success: false, reason: 'multiple_faces', message: 'Multiple faces detected' },
            error: null,
        });

        const result = await registerFace('/photos/group.jpg');
        expect(result).toEqual({
            success: false,
            reason: 'multiple_faces',
            message: 'Multiple faces detected',
        });
    });

    it('throws on invoke error', async () => {
        mockSupabase.functions.invoke.mockResolvedValue({
            data: null,
            error: { message: 'Timeout' },
        });

        await expect(registerFace('/photos/selfie.jpg')).rejects.toThrow('Timeout');
    });

    it('throws on data-level error', async () => {
        mockSupabase.functions.invoke.mockResolvedValue({
            data: { error: 'Storage quota exceeded' },
            error: null,
        });

        await expect(registerFace('/photos/selfie.jpg')).rejects.toThrow('Storage quota exceeded');
    });

    it('sends base64-encoded JPEG to edge function', async () => {
        mockSupabase.functions.invoke.mockResolvedValue({
            data: { success: true },
            error: null,
        });

        await registerFace('file:///tmp/photo.heic');

        const call = mockSupabase.functions.invoke.mock.calls[0];
        const photo = call[1].body.photo;
        // base64 of [0xff, 0xd8, 0xff, 0xe0] = "/9j/4A=="
        expect(photo).toBe('/9j/4A==');
    });
});

// ── verifyFace ─────────────────────────────────────────────

describe('verifyFace', () => {
    it('returns match result on success', async () => {
        mockSupabase.functions.invoke.mockResolvedValue({
            data: { match: true, similarity: 99.5, confidence: 99.9 },
            error: null,
        });

        const result = await verifyFace('/photos/live.jpg');
        expect(result).toEqual({
            match: true,
            similarity: 99.5,
            confidence: 99.9,
            reason: undefined,
            message: undefined,
        });
    });

    it('returns no-match with reason', async () => {
        mockSupabase.functions.invoke.mockResolvedValue({
            data: {
                match: false,
                similarity: 42.3,
                confidence: 99.0,
                reason: 'low_similarity',
                message: 'Face does not match reference',
            },
            error: null,
        });

        const result = await verifyFace('/photos/live.jpg');
        expect(result).toEqual({
            match: false,
            similarity: 42.3,
            confidence: 99.0,
            reason: 'low_similarity',
            message: 'Face does not match reference',
        });
    });

    it('returns quality failure reason', async () => {
        mockSupabase.functions.invoke.mockResolvedValue({
            data: {
                match: false,
                similarity: 0,
                confidence: 0,
                reason: 'blurry',
                message: 'Image is too blurry',
            },
            error: null,
        });

        const result = await verifyFace('/photos/blurry.jpg');
        expect(result.reason).toBe('blurry');
    });

    it('throws on invoke error and reads error detail from context.json()', async () => {
        mockSupabase.functions.invoke.mockResolvedValue({
            data: null,
            error: {
                message: 'Edge function error',
                context: { json: jest.fn().mockResolvedValue({ error: 'No reference photo' }) },
            },
        });

        await expect(verifyFace('/photos/live.jpg')).rejects.toThrow('No reference photo');
    });

    it('falls back to error.message when context.json() fails', async () => {
        mockSupabase.functions.invoke.mockResolvedValue({
            data: null,
            error: {
                message: 'Network error',
                context: {
                    json: jest.fn().mockRejectedValue(new Error('parse failed')),
                },
            },
        });

        await expect(verifyFace('/photos/live.jpg')).rejects.toThrow('Network error');
    });

    it('reads error detail from context._bodyBlob fallback', async () => {
        mockSupabase.functions.invoke.mockResolvedValue({
            data: null,
            error: {
                message: 'Generic error',
                context: {
                    _bodyBlob: true,
                    text: jest.fn().mockResolvedValue('Reference image expired'),
                },
            },
        });

        await expect(verifyFace('/photos/live.jpg')).rejects.toThrow('Reference image expired');
    });

    it('throws on data-level error', async () => {
        mockSupabase.functions.invoke.mockResolvedValue({
            data: { error: 'User not found' },
            error: null,
        });

        await expect(verifyFace('/photos/live.jpg')).rejects.toThrow('User not found');
    });
});

// ── Constants ──────────────────────────────────────────────

describe('MATCH_THRESHOLD', () => {
    it('is 99.0 (Rekognition percentage)', () => {
        expect(MATCH_THRESHOLD).toBe(99.0);
    });
});
