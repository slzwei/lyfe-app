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
import { TAB_BAR_HEIGHT, TAB_BAR_PADDING_BOTTOM, TAB_BAR_PADDING_TOP } from '@/constants/platform';
import { useTheme } from '@/contexts/ThemeContext';
import type { FaceQualityReason } from '@/lib/faceVerification';
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
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle as SvgCircle, Defs, Mask, Rect } from 'react-native-svg';
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

// ── Result overlays ────────────────────────────────────────

function CheckedInOverlay({ onDismiss }: { onDismiss: () => void }) {
    const scale = useSharedValue(0);

    useEffect(() => {
        // Delay the pop-in so the brackets→ring→tick morph in FaceTurnPrompt
        // has time to play before the overlay covers it.
        scale.value = withDelay(MORPH_DELAY_MS, withSpring(1, { damping: 12, stiffness: 150 }));
    }, [scale]);

    const circleStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    return (
        <Animated.View entering={FadeIn.delay(MORPH_DELAY_MS).duration(300)} style={styles.resultOverlay}>
            <Animated.View style={[styles.successCircle, circleStyle]}>
                <Ionicons name="checkmark" size={64} color="#FFFFFF" />
            </Animated.View>
            <Animated.View entering={FadeIn.delay(MORPH_DELAY_MS + 300).duration(300)}>
                <Pressable style={styles.dismissButton} onPress={onDismiss}>
                    <Text style={styles.dismissText}>Done</Text>
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
    return (
        <Animated.View entering={FadeIn.duration(200)} style={styles.resultOverlay}>
            <Animated.View entering={ZoomIn.duration(300)} style={styles.failCircle}>
                <Ionicons name="close" size={64} color="#FFFFFF" />
            </Animated.View>
            <Animated.Text entering={FadeIn.delay(300).duration(300)} style={styles.failText}>
                {title}
            </Animated.Text>
            {subtitle && (
                <Animated.Text entering={FadeIn.delay(400).duration(300)} style={styles.failSubtitle}>
                    {subtitle}
                </Animated.Text>
            )}
            <Animated.View entering={FadeIn.delay(500).duration(300)} style={styles.failButtons}>
                <Pressable style={styles.retryButton} onPress={onRetry}>
                    <Text style={styles.retryText}>Try Again</Text>
                </Pressable>
                <Pressable style={styles.dismissButton} onPress={onDismiss}>
                    <Text style={styles.dismissText}>Cancel</Text>
                </Pressable>
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
    const [showResult, setShowResult] = useState<'pass' | 'fail' | null>(null);
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
    const straightPhotoRef = useRef<string | null>(null);
    stepRef.current = step;

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

        try {
            const result = await onPhotoCaptured(photoPath);
            restoreBrightness();

            if (result.ok) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setShowResult('pass');
                // On iOS the tick morph plays in FaceTurnPrompt during the
                // MORPH_DELAY_MS window before CheckedInOverlay fades in, so
                // hide the ProcessingOverlay immediately. On Android the
                // camera was unmounted, so keep ProcessingOverlay visible for
                // the same window to avoid a blank frame.
                if (Platform.OS === 'android') {
                    setTimeout(() => setProcessing(false), MORPH_DELAY_MS);
                } else {
                    setProcessing(false);
                }
            } else {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                setProcessing(false);
                setFailMessage(result.message);
                setShowResult('fail');
            }
        } catch (err) {
            console.error('[FaceCaptureFlow] ERROR:', err instanceof Error ? err.message : String(err));
            setProcessing(false);
            restoreBrightness();
            setFailMessage(err instanceof Error ? err.message : 'An unexpected error occurred.');
            setShowResult('fail');
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
                if (__DEV__) {
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

    // ── Render ───────────────────────────────────────────

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

    return (
        <View style={styles.container}>
            {cameraMounted && (
                <View style={styles.cameraContainer} onLayout={handleCameraLayout}>
                    <Camera
                        ref={cameraRef}
                        style={StyleSheet.absoluteFill}
                        device={device}
                        isActive={cameraMounted}
                        outputs={[photoOutput]}
                    />

                    {/* Circle mask: darkens everything outside the circular hole */}
                    <CircleMaskOverlay
                        width={cameraLayout.width}
                        height={cameraLayout.height}
                        borderColor={step === 'done' ? '#34C759' : displayFace ? '#FF9500' : '#FF3B30'}
                    />

                    {/* Step dots — hide once a result is shown */}
                    {!showResult && (
                        <View style={styles.stepIndicator}>
                            <View style={[styles.stepDot, captureCount >= 1 && styles.stepDotDone]} />
                            <View style={[styles.stepDot, captureCount >= 2 && styles.stepDotDone]} />
                            <View style={[styles.stepDot, captureCount >= 3 && styles.stepDotDone]} />
                        </View>
                    )}

                    {/* Face-turn prompt: animates based on current liveness step. Morphs
                        brackets → ring once all 3 photos are captured, then ring → checkmark
                        once the parent's onPhotoCaptured returns ok. Hidden on fail. */}
                    {showResult !== 'fail' && (
                        <View style={styles.promptContainer}>
                            <FaceTurnPrompt
                                direction={step === 'turn_left' ? 'left' : step === 'turn_right' ? 'right' : 'straight'}
                                size={96}
                                morphStage={
                                    showResult === 'pass' ? 'tick' : step === 'done' || processing ? 'ring' : 'live'
                                }
                            />
                            <Text style={styles.promptText}>{STEP_PROMPTS[step]}</Text>
                        </View>
                    )}

                    {/* Dev debug overlay — hide once a result is shown */}
                    {showDebug && !showResult && (
                        <View style={styles.debugOverlay}>
                            <Text style={styles.debugText}>Yaw: {displayYaw}°</Text>
                            <Text style={styles.debugText}>Face: {displayFace ? 'YES' : 'NO'}</Text>
                            <Text style={styles.debugText}>Step: {step}</Text>
                        </View>
                    )}

                    {/* Cancel button — hidden during processing / result */}
                    {!processing && !showResult && (
                        <View style={styles.cancelButtonWrapper} pointerEvents="box-none">
                            <Pressable style={styles.cancelButton} onPress={handleCancel}>
                                <Text style={styles.cancelText}>Cancel</Text>
                            </Pressable>
                        </View>
                    )}
                </View>
            )}

            {/* Overlays rendered at top level so they survive camera unmount on Android */}
            {processing && <ProcessingOverlay />}
            {showResult === 'pass' && <CheckedInOverlay onDismiss={handleDismissResult} />}
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

// ── Styles ─────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000000' },
    permissionContainer: { justifyContent: 'center', alignItems: 'center', padding: 32 },
    permissionText: { color: '#FFFFFF', fontSize: 16, textAlign: 'center' },
    cameraContainer: { flex: 1 },
    stepIndicator: {
        position: 'absolute',
        top: 60,
        alignSelf: 'center',
        flexDirection: 'row',
        gap: 10,
    },
    stepDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: 'rgba(255,255,255,0.3)',
        borderWidth: 1,
        borderColor: '#FFFFFF',
    },
    stepDotDone: { backgroundColor: '#34C759', borderColor: '#34C759' },
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
