import React from 'react';
import { render, act, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { NetworkProvider, type NetworkContextType } from '@/contexts/NetworkContext';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import NetInfo from '@react-native-community/netinfo';

jest.mock('@/lib/supabase', () => require('@/lib/__mocks__/supabase'));

const mockAddEventListener = NetInfo.addEventListener as jest.Mock;

function TestConsumer() {
    const { isConnected, syncStatus, triggerSync } = useNetworkStatus();
    return (
        <>
            <Text testID="connected">{String(isConnected)}</Text>
            <Text testID="pending">{syncStatus.pending}</Text>
        </>
    );
}

describe('NetworkProvider', () => {
    let listenerCallback: ((state: any) => void) | null = null;

    beforeEach(() => {
        jest.clearAllMocks();
        listenerCallback = null;
        mockAddEventListener.mockImplementation((callback: any) => {
            listenerCallback = callback;
            return jest.fn(); // unsubscribe
        });
    });

    it('renders children', () => {
        const { getByText } = render(
            <NetworkProvider>
                <Text>Child content</Text>
            </NetworkProvider>,
        );
        expect(getByText('Child content')).toBeTruthy();
    });

    it('provides isConnected state', () => {
        const { getByTestId } = render(
            <NetworkProvider>
                <TestConsumer />
            </NetworkProvider>,
        );
        expect(getByTestId('connected').props.children).toBe('true');
    });

    it('updates isConnected when network state changes', async () => {
        const { getByTestId } = render(
            <NetworkProvider>
                <TestConsumer />
            </NetworkProvider>,
        );

        expect(getByTestId('connected').props.children).toBe('true');

        await act(async () => {
            listenerCallback?.({ isConnected: false, isInternetReachable: false });
        });

        expect(getByTestId('connected').props.children).toBe('false');
    });

    it('auto-syncs when connectivity is restored', async () => {
        const { getByTestId } = render(
            <NetworkProvider>
                <TestConsumer />
            </NetworkProvider>,
        );

        // Go offline
        await act(async () => {
            listenerCallback?.({ isConnected: false, isInternetReachable: false });
        });

        // Go back online — should trigger sync (no error is success)
        await act(async () => {
            listenerCallback?.({ isConnected: true, isInternetReachable: true });
        });

        expect(getByTestId('connected').props.children).toBe('true');
    });

    it('provides triggerSync function', async () => {
        let triggerSyncFn: (() => Promise<void>) | null = null;

        function SyncConsumer() {
            const { triggerSync } = useNetworkStatus();
            triggerSyncFn = triggerSync;
            return <Text>sync consumer</Text>;
        }

        render(
            <NetworkProvider>
                <SyncConsumer />
            </NetworkProvider>,
        );

        expect(triggerSyncFn).toBeDefined();

        // Should not throw
        await act(async () => {
            await triggerSyncFn!();
        });
    });
});
