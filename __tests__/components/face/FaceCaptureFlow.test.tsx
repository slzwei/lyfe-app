/**
 * Component tests for FaceCaptureFlow — render states across liveness phases
 * (mocked useFaceLiveness), overlay routing, failure copy mapping, the
 * one-time primer, the attempt cap, and accessibility announcements.
 *
 * The liveness engine itself is covered by __tests__/lib/liveness.test.ts;
 * here the hook is mocked and driven phase-by-phase.
 */
import { FaceCaptureFlow } from '@/components/face/FaceCaptureFlow';
import type { UseFaceLivenessResult } from '@/hooks/useFaceLiveness';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';
import { AccessibilityInfo } from 'react-native';

jest.mock('@/contexts/ThemeContext', () => {
    const mockColors = require('@/constants/Colors').Colors;
    return {
        useTheme: () => ({
            colors: mockColors.light,
            isDark: false,
            mode: 'light',
            resolved: 'light',
            setMode: jest.fn(),
        }),
    };
});

jest.mock('@/lib/sentry', () => ({
    Sentry: { captureMessage: jest.fn(), addBreadcrumb: jest.fn() },
    captureError: jest.fn(),
}));

// The component only uses useNavigation().getParent() to hide the tab bar;
// no parent navigator exists in the test tree.
jest.mock('expo-router', () => ({
    useNavigation: () => ({ getParent: () => undefined }),
}));

// faceVerification imports lib/supabase (env-gated); the component only needs
// the connectivity classifier from it.
jest.mock('@/lib/faceVerification', () => ({
    isConnectivityError: (input: unknown) =>
        /failed to send a request|network request failed/i.test(String(input instanceof Error ? input.message : input)),
}));

// Controllable network status
const mockNetwork = { isConnected: true, isInternetReachable: true };
jest.mock('@/hooks/useNetworkStatus', () => ({
    useNetworkStatus: () => mockNetwork,
}));

// Controllable liveness engine
const mockLiveness: UseFaceLivenessResult = {
    frameOutput: { __mockFrameOutput: true } as never,
    phase: 'searching',
    challenge: null,
    guidance: 'searching',
    progress: 0.05,
    eyeDataMissing: false,
    blinkTimeouts: 0,
    reset: jest.fn(),
    getDebugSnapshot: jest.fn(() => ({
        phase: 'searching',
        yaw: 0,
        leftEye: null,
        rightEye: null,
        baseline: null,
        armingSamples: 0,
        faceCount: 0,
        fps: 0,
    })),
};
jest.mock('@/hooks/useFaceLiveness', () => ({
    useFaceLiveness: jest.fn(() => mockLiveness),
}));

const { usePhotoOutput } = jest.requireMock('react-native-vision-camera');

function setLiveness(patch: Partial<UseFaceLivenessResult>) {
    Object.assign(mockLiveness, patch);
}

function makeCapture(filePath = '/tmp/shot.jpg') {
    return { capturePhotoToFile: jest.fn().mockResolvedValue({ filePath }) };
}

/** Fire the layout + preview-started events so the flow leaves warm-up. */
function warmUp(api: ReturnType<typeof render>) {
    fireEvent(api.getByTestId('face-viewfinder'), 'layout', {
        nativeEvent: { layout: { width: 300, height: 400 } },
    });
    const camera = api.UNSAFE_getByType('Camera' as never) as { props: { onPreviewStarted: () => void } };
    fireEvent(camera as never, 'previewStarted');
}

beforeEach(() => {
    jest.clearAllMocks();
    mockNetwork.isConnected = true;
    mockNetwork.isInternetReachable = true;
    setLiveness({
        phase: 'searching',
        challenge: null,
        guidance: 'searching',
        progress: 0.05,
        eyeDataMissing: false,
        blinkTimeouts: 0,
    });
    usePhotoOutput.mockReturnValue(makeCapture());
    // Primer already seen by default — the dedicated primer test overrides.
    jest.spyOn(AsyncStorage, 'getItem').mockResolvedValue('1');
    jest.spyOn(AsyncStorage, 'setItem').mockResolvedValue(undefined);
});

function renderFlow(overrides: Partial<React.ComponentProps<typeof FaceCaptureFlow>> = {}) {
    const onPhotoCaptured = jest.fn().mockResolvedValue({ ok: true });
    const onDismiss = jest.fn();
    const api = render(
        <FaceCaptureFlow
            mode="verify"
            onPhotoCaptured={onPhotoCaptured}
            onDismiss={onDismiss}
            showDebug={false}
            {...overrides}
        />,
    );
    return { ...api, onPhotoCaptured, onDismiss };
}

describe('FaceCaptureFlow', () => {
    it('renders the coaching line for the current guidance', () => {
        const api = renderFlow();
        expect(api.getByText('Looking for you…')).toBeTruthy();

        setLiveness({ phase: 'challenge_blink', challenge: 'blink', guidance: 'blink', progress: 0.45 });
        api.rerender(
            <FaceCaptureFlow
                mode="verify"
                onPhotoCaptured={api.onPhotoCaptured}
                onDismiss={api.onDismiss}
                showDebug={false}
            />,
        );
        expect(api.getByText('Blink now')).toBeTruthy();
    });

    it('announces guidance changes for screen readers once camera is live', async () => {
        const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
        const api = renderFlow();
        warmUp(api);

        setLiveness({ guidance: 'center_face' });
        api.rerender(
            <FaceCaptureFlow
                mode="verify"
                onPhotoCaptured={api.onPhotoCaptured}
                onDismiss={api.onDismiss}
                showDebug={false}
            />,
        );
        // Trailing debounce: the change announces once the 1s window passes.
        await waitFor(
            () => {
                expect(announce).toHaveBeenCalledWith('Center your face in the circle');
            },
            { timeout: 2500 },
        );
    });

    it('captures a photo on liveness pass and shows the success overlay', async () => {
        const capture = makeCapture('/tmp/settled.jpg');
        usePhotoOutput.mockReturnValue(capture);
        const api = renderFlow();
        warmUp(api);

        setLiveness({ phase: 'capture', challenge: 'blink', guidance: 'done', progress: 1 });
        api.rerender(
            <FaceCaptureFlow
                mode="verify"
                onPhotoCaptured={api.onPhotoCaptured}
                onDismiss={api.onDismiss}
                showDebug={false}
            />,
        );

        await waitFor(() => {
            expect(capture.capturePhotoToFile).toHaveBeenCalledTimes(1);
            expect(api.onPhotoCaptured).toHaveBeenCalledWith('/tmp/settled.jpg');
        });
        await waitFor(() => {
            expect(api.getByTestId('face-capture-success-dismiss')).toBeTruthy();
        });
    });

    it('maps known quality reasons to brand-voice coaching copy', async () => {
        const api = renderFlow();
        api.onPhotoCaptured.mockResolvedValue({
            ok: false,
            reason: 'blurry',
            message: 'Image sharpness 41 below threshold 50',
        });
        warmUp(api);

        setLiveness({ phase: 'capture', challenge: 'blink', guidance: 'done', progress: 1 });
        api.rerender(
            <FaceCaptureFlow
                mode="verify"
                onPhotoCaptured={api.onPhotoCaptured}
                onDismiss={api.onDismiss}
                showDebug={false}
            />,
        );

        await waitFor(() => {
            expect(api.getByText('The shot came out blurry. Hold a little steadier this time.')).toBeTruthy();
        });
    });

    it('passes unmapped reasons through verbatim (proximity reuses low_face_confidence)', async () => {
        const api = renderFlow();
        api.onPhotoCaptured.mockResolvedValue({
            ok: false,
            reason: 'low_face_confidence',
            message: 'You are 250m from the venue. Move closer to check in.',
        });
        warmUp(api);

        setLiveness({ phase: 'capture', challenge: 'blink', guidance: 'done', progress: 1 });
        api.rerender(
            <FaceCaptureFlow
                mode="verify"
                onPhotoCaptured={api.onPhotoCaptured}
                onDismiss={api.onDismiss}
                showDebug={false}
            />,
        );

        await waitFor(() => {
            expect(api.getByText('You are 250m from the venue. Move closer to check in.')).toBeTruthy();
        });
    });

    it('shows the fail overlay with retry when liveness times out', async () => {
        const api = renderFlow();
        warmUp(api);

        setLiveness({ phase: 'timed_out', guidance: 'hold_still' });
        api.rerender(
            <FaceCaptureFlow
                mode="verify"
                onPhotoCaptured={api.onPhotoCaptured}
                onDismiss={api.onDismiss}
                showDebug={false}
            />,
        );

        await waitFor(() => {
            expect(api.getByText("We couldn't verify in time. Find even lighting and try again.")).toBeTruthy();
            expect(api.getByText('Try again')).toBeTruthy();
        });
    });

    it('shows the network overlay immediately when opened offline', async () => {
        mockNetwork.isConnected = false;
        mockNetwork.isInternetReachable = false;
        const api = renderFlow();

        await waitFor(() => {
            expect(api.getByText('No connection')).toBeTruthy();
        });
        expect(api.onPhotoCaptured).not.toHaveBeenCalled();
    });

    it('shows the one-time primer on first verify and persists dismissal', async () => {
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
        const api = renderFlow();

        const dismiss = await api.findByTestId('face-capture-primer-dismiss');
        expect(api.getByText('Blink when asked')).toBeTruthy();

        fireEvent.press(dismiss);
        expect(AsyncStorage.setItem).toHaveBeenCalledWith('face_checkin_primer_seen', '1');
        expect(api.queryByTestId('face-capture-primer-dismiss')).toBeNull();
    });

    it('never shows the primer in register mode', async () => {
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
        const api = renderFlow({ mode: 'register' });
        await waitFor(() => {
            expect(api.queryByTestId('face-capture-primer-dismiss')).toBeNull();
        });
        expect(AsyncStorage.getItem).not.toHaveBeenCalledWith('face_checkin_primer_seen');
    });

    it('hides retry and shows the manager path after the verify attempt cap', async () => {
        const api = renderFlow();
        api.onPhotoCaptured.mockResolvedValue({
            ok: false,
            reason: 'low_similarity',
            message: 'Similarity 82 below threshold',
        });
        warmUp(api);

        const rerenderWithPhase = (phase: UseFaceLivenessResult['phase']) => {
            setLiveness({ phase, challenge: 'blink', guidance: phase === 'capture' ? 'done' : 'searching' });
            api.rerender(
                <FaceCaptureFlow
                    mode="verify"
                    onPhotoCaptured={api.onPhotoCaptured}
                    onDismiss={api.onDismiss}
                    showDebug={false}
                />,
            );
        };

        // Three failed attempts: capture → fail → retry (phase cycles so the
        // one-shot capture effect re-arms each round).
        for (let attempt = 1; attempt <= 3; attempt++) {
            rerenderWithPhase('capture');
            // eslint-disable-next-line no-await-in-loop
            await waitFor(() => {
                expect(api.onPhotoCaptured).toHaveBeenCalledTimes(attempt);
            });
            if (attempt < 3) {
                // eslint-disable-next-line no-await-in-loop
                const retry = await api.findByText('Try again');
                fireEvent.press(retry);
                rerenderWithPhase('searching');
            }
        }

        await waitFor(() => {
            expect(api.getByText('Let’s get you checked in another way')).toBeTruthy();
        });
        expect(api.queryByText('Try again')).toBeNull();
        expect(api.getByText(/Ask your manager to check you in/)).toBeTruthy();
        expect(mockLiveness.reset).toHaveBeenCalledWith({ preserveLadder: true });
    });

    it('shows the PDPA consent note in register mode only', () => {
        const registerApi = renderFlow({ mode: 'register' });
        expect(registerApi.getByText(/stored securely and used only to verify/)).toBeTruthy();
        registerApi.unmount();

        const verifyApi = renderFlow();
        expect(verifyApi.queryByText(/stored securely and used only to verify/)).toBeNull();
    });
});
