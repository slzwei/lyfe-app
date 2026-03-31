/**
 * Tests for lib/storage.ts — Avatar upload/remove service
 */
import { supabase } from '@/lib/supabase';
import { pickAndUploadAvatar, takeAndUploadAvatar, removeAvatar } from '@/lib/storage';

jest.mock('@/lib/supabase');

// Mock expo-image-picker as a lazy require
const mockImagePicker = {
    requestMediaLibraryPermissionsAsync: jest.fn(),
    requestCameraPermissionsAsync: jest.fn(),
    launchImageLibraryAsync: jest.fn(),
    launchCameraAsync: jest.fn(),
};

jest.mock('expo-image-picker', () => mockImagePicker);

const mockSupa = supabase as any;

// Mock fetch + blob + arrayBuffer for _uploadUri
const mockArrayBuffer = new ArrayBuffer(8);
const mockBlob = { size: 8 };
const mockFetchResponse = {
    blob: jest.fn().mockResolvedValue(mockBlob),
};

// Mock global Response for blob -> arrayBuffer conversion
const originalResponse = global.Response;

beforeEach(() => {
    mockSupa.__resetChains();
    jest.clearAllMocks();

    // Mock global fetch
    (global as any).fetch = jest.fn().mockResolvedValue(mockFetchResponse);

    // Mock Response constructor for blob -> ArrayBuffer
    (global as any).Response = jest.fn().mockImplementation(() => ({
        arrayBuffer: jest.fn().mockResolvedValue(mockArrayBuffer),
    }));

    // Default storage mock setup
    const mockUpload = jest.fn().mockResolvedValue({ error: null });
    const mockGetPublicUrl = jest.fn().mockReturnValue({
        data: { publicUrl: 'https://example.com/avatars/user-1/avatar.jpg' },
    });
    const mockRemove = jest.fn().mockResolvedValue({ error: null });

    mockSupa.storage = {
        from: jest.fn(() => ({
            upload: mockUpload,
            getPublicUrl: mockGetPublicUrl,
            remove: mockRemove,
        })),
    };
});

afterEach(() => {
    (global as any).Response = originalResponse;
});

// ── pickAndUploadAvatar ──

describe('pickAndUploadAvatar', () => {
    it('returns error when permission is denied', async () => {
        mockImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ status: 'denied' });

        const result = await pickAndUploadAvatar('user-1');
        expect(result.error).toBe('Permission to access photos is required.');
        expect(result.url).toBeNull();
    });

    it('returns null url and null error when user cancels', async () => {
        mockImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ status: 'granted' });
        mockImagePicker.launchImageLibraryAsync.mockResolvedValue({ canceled: true });

        const result = await pickAndUploadAvatar('user-1');
        expect(result.url).toBeNull();
        expect(result.error).toBeNull();
    });

    it('uploads selected image and returns url', async () => {
        mockImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ status: 'granted' });
        mockImagePicker.launchImageLibraryAsync.mockResolvedValue({
            canceled: false,
            assets: [{ uri: 'file:///photo.jpg' }],
        });

        // Mock the users chain for the update call
        const usersChain = mockSupa.__getChain('users');
        usersChain.__resolveWith({ error: null });

        const result = await pickAndUploadAvatar('user-1');

        expect(result.error).toBeNull();
        expect(result.url).toContain('https://example.com/avatars/user-1/avatar.jpg');
        expect(mockSupa.storage.from).toHaveBeenCalledWith('avatars');
    });

    it('returns error when upload fails', async () => {
        mockImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ status: 'granted' });
        mockImagePicker.launchImageLibraryAsync.mockResolvedValue({
            canceled: false,
            assets: [{ uri: 'file:///photo.jpg' }],
        });

        // Override storage mock to fail on upload
        mockSupa.storage.from.mockReturnValue({
            upload: jest.fn().mockResolvedValue({ error: { message: 'Upload failed' } }),
            getPublicUrl: jest.fn(),
        });

        const result = await pickAndUploadAvatar('user-1');
        expect(result.error).toBe('Upload failed');
        expect(result.url).toBeNull();
    });
});

// ── takeAndUploadAvatar ──

describe('takeAndUploadAvatar', () => {
    it('returns error when camera permission is denied', async () => {
        mockImagePicker.requestCameraPermissionsAsync.mockResolvedValue({ status: 'denied' });

        const result = await takeAndUploadAvatar('user-1');
        expect(result.error).toBe('Camera permission is required.');
        expect(result.url).toBeNull();
    });

    it('returns null url and null error when user cancels camera', async () => {
        mockImagePicker.requestCameraPermissionsAsync.mockResolvedValue({ status: 'granted' });
        mockImagePicker.launchCameraAsync.mockResolvedValue({ canceled: true });

        const result = await takeAndUploadAvatar('user-1');
        expect(result.url).toBeNull();
        expect(result.error).toBeNull();
    });

    it('uploads camera photo and returns url', async () => {
        mockImagePicker.requestCameraPermissionsAsync.mockResolvedValue({ status: 'granted' });
        mockImagePicker.launchCameraAsync.mockResolvedValue({
            canceled: false,
            assets: [{ uri: 'file:///camera.jpg' }],
        });

        const usersChain = mockSupa.__getChain('users');
        usersChain.__resolveWith({ error: null });

        const result = await takeAndUploadAvatar('user-1');

        expect(result.error).toBeNull();
        expect(result.url).toContain('https://example.com/avatars/user-1/avatar.jpg');
    });
});

// ── _uploadUri size validation ──

describe('avatar file size validation', () => {
    it('rejects images over 5 MB', async () => {
        mockImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ status: 'granted' });
        mockImagePicker.launchImageLibraryAsync.mockResolvedValue({
            canceled: false,
            assets: [{ uri: 'file:///huge.jpg' }],
        });

        // 6 MB ArrayBuffer
        const oversized = new ArrayBuffer(6 * 1024 * 1024);
        (global as any).Response = jest.fn().mockImplementation(() => ({
            arrayBuffer: jest.fn().mockResolvedValue(oversized),
        }));

        const result = await pickAndUploadAvatar('user-1');
        expect(result.error).toBe('Image must be under 5 MB.');
        expect(result.url).toBeNull();
        // Should not attempt upload
        expect(mockSupa.storage.from).not.toHaveBeenCalled();
    });

    it('accepts images at exactly 5 MB', async () => {
        mockImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ status: 'granted' });
        mockImagePicker.launchImageLibraryAsync.mockResolvedValue({
            canceled: false,
            assets: [{ uri: 'file:///photo.jpg' }],
        });

        const exact5MB = new ArrayBuffer(5 * 1024 * 1024);
        (global as any).Response = jest.fn().mockImplementation(() => ({
            arrayBuffer: jest.fn().mockResolvedValue(exact5MB),
        }));

        const usersChain = mockSupa.__getChain('users');
        usersChain.__resolveWith({ error: null });

        const result = await pickAndUploadAvatar('user-1');
        expect(result.error).toBeNull();
        expect(mockSupa.storage.from).toHaveBeenCalledWith('avatars');
    });
});

// ── removeAvatar ──

describe('removeAvatar', () => {
    it('removes avatar and clears user avatar_url', async () => {
        const usersChain = mockSupa.__getChain('users');
        usersChain.__resolveWith({ error: null });

        const result = await removeAvatar('user-1');

        expect(result.error).toBeNull();
        expect(mockSupa.storage.from).toHaveBeenCalledWith('avatars');
    });

    it('returns error when storage remove fails', async () => {
        mockSupa.storage.from.mockReturnValue({
            remove: jest.fn().mockResolvedValue({ error: { message: 'Storage error' } }),
        });

        const result = await removeAvatar('user-1');
        expect(result.error).toBe('Storage error');
    });
});
