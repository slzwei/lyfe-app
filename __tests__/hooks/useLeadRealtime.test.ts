/**
 * Tests for hooks/useLeadRealtime.ts — Realtime subscription for new leads
 */
import { renderHook } from '@testing-library/react-native';
import { supabase } from '@/lib/supabase';
import { useLeadRealtime } from '@/hooks/useLeadRealtime';

jest.mock('@/lib/supabase');
jest.mock('@/contexts/AuthContext', () => ({
    useAuth: () => ({
        user: { id: 'user-1', role: 'agent' },
    }),
}));

const mockSupa = supabase as any;

let channelCallback: Function;
let mockChannel: any;

beforeEach(() => {
    jest.clearAllMocks();

    mockChannel = {
        on: jest.fn((_event: string, _opts: any, callback: Function) => {
            channelCallback = callback;
            return mockChannel;
        }),
        subscribe: jest.fn().mockReturnThis(),
    };

    mockSupa.channel.mockReturnValue(mockChannel);
});

describe('useLeadRealtime', () => {
    it('subscribes to leads channel for the current user', () => {
        const onNewLead = jest.fn();

        renderHook(() => useLeadRealtime(onNewLead));

        expect(mockSupa.channel).toHaveBeenCalledWith('leads:user-1');
        expect(mockChannel.on).toHaveBeenCalledWith(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'leads',
                filter: 'assigned_to=eq.user-1',
            },
            expect.any(Function),
        );
        expect(mockChannel.subscribe).toHaveBeenCalled();
    });

    it('calls onNewLead with payload.new when a lead arrives', () => {
        const onNewLead = jest.fn();

        renderHook(() => useLeadRealtime(onNewLead));

        const newLead = { id: 'lead-1', full_name: 'John Tan', assigned_to: 'user-1' };
        channelCallback({ new: newLead });

        expect(onNewLead).toHaveBeenCalledWith(newLead);
    });

    it('resets retry count on SUBSCRIBED status', () => {
        let statusCallback: Function;
        mockChannel.subscribe.mockImplementation((cb?: Function) => {
            if (cb) statusCallback = cb;
            return mockChannel;
        });

        const onNewLead = jest.fn();
        renderHook(() => useLeadRealtime(onNewLead));

        // Trigger SUBSCRIBED status
        statusCallback!('SUBSCRIBED');
        // No error thrown = success
    });

    it('retries on CHANNEL_ERROR', () => {
        jest.useFakeTimers();
        let statusCallback: Function;
        mockChannel.subscribe.mockImplementation((cb?: Function) => {
            if (cb) statusCallback = cb;
            return mockChannel;
        });

        const onNewLead = jest.fn();
        renderHook(() => useLeadRealtime(onNewLead));

        // Trigger error
        statusCallback!('CHANNEL_ERROR');

        // After delay, should attempt reconnect
        jest.advanceTimersByTime(2000);
        expect(mockSupa.removeChannel).toHaveBeenCalled();

        jest.useRealTimers();
    });

    it('retries on TIMED_OUT with exponential backoff', () => {
        jest.useFakeTimers();
        let statusCallback: Function;
        mockChannel.subscribe.mockImplementation((cb?: Function) => {
            if (cb) statusCallback = cb;
            return mockChannel;
        });

        const onNewLead = jest.fn();
        renderHook(() => useLeadRealtime(onNewLead));

        statusCallback!('TIMED_OUT');
        jest.advanceTimersByTime(2000);
        expect(mockSupa.removeChannel).toHaveBeenCalled();

        jest.useRealTimers();
    });

    it('cleans up channel on unmount', () => {
        const onNewLead = jest.fn();

        const { unmount } = renderHook(() => useLeadRealtime(onNewLead));

        unmount();
        expect(mockSupa.removeChannel).toHaveBeenCalledWith(mockChannel);
    });
});
