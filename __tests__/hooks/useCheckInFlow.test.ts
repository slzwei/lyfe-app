import { renderHook, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { router as mockRouter } from 'expo-router';
import { useCheckInFlow } from '@/hooks/useCheckInFlow';

jest.mock('@/lib/supabase');

const mockLogRoadshowAttendanceWithPledge = jest.fn();
const mockHasUserCheckedIn = jest.fn();
const mockLogRoadshowActivity = jest.fn();
const mockCheckEventProximity = jest.fn();
const mockVerifyFace = jest.fn();

jest.mock('@/lib/roadshow', () => ({
    logRoadshowAttendanceWithPledge: (...args: any[]) => mockLogRoadshowAttendanceWithPledge(...args),
    hasUserCheckedIn: (...args: any[]) => mockHasUserCheckedIn(...args),
    logRoadshowActivity: (...args: any[]) => mockLogRoadshowActivity(...args),
}));

jest.mock('@/lib/gpsVerification', () => ({
    checkEventProximity: (...args: any[]) => mockCheckEventProximity(...args),
}));

jest.mock('@/lib/faceVerification', () => ({
    verifyFace: (...args: any[]) => mockVerifyFace(...args),
}));

describe('useCheckInFlow', () => {
    const defaultParams = {
        eventId: 'e1',
        userId: 'user1',
        userFullName: 'Test User',
        faceRegisteredAt: '2026-04-01T00:00:00Z',
        roadshowConfig: {
            id: 'cfg1',
            event_id: 'e1',
            weekly_cost: 500,
            daily_cost: 100,
            slot_cost: 25,
            slots_per_day: 4,
            expected_start_time: '09:00',
            late_grace_minutes: 15,
            suggested_sitdowns: 8,
            suggested_pitches: 6,
            suggested_closed: 2,
        } as any,
        onCheckedIn: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockLogRoadshowActivity.mockResolvedValue({ data: null, error: null });
        // Default: proximity passes — overridden in failure-path tests.
        mockCheckEventProximity.mockResolvedValue({ ok: true, distanceMeters: 12, requiredMeters: 100 });
    });

    // ── Phase 0: pledge sheet open ────────────────────────────

    it('handleOpenCheckin sets pledge defaults from config', () => {
        const { result } = renderHook(() => useCheckInFlow(defaultParams));

        act(() => {
            result.current.handleOpenCheckin();
        });

        expect(result.current.showPledgeSheet).toBe(true);
        expect(result.current.pledgeSitdowns).toBe(8);
        expect(result.current.pledgePitches).toBe(6);
        expect(result.current.pledgeClosed).toBe(2);
    });

    // ── Phase 1: handleConfirmPledge guards ───────────────────

    it('handleConfirmPledge opens face capture after all guards pass', async () => {
        mockHasUserCheckedIn.mockResolvedValue({ data: false, error: null });

        const { result } = renderHook(() => useCheckInFlow(defaultParams));

        act(() => {
            result.current.handleOpenCheckin();
        });

        await act(async () => {
            await result.current.handleConfirmPledge();
        });

        // Guards ran but attendance was NOT written — that happens in phase 2.
        expect(mockCheckEventProximity).toHaveBeenCalledWith('e1');
        expect(mockHasUserCheckedIn).toHaveBeenCalledWith('e1', 'user1');
        expect(mockLogRoadshowAttendanceWithPledge).not.toHaveBeenCalled();

        // Face capture overlay should be open; pledge sheet closed.
        expect(result.current.faceCaptureVisible).toBe(true);
        expect(result.current.showPledgeSheet).toBe(false);
        // checkingIn stays true until the capture dismisses, so the pledge
        // button remains disabled if the user returns to it via cancel.
        expect(result.current.checkingIn).toBe(true);
    });

    it('shows error when hasUserCheckedIn fails', async () => {
        mockHasUserCheckedIn.mockResolvedValue({ data: false, error: 'Network error' });

        const { result } = renderHook(() => useCheckInFlow(defaultParams));

        await act(async () => {
            await result.current.handleConfirmPledge();
        });

        expect(result.current.checkinError).toBe('Network error');
        expect(result.current.faceCaptureVisible).toBe(false);
        expect(mockLogRoadshowAttendanceWithPledge).not.toHaveBeenCalled();
        expect(defaultParams.onCheckedIn).not.toHaveBeenCalled();
    });

    it('handles already checked in case without opening face capture', async () => {
        mockHasUserCheckedIn.mockResolvedValue({ data: true, error: null });

        const { result } = renderHook(() => useCheckInFlow(defaultParams));

        act(() => {
            result.current.handleOpenCheckin();
        });

        await act(async () => {
            await result.current.handleConfirmPledge();
        });

        expect(mockLogRoadshowAttendanceWithPledge).not.toHaveBeenCalled();
        expect(defaultParams.onCheckedIn).toHaveBeenCalled();
        expect(result.current.showPledgeSheet).toBe(false);
        expect(result.current.faceCaptureVisible).toBe(false);
    });

    it('blocks check-in when proximity check fails', async () => {
        mockCheckEventProximity.mockResolvedValue({
            ok: false,
            reason: 'out_of_range',
            message: 'You are 350m from the venue. Move within 100m to check in.',
            distanceMeters: 350,
            requiredMeters: 100,
        });

        const { result } = renderHook(() => useCheckInFlow(defaultParams));

        await act(async () => {
            await result.current.handleConfirmPledge();
        });

        expect(result.current.checkinError).toBe('You are 350m from the venue. Move within 100m to check in.');
        expect(result.current.faceCaptureVisible).toBe(false);
        expect(mockHasUserCheckedIn).not.toHaveBeenCalled();
        expect(mockLogRoadshowAttendanceWithPledge).not.toHaveBeenCalled();
        expect(defaultParams.onCheckedIn).not.toHaveBeenCalled();
    });

    it('blocks check-in when event location is TBC', async () => {
        mockCheckEventProximity.mockResolvedValue({
            ok: false,
            reason: 'no_location_set',
            message: 'This event has no pinned location yet. Ask your manager to set the venue.',
        });

        const { result } = renderHook(() => useCheckInFlow(defaultParams));

        await act(async () => {
            await result.current.handleConfirmPledge();
        });

        expect(result.current.checkinError).toContain('no pinned location');
        expect(result.current.faceCaptureVisible).toBe(false);
        expect(mockLogRoadshowAttendanceWithPledge).not.toHaveBeenCalled();
    });

    it('blocks check-in when face is not registered and offers Register CTA', async () => {
        mockHasUserCheckedIn.mockResolvedValue({ data: false, error: null });

        const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

        const { result } = renderHook(() => useCheckInFlow({ ...defaultParams, faceRegisteredAt: null }));

        await act(async () => {
            await result.current.handleConfirmPledge();
        });

        expect(alertSpy).toHaveBeenCalledWith(
            'Face Not Registered',
            expect.stringContaining('Lyfe ID'),
            expect.any(Array),
        );

        // Extract the "Register Now" button and invoke its onPress.
        const buttons = alertSpy.mock.calls[0][2] as { text: string; onPress?: () => void }[];
        const registerBtn = buttons.find((b) => b.text === 'Register Now');
        expect(registerBtn).toBeDefined();
        act(() => {
            registerBtn!.onPress!();
        });

        expect(mockRouter.push).toHaveBeenCalledWith('/(tabs)/profile/face-register');
        expect(result.current.faceCaptureVisible).toBe(false);
        expect(mockLogRoadshowAttendanceWithPledge).not.toHaveBeenCalled();

        alertSpy.mockRestore();
    });

    // ── Phase 2: handleFacePhotoCaptured ──────────────────────

    async function openFaceCapture(hookParams = defaultParams) {
        mockHasUserCheckedIn.mockResolvedValueOnce({ data: false, error: null });
        const { result } = renderHook(() => useCheckInFlow(hookParams));
        act(() => result.current.handleOpenCheckin());
        await act(async () => {
            await result.current.handleConfirmPledge();
        });
        return result;
    }

    it('handleFacePhotoCaptured verifies face and logs attendance on happy path', async () => {
        const result = await openFaceCapture();

        mockVerifyFace.mockResolvedValue({ match: true, similarity: 99.5, confidence: 99.9 });
        mockHasUserCheckedIn.mockResolvedValueOnce({ data: false, error: null });
        mockLogRoadshowAttendanceWithPledge.mockResolvedValue({ error: null });

        let captureResult: any;
        await act(async () => {
            captureResult = await result.current.handleFacePhotoCaptured('/tmp/photo.jpg');
        });

        // Re-run proximity inside phase 2 to catch users walking out of range.
        expect(mockCheckEventProximity).toHaveBeenCalledTimes(2);
        expect(mockVerifyFace).toHaveBeenCalledWith('/tmp/photo.jpg');
        expect(mockLogRoadshowAttendanceWithPledge).toHaveBeenCalledWith('e1', 'user1', null, {
            sitdowns: 8,
            pitches: 6,
            closed: 2,
            afyc: 0,
        });
        expect(captureResult).toEqual({ ok: true });
    });

    it('handleFacePhotoCaptured returns ok:false on verify rejection', async () => {
        const result = await openFaceCapture();

        mockVerifyFace.mockResolvedValue({
            match: false,
            similarity: 72,
            confidence: 99.9,
            reason: 'low_similarity',
            message: 'Face not recognized',
        });

        let captureResult: any;
        await act(async () => {
            captureResult = await result.current.handleFacePhotoCaptured('/tmp/photo.jpg');
        });

        expect(captureResult).toEqual({
            ok: false,
            reason: 'low_similarity',
            message: 'Face not recognized',
        });
        expect(mockLogRoadshowAttendanceWithPledge).not.toHaveBeenCalled();
    });

    it('handleFacePhotoCaptured rejects if user walked out of range mid-flow', async () => {
        const result = await openFaceCapture();

        // Second proximity call (inside phase 2) says user is out of range.
        mockCheckEventProximity.mockResolvedValueOnce({
            ok: false,
            reason: 'out_of_range',
            message: 'You are 400m from the venue. Move within 100m to check in.',
        });

        let captureResult: any;
        await act(async () => {
            captureResult = await result.current.handleFacePhotoCaptured('/tmp/photo.jpg');
        });

        expect(captureResult).toEqual({
            ok: false,
            reason: 'low_face_confidence',
            message: 'You are 400m from the venue. Move within 100m to check in.',
        });
        expect(mockVerifyFace).not.toHaveBeenCalled();
        expect(mockLogRoadshowAttendanceWithPledge).not.toHaveBeenCalled();
    });

    it('handleFacePhotoCaptured throws when attendance log fails', async () => {
        const result = await openFaceCapture();

        mockVerifyFace.mockResolvedValue({ match: true, similarity: 99.5, confidence: 99.9 });
        mockHasUserCheckedIn.mockResolvedValueOnce({ data: false, error: null });
        mockLogRoadshowAttendanceWithPledge.mockResolvedValue({ error: 'DB write failed' });

        let thrown: Error | null = null;
        await act(async () => {
            try {
                await result.current.handleFacePhotoCaptured('/tmp/photo.jpg');
            } catch (e) {
                thrown = e as Error;
            }
        });

        expect(thrown).toBeInstanceOf(Error);
        expect(thrown!.message).toContain('DB write failed');
    });

    it('handleFacePhotoCaptured is idempotent when user already checked in on retry', async () => {
        const result = await openFaceCapture();

        // Simulate retry after a partial-success: verify passes, then the
        // idempotency check finds the row already exists, so we skip the
        // second log call entirely.
        mockVerifyFace.mockResolvedValue({ match: true, similarity: 99.5, confidence: 99.9 });
        mockHasUserCheckedIn.mockResolvedValueOnce({ data: true, error: null });

        let captureResult: any;
        await act(async () => {
            captureResult = await result.current.handleFacePhotoCaptured('/tmp/photo.jpg');
        });

        expect(captureResult).toEqual({ ok: true });
        expect(mockLogRoadshowAttendanceWithPledge).not.toHaveBeenCalled();
    });

    // ── Phase 3: handleFaceDismiss ────────────────────────────

    it('handleFaceDismiss clears overlay and fires onCheckedIn after success', async () => {
        const result = await openFaceCapture();

        mockVerifyFace.mockResolvedValue({ match: true, similarity: 99.5, confidence: 99.9 });
        mockHasUserCheckedIn.mockResolvedValueOnce({ data: false, error: null });
        mockLogRoadshowAttendanceWithPledge.mockResolvedValue({ error: null });

        await act(async () => {
            await result.current.handleFacePhotoCaptured('/tmp/photo.jpg');
        });

        act(() => {
            result.current.handleFaceDismiss();
        });

        expect(result.current.faceCaptureVisible).toBe(false);
        expect(result.current.checkingIn).toBe(false);
        expect(defaultParams.onCheckedIn).toHaveBeenCalled();
    });

    it('handleFaceDismiss does NOT fire onCheckedIn after a cancelled capture', async () => {
        const result = await openFaceCapture();

        // No handleFacePhotoCaptured call — user cancelled before capture.
        act(() => {
            result.current.handleFaceDismiss();
        });

        expect(result.current.faceCaptureVisible).toBe(false);
        expect(result.current.checkingIn).toBe(false);
        expect(defaultParams.onCheckedIn).not.toHaveBeenCalled();
    });
});
