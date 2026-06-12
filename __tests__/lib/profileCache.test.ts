import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveCachedProfile, loadCachedProfile, clearCachedProfile } from '@/lib/profileCache';
import type { User } from '@/types/database';

const mockGetItem = AsyncStorage.getItem as jest.Mock;
const mockSetItem = AsyncStorage.setItem as jest.Mock;
const mockRemoveItem = AsyncStorage.removeItem as jest.Mock;

const KEY = 'lyfe_profile_cache_v1';

const PROFILE = { id: 'user-1', full_name: 'Cached User', role: 'agent' } as unknown as User;

describe('profileCache', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockGetItem.mockResolvedValue(null);
        mockSetItem.mockResolvedValue(undefined);
        mockRemoveItem.mockResolvedValue(undefined);
    });

    it('saves the profile keyed by user with the gate-passing status', async () => {
        await saveCachedProfile(PROFILE, 'skipped');

        expect(mockSetItem).toHaveBeenCalledWith(KEY, expect.any(String));
        const stored = JSON.parse(mockSetItem.mock.calls[0][1]);
        expect(stored.userId).toBe('user-1');
        expect(stored.profile.full_name).toBe('Cached User');
        expect(stored.invitationStatus).toBe('skipped');
        expect(stored.cachedAt).toBeTruthy();
    });

    it('round-trips through load', async () => {
        await saveCachedProfile(PROFILE, 'valid');
        mockGetItem.mockResolvedValue(mockSetItem.mock.calls[0][1]);

        const entry = await loadCachedProfile('user-1');
        expect(entry?.profile.full_name).toBe('Cached User');
        expect(entry?.invitationStatus).toBe('valid');
    });

    it("never serves another user's cache when an expected id is given", async () => {
        await saveCachedProfile(PROFILE, 'valid');
        mockGetItem.mockResolvedValue(mockSetItem.mock.calls[0][1]);

        expect(await loadCachedProfile('user-2')).toBeNull();
        // Without an expected id (offline cold start), the device's last
        // signed-in user is served.
        expect((await loadCachedProfile())?.userId).toBe('user-1');
    });

    it('returns null for corrupt or tampered entries', async () => {
        mockGetItem.mockResolvedValue('not-json{');
        expect(await loadCachedProfile('user-1')).toBeNull();

        // A tampered status outside valid/skipped must not pass the gate
        mockGetItem.mockResolvedValue(
            JSON.stringify({ userId: 'user-1', profile: PROFILE, invitationStatus: 'rejected', cachedAt: 'x' }),
        );
        expect(await loadCachedProfile('user-1')).toBeNull();
    });

    it('clear removes the entry', async () => {
        await clearCachedProfile();
        expect(mockRemoveItem).toHaveBeenCalledWith(KEY);
    });

    it('is best-effort — storage failures never throw', async () => {
        mockSetItem.mockRejectedValue(new Error('disk full'));
        mockGetItem.mockRejectedValue(new Error('disk full'));
        mockRemoveItem.mockRejectedValue(new Error('disk full'));

        await expect(saveCachedProfile(PROFILE, 'valid')).resolves.toBeUndefined();
        await expect(loadCachedProfile('user-1')).resolves.toBeNull();
        await expect(clearCachedProfile()).resolves.toBeUndefined();
    });
});
