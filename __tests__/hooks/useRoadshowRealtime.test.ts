/**
 * Tests for hooks/useRoadshowRealtime.ts — Realtime subscription hook
 */
import { renderHook } from '@testing-library/react-native';
import { supabase } from '@/lib/supabase';
import { useRoadshowRealtime } from '@/hooks/useRoadshowRealtime';

jest.mock('@/lib/supabase');

const mockSupa = supabase as any;

let channelCallbacks: Record<string, Function>;
let mockChannel: any;

beforeEach(() => {
    jest.clearAllMocks();
    channelCallbacks = {};

    mockChannel = {
        on: jest.fn((_event: string, opts: any, callback: Function) => {
            // Store callback by table name for later invocation
            channelCallbacks[opts.table] = callback;
            return mockChannel;
        }),
        subscribe: jest.fn().mockReturnThis(),
    };

    mockSupa.channel.mockReturnValue(mockChannel);
});

describe('useRoadshowRealtime', () => {
    it('subscribes to channel when live roadshow with eventId', () => {
        const onNewActivity = jest.fn();
        const onNewAttendance = jest.fn();

        renderHook(() => useRoadshowRealtime('evt-1', true, 'user-1', onNewActivity, onNewAttendance));

        expect(mockSupa.channel).toHaveBeenCalledWith('roadshow-evt-1');
        expect(mockChannel.on).toHaveBeenCalledTimes(2);
        expect(mockChannel.subscribe).toHaveBeenCalled();
    });

    it('does not subscribe when eventId is undefined', () => {
        renderHook(() => useRoadshowRealtime(undefined, true, 'user-1', jest.fn(), jest.fn()));

        expect(mockSupa.channel).not.toHaveBeenCalled();
    });

    it('does not subscribe when not a live roadshow', () => {
        renderHook(() => useRoadshowRealtime('evt-1', false, 'user-1', jest.fn(), jest.fn()));

        expect(mockSupa.channel).not.toHaveBeenCalled();
    });

    it('filters out own user activities', () => {
        const onNewActivity = jest.fn();
        const onNewAttendance = jest.fn();

        renderHook(() => useRoadshowRealtime('evt-1', true, 'user-1', onNewActivity, onNewAttendance));

        // Simulate own activity insert
        channelCallbacks['roadshow_activities']({
            new: { user_id: 'user-1', type: 'sitdown', event_id: 'evt-1' },
        });

        expect(onNewActivity).not.toHaveBeenCalled();
    });

    it('passes through other users activities', () => {
        const onNewActivity = jest.fn();
        const onNewAttendance = jest.fn();

        renderHook(() => useRoadshowRealtime('evt-1', true, 'user-1', onNewActivity, onNewAttendance));

        const foreignActivity = { user_id: 'user-2', type: 'sitdown', event_id: 'evt-1' };
        channelCallbacks['roadshow_activities']({ new: foreignActivity });

        expect(onNewActivity).toHaveBeenCalledWith(foreignActivity);
    });

    it('filters out own attendance but passes foreign', () => {
        const onNewActivity = jest.fn();
        const onNewAttendance = jest.fn();

        renderHook(() => useRoadshowRealtime('evt-1', true, 'user-1', onNewActivity, onNewAttendance));

        // Own attendance — filtered
        channelCallbacks['roadshow_attendance']({
            new: { user_id: 'user-1', event_id: 'evt-1' },
        });
        expect(onNewAttendance).not.toHaveBeenCalled();

        // Foreign attendance — passed through
        const foreignAttendance = { user_id: 'user-2', event_id: 'evt-1' };
        channelCallbacks['roadshow_attendance']({ new: foreignAttendance });
        expect(onNewAttendance).toHaveBeenCalledWith(foreignAttendance);
    });

    it('resets retry on SUBSCRIBED and retries on CHANNEL_ERROR', () => {
        jest.useFakeTimers();
        let statusCallback: Function;
        mockChannel.subscribe.mockImplementation((cb?: Function) => {
            if (cb) statusCallback = cb;
            return mockChannel;
        });

        renderHook(() => useRoadshowRealtime('evt-1', true, 'user-1', jest.fn(), jest.fn()));

        // Trigger SUBSCRIBED
        statusCallback!('SUBSCRIBED');

        // Trigger error
        statusCallback!('CHANNEL_ERROR');
        jest.advanceTimersByTime(2000);
        expect(mockSupa.removeChannel).toHaveBeenCalled();

        jest.useRealTimers();
    });

    it('calls onResync on re-subscribe but not on the first subscribe', () => {
        // Audit H6: the consumer already loads on mount/focus, so resync only on
        // a *re*-subscribe (after a dropped connection) to backfill missed inserts.
        let statusCallback: Function = () => {};
        mockChannel.subscribe.mockImplementation((cb?: Function) => {
            if (cb) statusCallback = cb;
            return mockChannel;
        });
        const onResync = jest.fn();

        renderHook(() => useRoadshowRealtime('evt-1', true, 'user-1', jest.fn(), jest.fn(), onResync));

        statusCallback('SUBSCRIBED'); // first join — no resync
        expect(onResync).not.toHaveBeenCalled();

        statusCallback('SUBSCRIBED'); // re-join after a drop — resync
        expect(onResync).toHaveBeenCalledTimes(1);
    });

    it('re-attaches the status handler when reconnecting after CHANNEL_ERROR', () => {
        jest.useFakeTimers();
        let statusCallback: Function = () => {};
        mockChannel.subscribe.mockImplementation((cb?: Function) => {
            if (cb) statusCallback = cb;
            return mockChannel;
        });

        renderHook(() => useRoadshowRealtime('evt-1', true, 'user-1', jest.fn(), jest.fn(), jest.fn()));

        statusCallback('CHANNEL_ERROR');
        jest.advanceTimersByTime(2000);

        expect(mockSupa.removeChannel).toHaveBeenCalled();
        // The recreated channel must subscribe WITH a status handler — pre-fix it
        // resubscribed with no callback, so a second drop could never reconnect
        // or resync, and the leaderboard would silently die after one blip.
        expect(mockChannel.subscribe).toHaveBeenLastCalledWith(expect.any(Function));

        jest.useRealTimers();
    });

    it('cleans up channel on unmount', () => {
        const { unmount } = renderHook(() => useRoadshowRealtime('evt-1', true, 'user-1', jest.fn(), jest.fn()));

        unmount();
        expect(mockSupa.removeChannel).toHaveBeenCalledWith(mockChannel);
    });

    it('does not clean up when no subscription was made', () => {
        const { unmount } = renderHook(() => useRoadshowRealtime(undefined, false, 'user-1', jest.fn(), jest.fn()));

        unmount();
        expect(mockSupa.removeChannel).not.toHaveBeenCalled();
    });
});
