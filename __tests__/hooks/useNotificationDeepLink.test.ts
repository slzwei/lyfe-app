import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';

import { useNotificationDeepLink } from '@/hooks/useNotificationDeepLink';

const notificationResponse = (route?: unknown) =>
    ({
        notification: {
            request: {
                content: {
                    data: route === undefined ? {} : { route },
                },
            },
        },
    }) as any;

describe('useNotificationDeepLink', () => {
    let warmTapHandler: ((response: any) => void) | undefined;
    const remove = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        warmTapHandler = undefined;
        (Notifications as any).getLastNotificationResponseAsync = jest.fn().mockResolvedValue(null);
        (Notifications as any).addNotificationResponseReceivedListener = jest.fn((handler) => {
            warmTapHandler = handler;
            return { remove };
        });
    });

    it('defers a safe cold-start route until auth is ready', async () => {
        const router = useRouter();
        (Notifications as any).getLastNotificationResponseAsync.mockResolvedValueOnce(
            notificationResponse('/(tabs)/leads/lead-1'),
        );

        const { rerender } = renderHook(({ ready }) => useNotificationDeepLink({ ready }), {
            initialProps: { ready: false },
        });

        await act(async () => {});
        expect(router.push).not.toHaveBeenCalled();

        rerender({ ready: true });

        await waitFor(() => expect(router.push).toHaveBeenCalledWith('/(tabs)/leads/lead-1'));
    });

    it('routes warm taps immediately when auth is ready', () => {
        const router = useRouter();
        renderHook(() => useNotificationDeepLink({ ready: true }));

        act(() => {
            warmTapHandler?.(notificationResponse('/(tabs)/events/event-1'));
        });

        expect(router.push).toHaveBeenCalledWith('/(tabs)/events/event-1');
    });

    it('ignores unsafe warm-tap routes and removes the listener on unmount', () => {
        const router = useRouter();
        const { unmount } = renderHook(() => useNotificationDeepLink({ ready: true }));

        act(() => {
            warmTapHandler?.(notificationResponse('https://example.com/phishing'));
        });

        expect(router.push).not.toHaveBeenCalled();
        unmount();
        expect(remove).toHaveBeenCalled();
    });
});
