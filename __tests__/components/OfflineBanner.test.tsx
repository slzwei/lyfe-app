import React from 'react';
import { render, act } from '@testing-library/react-native';
import { NetworkContext, type NetworkContextType } from '@/contexts/NetworkContext';

jest.mock('@/lib/supabase', () => require('@/lib/__mocks__/supabase'));

jest.mock('@/contexts/ThemeContext', () => ({
    useTheme: () => ({
        colors: require('@/constants/Colors').Colors.light,
        isDark: false,
        mode: 'light',
        resolved: 'light',
        setMode: jest.fn(),
    }),
}));

// Mock reanimated — Animated.View must render children
jest.mock('react-native-reanimated', () => {
    const { View } = require('react-native');
    return {
        __esModule: true,
        default: { View },
        View,
        SlideInUp: { duration: () => undefined },
        SlideOutUp: { duration: () => undefined },
        createAnimatedComponent: (component: any) => component,
    };
});

// Must import after mock setup
import OfflineBanner from '@/components/OfflineBanner';

function renderWithProviders(contextValue: NetworkContextType) {
    return render(
        <NetworkContext.Provider value={contextValue}>
            <OfflineBanner />
        </NetworkContext.Provider>,
    );
}

const defaultContext: NetworkContextType = {
    isConnected: true,
    isInternetReachable: true,
    syncStatus: { pending: 0, lastSyncAt: null },
    triggerSync: jest.fn(),
};

describe('OfflineBanner', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('is hidden when online with no pending items', () => {
        const { queryByText } = renderWithProviders(defaultContext);
        expect(queryByText(/offline/i)).toBeNull();
        expect(queryByText(/syncing/i)).toBeNull();
    });

    it('shows offline message when disconnected', () => {
        const { getByText } = renderWithProviders({
            ...defaultContext,
            isConnected: false,
        });
        expect(getByText(/You're offline/)).toBeTruthy();
    });

    it('shows syncing state when online with pending items', () => {
        const { getByText } = renderWithProviders({
            ...defaultContext,
            isConnected: true,
            syncStatus: { pending: 3, lastSyncAt: null },
        });
        expect(getByText(/Syncing 3 changes/)).toBeTruthy();
    });

    it('shows singular "change" for 1 pending item', () => {
        const { getByText } = renderWithProviders({
            ...defaultContext,
            isConnected: true,
            syncStatus: { pending: 1, lastSyncAt: null },
        });
        expect(getByText('Syncing 1 change...')).toBeTruthy();
    });

    it('shows "All changes synced" briefly after sync completes', () => {
        const { getByText, rerender, queryByText } = renderWithProviders({
            ...defaultContext,
            isConnected: true,
            syncStatus: { pending: 1, lastSyncAt: null },
        });

        // Sync completes
        rerender(
            <NetworkContext.Provider
                value={{
                    ...defaultContext,
                    isConnected: true,
                    syncStatus: { pending: 0, lastSyncAt: new Date().toISOString() },
                }}
            >
                <OfflineBanner />
            </NetworkContext.Provider>,
        );

        expect(getByText('All changes synced')).toBeTruthy();

        // After timeout, banner should hide
        act(() => {
            jest.advanceTimersByTime(2500);
        });

        expect(queryByText('All changes synced')).toBeNull();
    });
});
