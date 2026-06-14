/**
 * Reusable camera + liveness + morph + overlay flow for face registration
 * and verification. Owns all the camera lifecycle, scan loop, FaceTurnPrompt
 * morph animation, result overlays, tab bar hide/restore, and max brightness.
 *
 * The parent supplies an `onPhotoCaptured(photoPath) → Promise<FaceCaptureResult>`
 * callback that performs the actual API call (registerFace / verifyFace). The
 * component routes the returned result into the appropriate success or failure
 * overlay and calls `onDismiss` when the user is done.
 */
import { FaceTurnPrompt } from '@/components/face/FaceTurnPrompt';
import { ShimmerOverlay } from '@/components/roadshow/atoms/ShimmerOverlay';
import { TAB_BAR_HEIGHT, TAB_BAR_PADDING_BOTTOM, TAB_BAR_PADDING_TOP } from '@/constants/platform';
import { useTheme } from '@/contexts/ThemeContext';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { isConnectivityError, type FaceQualityReason } from '@/lib/faceVerification';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from 'expo-router';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, LayoutChangeEvent, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
    FadeIn,
    FadeOut,
    ZoomIn,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle as SvgCircle, Defs, Ellipse as SvgEllipse, Mask, Path as SvgPath, Rect } from 'react-native-svg';
import {
    Camera,
    type CameraRef,
    useCameraDevice,
    useCameraPermission,
    usePhotoOutput,
} from 'react-native-vision-camera';
import { detectFaces, restoreBrightness, setMaxBrightness } from '../../modules/face-detection/src';

// ── Public API ─────────────────────────────────────────────

export type FaceCaptureMode = 'register' | 'verify';

export type FaceCaptureFailReason = FaceQualityReason | 'low_similarity';

export type FaceCaptureResult = { ok: true } | { ok: false; reason: FaceCaptureFailReason; message: string };

export interface FaceCaptureFlowProps {
    mode: FaceCaptureMode;
    /** Called after a photo is captured and liveness passes. The parent runs
     * its API call (register or verify) and returns the outcome. */
    onPhotoCaptured: (photoPath: string) => Promise<FaceCaptureResult>;
    /** Called when the user is done — cancelled, succeeded and dismissed,
     * or failed and cancelled. Parent should unmount the component. */
    onDismiss: () => void;
    /** Whether to show the dev yaw/face/step debug overlay. Defaults to __DEV__. */
    showDebug?: boolean;
}

// ── Internal types + constants ─────────────────────────────

type LivenessStep = 'look_straight' | 'turn_left' | 'turn_right' | 'done';

const YAW_STRAIGHT_MAX = Platform.OS === 'android' ? 18 : 10;
const YAW_LEFT_THRESHOLD = -15;
const YAW_RIGHT_THRESHOLD = 15;
const SCAN_INTERVAL_MS = 400;
// How long the brackets→ring→tick morph plays before the success overlay
// fades in. Matches the FaceTurnPrompt `morph` withTiming duration.
const MORPH_DELAY_MS = 600;

const STEP_PROMPTS: Record<LivenessStep, string> = {
    look_straight: 'Look straight at the camera',
    turn_left: 'Turn your head left',
    turn_right: 'Now turn your head right',
    done: 'Processing...',
};

// Prototype-style italic prompts shown inside the viewfinder oval.
const VIEWFINDER_PROMPTS: Record<LivenessStep, string> = {
    look_straight: 'Look straight ahead…',
    turn_left: 'Turn your head left…',
    turn_right: 'Turn right…',
    done: '✓ Got it',
};

// ── Mode-specific copy ─────────────────────────────────────
// The sheet is shared by enrollment (`register`) and roadshow check-in
// (`verify`). Kept as PLAIN STRINGS — a module-level object holding JSX that
// referenced `styles` (defined at file end) would hit a TDZ crash; the
// italic-accent JSX is assembled in render.

interface ModeCopy {
    eyebrow: string;
    titleLead: string;
    titleAccent: string;
    titleTail: string;
    ctaActive: string;
    ctaCapturing: string;
    successLead: string;
    successAccent: string;
    successTail: string;
    successSub: string;
    successCta: string;
    showProximityTick: boolean;
    showMatchTick: boolean;
}

function getModeCopy(mode: FaceCaptureMode): ModeCopy {
    if (mode === 'register') {
        return {
            eyebrow: 'SET UP YOUR LYFE ID',
            titleLead: 'Hold still. ',
            titleAccent: 'Turn your head',
            titleTail: ' to register.',
            ctaActive: 'Register my face',
            ctaCapturing: 'Capturing…',
            successLead: "You're ",
            successAccent: 'all set',
            successTail: '.',
            successSub: 'Your Lyfe ID is registered.',
            successCta: 'Done',
            showProximityTick: false,
            showMatchTick: false,
        };
    }
    // verify → roadshow check-in (copy unchanged from the original sheet)
    return {
        eyebrow: 'STEP 2 / 3 · FACE',
        titleLead: 'Hold still. ',
        titleAccent: 'Turn your head',
        titleTail: ' when prompted.',
        ctaActive: 'Check me in',
        ctaCapturing: 'Capturing…',
        successLead: '',
        successAccent: 'Checked',
        successTail: ' in.',
        successSub: "You're on the booth. Go get them.",
        successCta: "Let's go",
        showProximityTick: true,
        showMatchTick: true,
    };
}

// ── Result overlays ────────────────────────────────────────

function SuccessOverlay({
    titleNode,
    sub,
    cta,
    onDismiss,
}: {
    titleNode: React.ReactNode;
    sub: string;
    cta: string;
    onDismiss: () => void;
}) {
    const cardScale = useSharedValue(0.88);
    const cardOpacity = useSharedValue(0);

    useEffect(() => {
        // Delay the pop-in so the viewfinder morph has time to play before
        // the overlay covers it.
        cardScale.value = withDelay(MORPH_DELAY_MS, withSpring(1, { damping: 18, stiffness: 180 }));
        cardOpacity.value = withDelay(MORPH_DELAY_MS, withTiming(1, { duration: 240 }));
    }, [cardScale, cardOpacity]);

    const cardStyle = useAnimatedStyle(() => ({
        transform: [{ scale: cardScale.value }],
        opacity: cardOpacity.value,
    }));

    return (
        <Animated.View entering={FadeIn.delay(MORPH_DELAY_MS).duration(240)} style={styles.protoOverlay}>
            <Animated.View style={[styles.protoCard, cardStyle]}>
                <View
                    style={[
                        styles.protoIconRing,
                        { backgroundColor: PROTO_COLORS.sage + '1E', borderColor: PROTO_COLORS.sage },
                    ]}
                >
                    <Text style={[styles.protoIconGlyph, { color: PROTO_COLORS.sage }]}>✓</Text>
                </View>
                <Text style={styles.protoTitle}>{titleNode}</Text>
                <Text style={styles.protoSub}>{sub}</Text>
                <Pressable
                    testID="face-capture-success-dismiss"
                    onPress={onDismiss}
                    style={({ pressed }) => [
                        styles.protoCta,
                        {
                            backgroundColor: pressed ? '#5E6F51' : PROTO_COLORS.sage,
                            marginTop: 18,
                        },
                    ]}
                    accessibilityLabel="Dismiss"
                >
                    <Text style={styles.protoCtaText}>{cta}</Text>
                    <Text style={styles.protoCtaArrow}>→</Text>
                </Pressable>
            </Animated.View>
        </Animated.View>
    );
}

function FailedOverlay({
    onDismiss,
    onRetry,
    title,
    subtitle,
}: {
    onDismiss: () => void;
    onRetry: () => void;
    title: string;
    subtitle?: string;
}) {
    const cardScale = useSharedValue(0.88);
    const cardOpacity = useSharedValue(0);

    useEffect(() => {
        cardScale.value = withSpring(1, { damping: 18, stiffness: 180 });
        cardOpacity.value = withTiming(1, { duration: 240 });
    }, [cardScale, cardOpacity]);

    const cardStyle = useAnimatedStyle(() => ({
        transform: [{ scale: cardScale.value }],
        opacity: cardOpacity.value,
    }));

    // Prototype accent for fail state: pink (muted rose, not angry red)
    const pink = '#D88A93';
    const pinkTint = '#F3D9DC';

    return (
        <Animated.View entering={FadeIn.duration(240)} style={styles.protoOverlay}>
            <Animated.View style={[styles.protoCard, cardStyle]}>
                <View style={[styles.protoIconRing, { backgroundColor: pinkTint, borderColor: pink }]}>
                    <Text style={[styles.protoIconGlyph, { color: pink }]}>✕</Text>
                </View>
                <Text style={styles.protoTitle}>{title}</Text>
                {subtitle ? <Text style={styles.protoSub}>{subtitle}</Text> : null}
                <View style={styles.protoCtaCol}>
                    <Pressable
                        onPress={onRetry}
                        style={({ pressed }) => [
                            styles.protoCta,
                            { backgroundColor: pressed ? PROTO_COLORS.terra + 'CC' : PROTO_COLORS.terra },
                        ]}
                        accessibilityLabel="Try again"
                    >
                        <Text style={styles.protoCtaText}>Try again</Text>
                        <Text style={styles.protoCtaArrow}>↻</Text>
                    </Pressable>
                    <Pressable
                        onPress={onDismiss}
                        style={({ pressed }) => [styles.protoCtaGhost, { opacity: pressed ? 0.6 : 1 }]}
                        accessibilityLabel="Cancel"
                    >
                        <Text style={[styles.protoGhostText, { color: PROTO_COLORS.muted }]}>Cancel</Text>
                    </Pressable>
                </View>
            </Animated.View>
        </Animated.View>
    );
}

function NetworkOverlay({ onDismiss, onRetry }: { onDismiss: () => void; onRetry: () => void }) {
    const cardScale = useSharedValue(0.88);
    const cardOpacity = useSharedValue(0);

    useEffect(() => {
        cardScale.value = withSpring(1, { damping: 18, stiffness: 180 });
        cardOpacity.value = withTiming(1, { duration: 240 });
    }, [cardScale, cardOpacity]);

    const cardStyle = useAnimatedStyle(() => ({
        transform: [{ scale: cardScale.value }],
        opacity: cardOpacity.value,
    }));

    // Calm slate — not a hard failure, just "no signal; we'll retry".
    const slate = '#6E7E89';
    const slateTint = '#DCE3E7';

    return (
        <Animated.View entering={FadeIn.duration(240)} style={styles.protoOverlay}>
            <Animated.View style={[styles.protoCard, cardStyle]}>
                <View style={[styles.protoIconRing, { backgroundColor: slateTint, borderColor: slate }]}>
                    <Ionicons name="cloud-offline-outline" size={30} color={slate} />
                </View>
                <Text style={styles.protoTitle}>No connection</Text>
                <Text style={styles.protoSub}>
                    We couldn&apos;t reach the server. We&apos;ll try again automatically once you&apos;re back online.
                </Text>
                <View style={styles.protoCtaCol}>
                    <Pressable
                        onPress={onRetry}
                        style={({ pressed }) => [
                            styles.protoCta,
                            { backgroundColor: pressed ? PROTO_COLORS.terra + 'CC' : PROTO_COLORS.terra },
                        ]}
                        accessibilityLabel="Try again"
                    >
                        <Text style={styles.protoCtaText}>Try again</Text>
                        <Text style={styles.protoCtaArrow}>↻</Text>
                    </Pressable>
                    <Pressable
                        onPress={onDismiss}
                        style={({ pressed }) => [styles.protoCtaGhost, { opacity: pressed ? 0.6 : 1 }]}
                        accessibilityLabel="Cancel"
                    >
                        <Text style={[styles.protoGhostText, { color: PROTO_COLORS.muted }]}>Cancel</Text>
                    </Pressable>
                </View>
            </Animated.View>
        </Animated.View>
    );
}

function ProcessingOverlay() {
    return (
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={styles.resultOverlay}>
            <ActivityIndicator size="large" color="#FFFFFF" style={{ marginBottom: 20 }} />
            <Text style={styles.processingText}>Processing...</Text>
        </Animated.View>
    );
}

// ── Circle mask overlay ────────────────────────────────────

function CircleMaskOverlay({ width, height, borderColor }: { width: number; height: number; borderColor: string }) {
    if (width === 0 || height === 0) return null;

    const cx = width / 2;
    const cy = height / 2 - 40; // lift slightly to leave room for prompt
    const r = Math.min(width * 0.38, 160);

    return (
        <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
            <Defs>
                <Mask id="faceHole">
                    <Rect x={0} y={0} width={width} height={height} fill="white" />
                    <SvgCircle cx={cx} cy={cy} r={r} fill="black" />
                </Mask>
            </Defs>
            <Rect x={0} y={0} width={width} height={height} fill="rgba(0,0,0,0.55)" mask="url(#faceHole)" />
            <SvgCircle cx={cx} cy={cy} r={r} stroke={borderColor} strokeWidth={4} fill="none" />
        </Svg>
    );
}

// ── Main component ─────────────────────────────────────────

export function FaceCaptureFlow({ mode, onPhotoCaptured, onDismiss, showDebug = __DEV__ }: FaceCaptureFlowProps) {
    const { colors } = useTheme();
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const { isConnected, isInternetReachable } = useNetworkStatus();
    const cameraRef = useRef<CameraRef>(null);

    const device = useCameraDevice('front');
    const { hasPermission, requestPermission } = useCameraPermission();
    const photoOutput = usePhotoOutput({ quality: 0.5, qualityPrioritization: 'speed' });

    // State — the camera starts mounted + scanning on mount
    const [step, setStep] = useState<LivenessStep>('look_straight');
    const [cameraMounted, setCameraMounted] = useState(true);
    const [scanning, setScanning] = useState(true);
    const [displayYaw, setDisplayYaw] = useState(0);
    const [displayFace, setDisplayFace] = useState(false);
    const [captureCount, setCaptureCount] = useState(0);
    const [processing, setProcessing] = useState(false);
    const [showResult, setShowResult] = useState<'pass' | 'fail' | 'network' | null>(null);
    const [failMessage, setFailMessage] = useState<string | null>(null);
    const [cameraLayout, setCameraLayout] = useState({ width: 0, height: 0 });

    const handleCameraLayout = useCallback((e: LayoutChangeEvent) => {
        const { width, height } = e.nativeEvent.layout;
        setCameraLayout({ width, height });
    }, []);

    // Refs for async detection loop
    const stepRef = useRef<LivenessStep>('look_straight');
    const scanningRef = useRef(false);
    const captureCountRef = useRef(0);
    // Counter used to throttle dev scan logs to 1 line every 10 captures.
    const scanLogCounterRef = useRef(0);
    const straightPhotoRef = useRef<string | null>(null);
    stepRef.current = step;

    // Connectivity — read inside processPhoto without re-creating it on every
    // network change. `isOnlineRef` mirrors the live online state; `retryingRef`
    // de-dupes the reconnect auto-retry; `prevOnlineRef` tracks the prior state.
    const isOnlineRef = useRef(true);
    isOnlineRef.current = isConnected && isInternetReachable !== false;
    const retryingRef = useRef(false);
    const prevOnlineRef = useRef(true);

    // ── Permission ───────────────────────────────────────

    useEffect(() => {
        if (!hasPermission) requestPermission();
    }, [hasPermission, requestPermission]);

    // ── Max brightness for better Rekognition input ─────

    useEffect(() => {
        setMaxBrightness();
        return () => {
            restoreBrightness();
        };
    }, []);

    // ── Hide tab bar for full-screen camera UX ──────────
    //
    // Rebuild the original tabBarStyle explicitly on cleanup — setting it
    // to `undefined` doesn't restore the screenOptions defaults, it falls
    // back to RN's built-in white bar.
    useEffect(() => {
        const tabNav = navigation.getParent();
        if (!tabNav) return;
        const navBarInset = Platform.OS === 'android' ? insets.bottom : 0;
        const originalStyle = {
            backgroundColor: colors.tabBar,
            borderTopColor: colors.tabBarBorder,
            borderTopWidth: 0.5,
            elevation: 0,
            paddingBottom: TAB_BAR_PADDING_BOTTOM + navBarInset,
            paddingTop: TAB_BAR_PADDING_TOP,
            height: TAB_BAR_HEIGHT + navBarInset,
        };
        tabNav.setOptions({ tabBarStyle: { display: 'none' } });
        return () => {
            tabNav.setOptions({ tabBarStyle: originalStyle });
        };
    }, [navigation, colors.tabBar, colors.tabBarBorder, insets.bottom]);

    // ── Snapshot-based face detection loop ──────────────

    // Declared early so the scan loop useEffect can call it without TDZ.
    // Values read via refs so this callback never needs to be re-created.
    const processPhoto = useCallback(async () => {
        setScanning(false);
        let waitAttempts = 0;
        while (scanningRef.current && waitAttempts < 20) {
            await new Promise((r) => setTimeout(r, 100));
            waitAttempts++;
        }
        // On Android, fully unmount the camera so the next flow gets a fresh session.
        if (Platform.OS === 'android') {
            setCameraMounted(false);
        }
        setProcessing(true);

        const photoPath = straightPhotoRef.current;
        if (!photoPath) {
            setProcessing(false);
            setFailMessage('No photo captured. Please try again.');
            setShowResult('fail');
            return;
        }

        // Route a failure to the right overlay: a connectivity failure gets the
        // "No connection" overlay (auto-retries on reconnect); a quality
        // rejection or server error gets the standard fail overlay.
        const showFailure = (message: string) => {
            restoreBrightness();
            setProcessing(false);
            setFailMessage(message);
            if (isConnectivityError(message)) {
                retryingRef.current = false; // arm one reconnect auto-retry
                setShowResult('network');
            } else {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                setShowResult('fail');
            }
        };

        // Offline pre-check — skip the upload (and the ~30s timeout wait)
        // entirely when we already know there's no connection.
        if (!isOnlineRef.current) {
            showFailure('Failed to send a request to the Edge Function');
            return;
        }

        try {
            const result = await onPhotoCaptured(photoPath);

            if (result.ok) {
                restoreBrightness();
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setShowResult('pass');
                // On iOS the tick morph plays in FaceTurnPrompt during the
                // MORPH_DELAY_MS window before the success overlay fades in, so
                // hide the ProcessingOverlay immediately. On Android the camera
                // was unmounted, so keep ProcessingOverlay visible for the same
                // window to avoid a blank frame.
                if (Platform.OS === 'android') {
                    setTimeout(() => setProcessing(false), MORPH_DELAY_MS);
                } else {
                    setProcessing(false);
                }
            } else {
                showFailure(result.message);
            }
        } catch (err) {
            console.error('[FaceCaptureFlow] ERROR:', err instanceof Error ? err.message : String(err));
            showFailure(err instanceof Error ? err.message : 'An unexpected error occurred.');
        }
    }, [onPhotoCaptured]);

    useEffect(() => {
        if (!scanning) return;
        let cancelled = false;

        const tick = async () => {
            if (cancelled || scanningRef.current) return;
            scanningRef.current = true;

            try {
                if (cancelled) {
                    scanningRef.current = false;
                    return;
                }
                const t0 = Date.now();
                const photoFile = await photoOutput.capturePhotoToFile(
                    { flashMode: 'off', enableShutterSound: false },
                    {},
                );
                const t1 = Date.now();
                if (!photoFile?.filePath || cancelled) {
                    scanningRef.current = false;
                    if (!cancelled) setTimeout(tick, SCAN_INTERVAL_MS);
                    return;
                }

                const faces = await detectFaces(photoFile.filePath);
                const t2 = Date.now();
                // Throttle dev logs — every 10th capture is enough to gauge perf
                // without drowning the console. Bump to 1 if you need per-tick detail.
                if (__DEV__ && scanLogCounterRef.current++ % 10 === 0) {
                    console.log(`[FaceScan] capture=${t1 - t0}ms detect=${t2 - t1}ms total=${t2 - t0}ms`);
                }

                if (cancelled) {
                    scanningRef.current = false;
                    return;
                }

                if (faces.length > 0) {
                    const face = faces[0];
                    const yaw = -face.yaw;
                    setDisplayYaw(Math.round(yaw * 10) / 10);
                    setDisplayFace(true);

                    if (stepRef.current === 'look_straight') {
                        straightPhotoRef.current = photoFile.filePath;
                    }

                    const currentStep = stepRef.current;
                    if (currentStep !== 'done') {
                        let shouldAdvance = false;
                        if (currentStep === 'look_straight' && Math.abs(yaw) < YAW_STRAIGHT_MAX) {
                            shouldAdvance = true;
                        } else if (currentStep === 'turn_left' && yaw < YAW_LEFT_THRESHOLD) {
                            shouldAdvance = true;
                        } else if (currentStep === 'turn_right' && yaw > YAW_RIGHT_THRESHOLD) {
                            shouldAdvance = true;
                        }

                        if (shouldAdvance) {
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            captureCountRef.current += 1;
                            setCaptureCount(captureCountRef.current);

                            if (currentStep === 'look_straight') {
                                stepRef.current = 'turn_left';
                                setStep('turn_left');
                            } else if (currentStep === 'turn_left') {
                                stepRef.current = 'turn_right';
                                setStep('turn_right');
                            } else if (currentStep === 'turn_right') {
                                stepRef.current = 'done';
                                setStep('done');
                                scanningRef.current = false;
                                processPhoto();
                                return;
                            }
                        }
                    }
                } else {
                    setDisplayFace(false);
                }
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                // "Camera is closed" is expected during teardown between flows on Android
                if (!msg.includes('Camera is closed')) {
                    console.error('[FaceScan] ERROR:', msg);
                }
            }

            scanningRef.current = false;
            if (!cancelled) setTimeout(tick, SCAN_INTERVAL_MS);
        };

        setTimeout(tick, 500);
        return () => {
            cancelled = true;
        };
    }, [scanning, photoOutput, processPhoto]);

    // ── Handlers ─────────────────────────────────────────

    const handleCancel = useCallback(() => {
        setScanning(false);
        restoreBrightness();
        onDismiss();
    }, [onDismiss]);

    const handleDismissResult = useCallback(() => {
        setShowResult(null);
        setFailMessage(null);
        onDismiss();
    }, [onDismiss]);

    const handleRetry = useCallback(() => {
        // Reset everything and start the same flow fresh.
        retryingRef.current = false;
        setShowResult(null);
        setFailMessage(null);
        setStep('look_straight');
        stepRef.current = 'look_straight';
        captureCountRef.current = 0;
        setCaptureCount(0);
        scanningRef.current = false;
        straightPhotoRef.current = null;
        setMaxBrightness();
        setCameraMounted(true);
        setScanning(true);
    }, []);

    // Auto-retry the capture once connectivity returns after a network failure.
    // Gate on isInternetReachable too — isConnected initializes true and a
    // transient drop may never flip it, so manual "Try again" stays the fallback
    // for those cases. retryingRef de-dupes against repeated connectivity ticks.
    useEffect(() => {
        const online = isConnected && isInternetReachable !== false;
        const wasOffline = !prevOnlineRef.current;
        prevOnlineRef.current = online;
        if (showResult === 'network' && online && wasOffline && !retryingRef.current) {
            retryingRef.current = true;
            handleRetry();
        }
    }, [isConnected, isInternetReachable, showResult, handleRetry]);

    // ── Render ───────────────────────────────────────────

    const copy = getModeCopy(mode);
    const successTitleNode = (
        <>
            {copy.successLead}
            <Text style={styles.protoTitleItalic}>{copy.successAccent}</Text>
            {copy.successTail}
        </>
    );

    const e2eBypassEnabledEarly = process.env.EXPO_PUBLIC_E2E_FACE_BYPASS === '1';

    // E2E test render path — iOS simulators have no camera, so the main
    // render's <Camera /> would error and the overlays nested inside it
    // would never display. This dedicated branch shows the bypass button
    // and the same success/fail overlays the real flow uses.
    if (e2eBypassEnabledEarly && !device) {
        return (
            <View style={{ flex: 1, backgroundColor: '#000' }}>
                <View
                    pointerEvents="none"
                    style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.7)' }]}
                />
                {!showResult ? (
                    <Pressable
                        testID="face-capture-e2e-bypass"
                        onPress={() => {
                            straightPhotoRef.current = 'e2e-bypass.jpg';
                            processPhoto();
                        }}
                        style={{
                            position: 'absolute',
                            top: insets.top + 80,
                            alignSelf: 'center',
                            backgroundColor: '#FFFFFF',
                            paddingHorizontal: 20,
                            paddingVertical: 12,
                            borderRadius: 10,
                        }}
                    >
                        <Text style={{ color: '#000', fontSize: 14, fontWeight: '600' }}>Skip face check (E2E)</Text>
                    </Pressable>
                ) : null}
                {showResult === 'pass' && (
                    <SuccessOverlay
                        titleNode={successTitleNode}
                        sub={copy.successSub}
                        cta={copy.successCta}
                        onDismiss={handleDismissResult}
                    />
                )}
                {showResult === 'network' && <NetworkOverlay onDismiss={handleDismissResult} onRetry={handleRetry} />}
                {showResult === 'fail' && (
                    <FailedOverlay
                        onDismiss={handleDismissResult}
                        onRetry={handleRetry}
                        title={mode === 'register' ? 'Registration Failed' : 'Verification Failed'}
                        subtitle={failMessage ?? undefined}
                    />
                )}
            </View>
        );
    }

    if (!device || !hasPermission) {
        return (
            <View style={[styles.container, styles.permissionContainer]}>
                <Text style={styles.permissionText}>
                    {!device ? 'No camera available' : 'Camera permission required'}
                </Text>
                <Pressable style={[styles.cancelButton, { alignSelf: 'center', marginTop: 24 }]} onPress={onDismiss}>
                    <Text style={styles.cancelText}>Back</Text>
                </Pressable>
            </View>
        );
    }

    const failTitle = mode === 'register' ? 'Registration Failed' : 'Verification Failed';

    // ── Prototype status tick semantics ──
    // Proximity: already passed by parent useCheckInFlow before this modal opens.
    const proximityPassed = true;
    // Liveness: progresses with captureCount (0→1→2→3). Sage when all 3 done.
    const livenessPassed = captureCount >= 3;
    const livenessText = livenessPassed ? '3/3 ok' : `${captureCount}/3 scanning…`;
    // Match: Rekognition + optional re-proximity. Sage on showResult=pass.
    const matchPassed = showResult === 'pass';
    const matchText = matchPassed ? 'match ok' : processing ? 'verifying…' : livenessPassed ? 'queued' : 'queued';

    const ovalBorder = livenessPassed ? PROTO_COLORS.sage : PROTO_COLORS.terra;

    // E2E bypass — when the build was produced with the env flag set, render
    // a single button that calls onPhotoCaptured with a dummy path. verifyFace
    // / registerFace short-circuit on the same flag, so the dummy path is
    // never read. Camera + Rekognition can't be driven by Maestro otherwise.
    const e2eBypassEnabled = process.env.EXPO_PUBLIC_E2E_FACE_BYPASS === '1';

    return (
        <View style={{ flex: 1 }}>
            {/* Backdrop — tap to cancel */}
            <Pressable
                style={StyleSheet.absoluteFill}
                onPress={!processing && !showResult ? handleCancel : undefined}
                accessibilityLabel="Dismiss face capture"
            />
            <View
                pointerEvents="none"
                style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.7)' }]}
            />

            {e2eBypassEnabled && !processing && !showResult ? (
                <Pressable
                    testID="face-capture-e2e-bypass"
                    onPress={() => {
                        straightPhotoRef.current = 'e2e-bypass.jpg';
                        processPhoto();
                    }}
                    style={{
                        position: 'absolute',
                        top: insets.top + 12,
                        alignSelf: 'center',
                        backgroundColor: '#FFFFFF',
                        paddingHorizontal: 16,
                        paddingVertical: 8,
                        borderRadius: 8,
                        zIndex: 9999,
                    }}
                >
                    <Text style={{ color: '#000', fontSize: 12, fontWeight: '600' }}>Skip face check (E2E)</Text>
                </Pressable>
            ) : null}

            {/* Bottom sheet shell — stays mounted through processing + result so
                the Camera never remounts mid-flow. Overlays (Processing / Pass /
                Fail) render ABOVE with their own backdrops and visually cover
                the sheet. Unmounting + remounting the <Camera> on rapid
                verification cycles leaks native resources on iOS and crashes
                the app. */}
            {cameraMounted && (
                <View
                    style={[
                        styles.sheet,
                        {
                            backgroundColor: PROTO_COLORS.paper,
                            paddingBottom: insets.bottom + 20,
                        },
                    ]}
                >
                    {/* Drag handle */}
                    <View style={styles.handle} />

                    {/* Eyebrow + title */}
                    <Text style={styles.eyebrow}>{copy.eyebrow}</Text>
                    <Text style={styles.title}>
                        {copy.titleLead}
                        <Text style={styles.titleItalic}>{copy.titleAccent}</Text>
                        {copy.titleTail}
                    </Text>

                    {/* Viewfinder: 3:4 aspect, dark bg, camera inside */}
                    <View style={styles.viewfinder} onLayout={handleCameraLayout}>
                        <Camera
                            ref={cameraRef}
                            style={StyleSheet.absoluteFill}
                            device={device}
                            isActive={cameraMounted}
                            outputs={[photoOutput]}
                        />

                        {/* Oval vignette mask + dashed border */}
                        {cameraLayout.width > 0 && cameraLayout.height > 0 && (
                            <OvalVignette
                                width={cameraLayout.width}
                                height={cameraLayout.height}
                                borderColor={ovalBorder}
                            />
                        )}

                        {/* Scanning shimmer bar inside the oval */}
                        {!livenessPassed && cameraLayout.width > 0 && (
                            <View
                                pointerEvents="none"
                                style={[
                                    styles.shimmerBand,
                                    {
                                        top: cameraLayout.height / 2 - 1,
                                        left: cameraLayout.width * 0.13,
                                        right: cameraLayout.width * 0.13,
                                    },
                                ]}
                            >
                                <ShimmerOverlay
                                    color={PROTO_COLORS.terra}
                                    intensity="cc"
                                    durationMs={1400}
                                    radius={0}
                                />
                            </View>
                        )}

                        {/* 4 corner crop marks */}
                        <View pointerEvents="none" style={[styles.corner, styles.cornerTopLeft]} />
                        <View pointerEvents="none" style={[styles.corner, styles.cornerTopRight]} />
                        <View pointerEvents="none" style={[styles.corner, styles.cornerBottomLeft]} />
                        <View pointerEvents="none" style={[styles.corner, styles.cornerBottomRight]} />

                        {/* Italic prompt inside viewfinder */}
                        <View style={styles.viewfinderPromptWrap} pointerEvents="none">
                            <Text style={styles.viewfinderPrompt}>{VIEWFINDER_PROMPTS[step]}</Text>
                        </View>

                        {/* Dev debug */}
                        {showDebug ? (
                            <View style={styles.debugOverlay}>
                                <Text style={styles.debugText}>Yaw: {displayYaw}°</Text>
                                <Text style={styles.debugText}>Face: {displayFace ? 'YES' : 'NO'}</Text>
                                <Text style={styles.debugText}>Step: {step}</Text>
                            </View>
                        ) : null}
                    </View>

                    {/* 3 status ticks */}
                    <View style={styles.tickRow}>
                        {copy.showProximityTick && (
                            <StatusTick label="Proximity" passed={proximityPassed} text="100m OK" />
                        )}
                        <StatusTick label="Liveness" passed={livenessPassed} text={livenessText} />
                        {copy.showMatchTick ? (
                            <StatusTick label="Match" passed={matchPassed} text={matchText} />
                        ) : (
                            <>
                                <StatusTick
                                    label="Photo"
                                    passed={livenessPassed}
                                    text={livenessPassed ? 'ready' : '—'}
                                />
                                <StatusTick
                                    label="Save"
                                    passed={matchPassed}
                                    text={matchPassed ? 'saved' : processing ? 'saving…' : 'queued'}
                                />
                            </>
                        )}
                    </View>

                    {/* CTA (informational — scan auto-progresses) */}
                    <View
                        style={[
                            styles.cta,
                            {
                                backgroundColor: livenessPassed ? PROTO_COLORS.terra : PROTO_COLORS.paperEl,
                                borderColor: livenessPassed ? PROTO_COLORS.terra : PROTO_COLORS.rule,
                            },
                        ]}
                    >
                        <Text
                            style={[
                                styles.ctaText,
                                {
                                    color: livenessPassed ? PROTO_COLORS.paperEl : PROTO_COLORS.ink,
                                },
                            ]}
                        >
                            {livenessPassed ? copy.ctaActive : copy.ctaCapturing}
                        </Text>
                        {livenessPassed ? (
                            <Text style={[styles.ctaArrow, { color: PROTO_COLORS.paperEl }]}>→</Text>
                        ) : null}
                    </View>
                </View>
            )}

            {/* Overlays rendered at top level so they survive camera unmount on Android */}
            {processing && <ProcessingOverlay />}
            {showResult === 'pass' && (
                <SuccessOverlay
                    titleNode={successTitleNode}
                    sub={copy.successSub}
                    cta={copy.successCta}
                    onDismiss={handleDismissResult}
                />
            )}
            {showResult === 'network' && <NetworkOverlay onDismiss={handleDismissResult} onRetry={handleRetry} />}
            {showResult === 'fail' && (
                <FailedOverlay
                    onDismiss={handleDismissResult}
                    onRetry={handleRetry}
                    title={failTitle}
                    subtitle={failMessage ?? undefined}
                />
            )}
        </View>
    );
}

// ── Prototype tokens ──
const PROTO_COLORS = {
    paper: '#FAF5EA',
    paperEl: '#FFFFFF',
    ink: '#1B1A17',
    muted: 'rgba(27,26,23,0.62)',
    dim: 'rgba(27,26,23,0.42)',
    faint: 'rgba(27,26,23,0.12)',
    rule: 'rgba(27,26,23,0.09)',
    hair: 'rgba(27,26,23,0.05)',
    terra: '#C85A2F',
    sage: '#7A8C6B',
    cream: '#F4EEE1',
};

// ── Oval vignette mask (SVG rect-minus-ellipse with evenodd fill + dashed ellipse border) ──
function OvalVignette({ width, height, borderColor }: { width: number; height: number; borderColor: string }) {
    const ovalW = width * 0.62;
    const ovalH = Math.min(ovalW * (4 / 3), height * 0.92);
    const cx = width / 2;
    const cy = height / 2;
    const rx = ovalW / 2;
    const ry = ovalH / 2;

    // Outer rectangle, then ellipse path (fillRule evenodd carves the ellipse out)
    const d = [
        `M0 0 H${width} V${height} H0 Z`,
        `M ${cx} ${cy - ry}`,
        `A ${rx} ${ry} 0 1 0 ${cx} ${cy + ry}`,
        `A ${rx} ${ry} 0 1 0 ${cx} ${cy - ry}`,
        'Z',
    ].join(' ');

    return (
        <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
            <SvgPath d={d} fill="rgba(0,0,0,0.55)" fillRule="evenodd" />
            <SvgEllipse
                cx={cx}
                cy={cy}
                rx={rx}
                ry={ry}
                stroke={borderColor}
                strokeWidth={2}
                strokeDasharray="6 4"
                fill="none"
            />
        </Svg>
    );
}

// ── Status tick (prototype's Proximity/Liveness/Match tile) ──
function StatusTick({ label, passed, text }: { label: string; passed: boolean; text: string }) {
    return (
        <View style={styles.tick}>
            <Text style={styles.tickLabel}>{label.toUpperCase()}</Text>
            <View style={styles.tickStatus}>
                <View style={[styles.tickDot, { backgroundColor: passed ? PROTO_COLORS.sage : PROTO_COLORS.faint }]} />
                <Text style={[styles.tickText, { color: passed ? PROTO_COLORS.sage : PROTO_COLORS.muted }]}>
                    {text}
                </Text>
            </View>
        </View>
    );
}

// ── Styles ─────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000000' },
    permissionContainer: { justifyContent: 'center', alignItems: 'center', padding: 32 },
    permissionText: { color: '#FFFFFF', fontSize: 16, textAlign: 'center' },
    cameraContainer: { flex: 1 },

    // Bottom sheet shell (prototype RSFaceCapture)
    sheet: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 20,
        paddingTop: 14,
        borderTopLeftRadius: 22,
        borderTopRightRadius: 22,
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 40,
        shadowOffset: { width: 0, height: -10 },
        elevation: 24,
    },
    handle: {
        width: 40,
        height: 4,
        borderRadius: 3,
        backgroundColor: PROTO_COLORS.faint,
        alignSelf: 'center',
        marginBottom: 10,
    },
    eyebrow: {
        fontFamily: 'Inter-SemiBold',
        fontSize: 10.5,
        letterSpacing: 1.2,
        color: PROTO_COLORS.terra,
    },
    title: {
        fontFamily: 'Fraunces',
        fontWeight: '500',
        fontSize: 22,
        letterSpacing: -0.4,
        lineHeight: 26,
        marginTop: 4,
        color: PROTO_COLORS.ink,
    },
    titleItalic: {
        fontFamily: 'Fraunces-Italic',
        fontWeight: '500',
        color: PROTO_COLORS.terra,
    },

    // Viewfinder (3:4 dark container)
    viewfinder: {
        marginTop: 16,
        aspectRatio: 3 / 4,
        backgroundColor: '#111',
        borderRadius: 20,
        overflow: 'hidden',
        position: 'relative',
    },
    shimmerBand: {
        position: 'absolute',
        height: 2,
    },

    // Corner crop marks — 18x18 L-brackets
    corner: {
        position: 'absolute',
        width: 18,
        height: 18,
    },
    cornerTopLeft: {
        top: 8,
        left: 8,
        borderTopWidth: 2,
        borderLeftWidth: 2,
        borderColor: PROTO_COLORS.cream,
    },
    cornerTopRight: {
        top: 8,
        right: 8,
        borderTopWidth: 2,
        borderRightWidth: 2,
        borderColor: PROTO_COLORS.cream,
    },
    cornerBottomLeft: {
        bottom: 8,
        left: 8,
        borderBottomWidth: 2,
        borderLeftWidth: 2,
        borderColor: PROTO_COLORS.cream,
    },
    cornerBottomRight: {
        bottom: 8,
        right: 8,
        borderBottomWidth: 2,
        borderRightWidth: 2,
        borderColor: PROTO_COLORS.cream,
    },

    // Viewfinder prompt (italic serif)
    viewfinderPromptWrap: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 14,
        alignItems: 'center',
    },
    viewfinderPrompt: {
        fontFamily: 'Fraunces-Italic',
        fontSize: 15,
        color: PROTO_COLORS.cream,
        textShadowColor: 'rgba(0,0,0,0.7)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },

    // Status ticks row
    tickRow: {
        marginTop: 14,
        flexDirection: 'row',
        gap: 8,
    },
    tick: {
        flex: 1,
        backgroundColor: PROTO_COLORS.paperEl,
        borderWidth: 1,
        borderColor: PROTO_COLORS.rule,
        borderRadius: 10,
        paddingVertical: 8,
        paddingHorizontal: 10,
    },
    tickLabel: {
        fontFamily: 'Inter-SemiBold',
        fontSize: 9.5,
        letterSpacing: 0.7,
        color: PROTO_COLORS.muted,
    },
    tickStatus: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 2,
    },
    tickDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    tickText: {
        fontFamily: 'Inter-SemiBold',
        fontSize: 11,
    },

    // CTA (informational, follows prototype Check me in / Capturing pattern)
    cta: {
        marginTop: 14,
        borderRadius: 14,
        paddingVertical: 14,
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    ctaText: {
        fontFamily: 'Fraunces',
        fontWeight: '500',
        fontSize: 16,
        letterSpacing: -0.2,
    },
    ctaArrow: {
        fontFamily: 'Fraunces-Italic',
        fontSize: 16,
        opacity: 0.85,
    },

    // ── Prototype-styled success/fail card overlays ──
    protoOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.45)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    protoCard: {
        width: '82%',
        backgroundColor: PROTO_COLORS.paper,
        borderRadius: 22,
        paddingHorizontal: 26,
        paddingTop: 28,
        paddingBottom: 22,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOpacity: 0.3,
        shadowRadius: 50,
        shadowOffset: { width: 0, height: 20 },
        elevation: 24,
    },
    protoIconRing: {
        width: 72,
        height: 72,
        borderRadius: 36,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    protoIconGlyph: {
        fontSize: 32,
        lineHeight: 36,
        fontFamily: 'Fraunces',
        fontWeight: '500',
    },
    protoTitle: {
        fontFamily: 'Fraunces',
        fontWeight: '500',
        fontSize: 24,
        letterSpacing: -0.4,
        lineHeight: 28,
        color: PROTO_COLORS.ink,
        textAlign: 'center',
    },
    protoTitleItalic: {
        fontFamily: 'Fraunces-Italic',
        fontWeight: '500',
        color: PROTO_COLORS.sage,
    },
    protoSub: {
        fontFamily: 'Fraunces-Italic',
        fontSize: 14,
        marginTop: 6,
        color: PROTO_COLORS.muted,
        textAlign: 'center',
        lineHeight: 20,
    },
    protoCtaCol: {
        width: '100%',
        marginTop: 18,
        gap: 8,
    },
    protoCta: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 14,
        gap: 8,
    },
    protoCtaText: {
        color: '#FFFFFF',
        fontFamily: 'Fraunces',
        fontWeight: '500',
        fontSize: 16,
        letterSpacing: -0.2,
    },
    protoCtaArrow: {
        color: '#FFFFFF',
        fontFamily: 'Fraunces-Italic',
        fontSize: 16,
        opacity: 0.85,
    },
    protoCtaGhost: {
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
    },
    protoGhostText: {
        fontFamily: 'Fraunces',
        fontWeight: '500',
        fontSize: 14,
        letterSpacing: -0.2,
    },

    // (deprecated full-bleed styles kept below for legacy references — unused)
    promptContainer: {
        position: 'absolute',
        bottom: 80,
        left: 0,
        right: 0,
        alignItems: 'center',
        gap: 10,
    },
    promptText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '600',
        textAlign: 'center',
        alignSelf: 'stretch',
        textShadowColor: 'rgba(0,0,0,0.7)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
        paddingHorizontal: 20,
    },
    debugOverlay: {
        position: 'absolute',
        top: 80,
        left: 16,
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderRadius: 8,
        padding: 8,
    },
    debugText: {
        color: '#00FF00',
        fontSize: 12,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        lineHeight: 18,
    },
    cancelButtonWrapper: {
        position: 'absolute',
        bottom: 16,
        left: 0,
        right: 0,
        alignItems: 'center',
    },
    cancelButton: {
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 32,
        paddingVertical: 14,
        borderRadius: 25,
    },
    cancelText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
    resultOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.75)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    successCircle: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: '#34C759',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    failCircle: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: '#FF3B30',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    failText: { color: '#FFFFFF', fontSize: 24, fontWeight: '700', marginBottom: 8 },
    failSubtitle: {
        color: '#FFFFFF',
        fontSize: 14,
        opacity: 0.85,
        textAlign: 'center',
        paddingHorizontal: 32,
        marginBottom: 24,
    },
    processingText: { color: '#FFFFFF', fontSize: 20, fontWeight: '600' },
    failButtons: { gap: 12, marginTop: 8 },
    retryButton: {
        backgroundColor: '#FF9500',
        paddingHorizontal: 40,
        paddingVertical: 14,
        borderRadius: 25,
    },
    retryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', textAlign: 'center' },
    dismissButton: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 40,
        paddingVertical: 14,
        borderRadius: 25,
    },
    dismissText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', textAlign: 'center' },
});
