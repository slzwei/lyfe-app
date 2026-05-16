import { renderHook, waitFor } from '@testing-library/react-native';
import * as Updates from 'expo-updates';
import { AppState, type AppStateStatus } from 'react-native';

import { useOtaUpdates } from '@/hooks/useOtaUpdates';
import { captureError } from '@/lib/sentry';

jest.mock('expo-updates', () => ({
    isEnabled: true,
    checkForUpdateAsync: jest.fn(),
    fetchUpdateAsync: jest.fn(),
}));

jest.mock('@/lib/sentry', () => ({
    captureError: jest.fn(),
}));

describe('useOtaUpdates', () => {
    const originalDev = (global as any).__DEV__;
    const remove = jest.fn();
    let appStateHandler: ((status: AppStateStatus) => void) | undefined;

    beforeEach(() => {
        jest.clearAllMocks();
        appStateHandler = undefined;
        Object.defineProperty(global, '__DEV__', { value: false, configurable: true });
        jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, handler) => {
            appStateHandler = handler;
            return { remove } as any;
        });
        (Updates.checkForUpdateAsync as jest.Mock).mockResolvedValue({ isAvailable: false });
        (Updates.fetchUpdateAsync as jest.Mock).mockResolvedValue({});
    });

    afterEach(() => {
        jest.restoreAllMocks();
        Object.defineProperty(global, '__DEV__', { value: originalDev, configurable: true });
    });

    it('checks on mount and fetches available updates', async () => {
        (Updates.checkForUpdateAsync as jest.Mock).mockResolvedValueOnce({ isAvailable: true });

        renderHook(() => useOtaUpdates());

        await waitFor(() => expect(Updates.fetchUpdateAsync).toHaveBeenCalledTimes(1));
        expect(AppState.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    });

    it('checks again when the app returns active and removes the listener', async () => {
        const { unmount } = renderHook(() => useOtaUpdates());

        await waitFor(() => expect(Updates.checkForUpdateAsync).toHaveBeenCalledTimes(1));
        appStateHandler?.('background');
        expect(Updates.checkForUpdateAsync).toHaveBeenCalledTimes(1);

        appStateHandler?.('active');
        await waitFor(() => expect(Updates.checkForUpdateAsync).toHaveBeenCalledTimes(2));

        unmount();
        expect(remove).toHaveBeenCalled();
    });

    it('captures update check failures without throwing', async () => {
        const error = new Error('update service unavailable');
        (Updates.checkForUpdateAsync as jest.Mock).mockRejectedValueOnce(error);

        renderHook(() => useOtaUpdates());

        await waitFor(() => expect(captureError).toHaveBeenCalledWith(error, { fn: 'useOtaUpdates.checkAndFetch' }));
    });
});
