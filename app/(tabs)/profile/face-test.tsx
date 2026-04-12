/**
 * DEV-ONLY: Face Verification Test Screen
 *
 * Camera preview with liveness detection (look straight, turn left, turn right).
 * After liveness passes, the "look straight" photo is sent to the verify-face
 * edge function which uses AWS Rekognition for comparison.
 */
import { useTheme } from '@/contexts/ThemeContext';
import { registerFace, verifyFace, MATCH_THRESHOLD } from '@/lib/faceVerification';
import { detectFaces, setMaxBrightness, restoreBrightness } from '../../../modules/face-detection/src';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Platform,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withSequence,
    withTiming,
    withSpring,
    withDelay,
    Easing,
    FadeIn,
    FadeOut,
    ZoomIn,
} from 'react-native-reanimated';
import {
    Camera,
    type CameraRef,
    useCameraDevice,
    useCameraPermission,
    usePhotoOutput,
} from 'react-native-vision-camera';

// ── Config ──────────────────────────────────────────────────

type TestPhase = 'idle' | 'registering' | 'verifying';
type LivenessStep = 'look_straight' | 'turn_left' | 'turn_right' | 'done';

const YAW_STRAIGHT_MAX = Platform.OS === 'android' ? 18 : 10;
const YAW_LEFT_THRESHOLD = -15;
const YAW_RIGHT_THRESHOLD = 15;
const SCAN_INTERVAL_MS = 400;

const STEP_PROMPTS: Record<LivenessStep, string> = {
    look_straight: 'Look straight at the camera',
    turn_left: 'Turn your head left',
    turn_right: 'Now turn your head right',
    done: 'Processing...',
};

// ── Animated Arrow ──────────────────────────────────────────

function AnimatedArrow({ direction }: { direction: 'left' | 'right' }) {
    const translateX = useSharedValue(0);

    useEffect(() => {
        const dist = direction === 'left' ? -12 : 12;
        translateX.value = withRepeat(
            withSequence(
                withTiming(dist, { duration: 600, easing: Easing.inOut(Easing.ease) }),
                withTiming(0, { duration: 600, easing: Easing.inOut(Easing.ease) }),
            ),
            -1,
            false,
        );
    }, [direction]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: translateX.value }],
    }));

    return (
        <Animated.Text style={[styles.arrowText, animatedStyle]}>
            {direction === 'left' ? '  <<<' : '>>>  '}
        </Animated.Text>
    );
}

// ── Success Overlay ─────────────────────────────────────────

function CheckedInOverlay({ onDismiss }: { onDismiss: () => void }) {
    const scale = useSharedValue(0);

    useEffect(() => {
        scale.value = withSpring(1, { damping: 12, stiffness: 150 });
    }, []);

    const circleStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    return (
        <Animated.View entering={FadeIn.duration(200)} style={styles.resultOverlay}>
            <Animated.View style={[styles.successCircle, circleStyle]}>
                <Ionicons name="checkmark" size={64} color="#FFFFFF" />
            </Animated.View>
            <Animated.Text entering={FadeIn.delay(300).duration(300)} style={styles.checkedInText}>
                Checked In
            </Animated.Text>
            <Animated.View entering={FadeIn.delay(600).duration(300)}>
                <Pressable style={styles.dismissButton} onPress={onDismiss}>
                    <Text style={styles.dismissText}>Done</Text>
                </Pressable>
            </Animated.View>
        </Animated.View>
    );
}

// ── Fail Overlay ────────────────────────────────────────────

function FailedOverlay({ onDismiss, onRetry }: { onDismiss: () => void; onRetry: () => void }) {
    return (
        <Animated.View entering={FadeIn.duration(200)} style={styles.resultOverlay}>
            <Animated.View entering={ZoomIn.duration(300)} style={styles.failCircle}>
                <Ionicons name="close" size={64} color="#FFFFFF" />
            </Animated.View>
            <Animated.Text entering={FadeIn.delay(300).duration(300)} style={styles.failText}>
                Face Not Recognized
            </Animated.Text>
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

// ── Processing Overlay ──────────────────────────────────────

function ProcessingOverlay() {
    return (
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={styles.resultOverlay}>
            <ActivityIndicator size="large" color="#FFFFFF" style={{ marginBottom: 20 }} />
            <Text style={styles.processingText}>Verifying...</Text>
        </Animated.View>
    );
}

// ── Component ───────────────────────────────────────────────

export default function FaceTestScreen() {
    const { colors } = useTheme();
    const router = useRouter();
    const cameraRef = useRef<CameraRef>(null);

    const device = useCameraDevice('front');
    const { hasPermission, requestPermission } = useCameraPermission();
    const photoOutput = usePhotoOutput({ quality: 0.5, qualityPrioritization: 'speed' });

    // State
    const [phase, setPhase] = useState<TestPhase>('idle');
    const [step, setStep] = useState<LivenessStep>('look_straight');
    const [hasRegistered, setHasRegistered] = useState(false);
    const [cameraVisible, setCameraVisible] = useState(false);
    const [cameraMounted, setCameraMounted] = useState(false);
    const [scanning, setScanning] = useState(false);
    const [displayYaw, setDisplayYaw] = useState(0);
    const [displayFace, setDisplayFace] = useState(false);
    const [captureCount, setCaptureCount] = useState(0);
    const [processing, setProcessing] = useState(false);
    const [showResult, setShowResult] = useState<'pass' | 'fail' | null>(null);

    // Refs for async detection loop
    const stepRef = useRef<LivenessStep>('look_straight');
    const phaseRef = useRef<TestPhase>('idle');
    const scanningRef = useRef(false);
    const captureCountRef = useRef(0);
    const straightPhotoRef = useRef<string | null>(null);
    stepRef.current = step;
    phaseRef.current = phase;

    // ── Init ────────────────────────────────────────────────

    useEffect(() => {
        if (!hasPermission) requestPermission();
    }, [hasPermission, requestPermission]);

    // ── Snapshot-based face detection loop ───────────────────

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
                console.log(`[FaceScan] capture=${t1 - t0}ms detect=${t2 - t1}ms total=${t2 - t0}ms`);

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
    }, [scanning]);

    // ── Process photo via edge function ─────────────────────

    const processPhoto = useCallback(async () => {
        setScanning(false);
        let waitAttempts = 0;
        while (scanningRef.current && waitAttempts < 20) {
            await new Promise((r) => setTimeout(r, 100));
            waitAttempts++;
        }
        // On Android, fully unmount the camera so the next flow gets a fresh session
        if (Platform.OS === 'android') {
            setCameraMounted(false);
        }
        setProcessing(true);

        try {
            const photoPath = straightPhotoRef.current;
            if (!photoPath) {
                Alert.alert('Error', 'No photo captured');
                setPhase('idle');
                setCameraVisible(false);
                return;
            }

            if (phaseRef.current === 'registering') {
                await registerFace(photoPath);
                setHasRegistered(true);
                setProcessing(false);
                setCameraVisible(false);
                restoreBrightness();
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert('Registered', 'Face reference photo saved.');
            } else if (phaseRef.current === 'verifying') {
                const result = await verifyFace(photoPath);
                console.log(
                    '[FaceVerify] Rekognition:',
                    result.similarity.toFixed(1) + '%',
                    result.match ? 'MATCH' : 'REJECTED',
                );
                setProcessing(false);
                restoreBrightness();

                if (result.match) {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    setShowResult('pass');
                } else {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                    setShowResult('fail');
                }
            }
        } catch (err) {
            console.error('[FaceVerify] ERROR:', err instanceof Error ? err.message : String(err));
            setProcessing(false);
            setCameraVisible(false);
            restoreBrightness();
            Alert.alert('Error', err instanceof Error ? err.message : 'Processing failed');
        } finally {
            setPhase('idle');
        }
    }, []);

    // ── Actions ─────────────────────────────────────────────

    const startFlow = useCallback(
        (flowPhase: TestPhase) => {
            if (flowPhase === 'verifying' && !hasRegistered) {
                Alert.alert('Not Registered', 'Register your face first.');
                return;
            }
            setPhase(flowPhase);
            setStep('look_straight');
            stepRef.current = 'look_straight';
            captureCountRef.current = 0;
            setCaptureCount(0);
            scanningRef.current = false;
            straightPhotoRef.current = null;
            setShowResult(null);
            setMaxBrightness();
            setCameraMounted(true);
            setCameraVisible(true);
            setScanning(true);
        },
        [hasRegistered],
    );

    const handleCancel = useCallback(() => {
        setScanning(false);
        setCameraVisible(false);
        setPhase('idle');
        setShowResult(null);
        restoreBrightness();
    }, []);

    const handleDismissResult = useCallback(() => {
        setShowResult(null);
        setCameraVisible(false);
    }, []);

    const handleRetry = useCallback(() => {
        setShowResult(null);
        startFlow('verifying');
    }, [startFlow]);

    // ── Render ──────────────────────────────────────────────

    if (!__DEV__) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <Text style={[styles.errorText, { color: colors.textSecondary }]}>
                    This screen is only available in development mode.
                </Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} hitSlop={12}>
                    <Ionicons name="chevron-back" size={28} color={colors.textPrimary} />
                </Pressable>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Face Verification Test</Text>
                <View style={{ width: 28 }} />
            </View>

            {/* Camera stays mounted once activated — layout never changes
                to avoid VisionCamera Android stream config errors */}
            {cameraMounted && device && (
                <View style={styles.cameraContainer} pointerEvents={cameraVisible ? 'auto' : 'none'}>
                    <Camera
                        ref={cameraRef}
                        style={StyleSheet.absoluteFill}
                        device={device}
                        isActive={cameraMounted}
                        outputs={[photoOutput]}
                    />

                    {/* Face frame */}
                    <View style={styles.overlay}>
                        <View
                            style={[
                                styles.faceFrame,
                                {
                                    borderColor: step === 'done' ? '#34C759' : displayFace ? '#FF9500' : '#FF3B30',
                                },
                            ]}
                        />
                    </View>

                    {/* Step dots */}
                    <View style={styles.stepIndicator}>
                        <View style={[styles.stepDot, captureCount >= 1 && styles.stepDotDone]} />
                        <View style={[styles.stepDot, captureCount >= 2 && styles.stepDotDone]} />
                        <View style={[styles.stepDot, captureCount >= 3 && styles.stepDotDone]} />
                    </View>

                    {/* Prompt with animated arrows */}
                    <View style={styles.promptContainer}>
                        <View style={styles.promptRow}>
                            {step === 'turn_left' && <AnimatedArrow direction="left" />}
                            {step === 'turn_right' && <AnimatedArrow direction="right" />}
                        </View>
                        <Text style={styles.promptText}>{STEP_PROMPTS[step]}</Text>
                    </View>

                    {/* Debug overlay */}
                    <View style={styles.debugOverlay}>
                        <Text style={styles.debugText}>Yaw: {displayYaw}°</Text>
                        <Text style={styles.debugText}>Face: {displayFace ? 'YES' : 'NO'}</Text>
                        <Text style={styles.debugText}>Step: {step}</Text>
                    </View>

                    {/* Cancel button (hide during processing/result) */}
                    {!processing && !showResult && (
                        <Pressable style={styles.cancelButton} onPress={handleCancel}>
                            <Text style={styles.cancelText}>Cancel</Text>
                        </Pressable>
                    )}
                </View>
            )}

            {/* Overlays rendered at top level so they survive camera unmount on Android */}
            {processing && <ProcessingOverlay />}
            {showResult === 'pass' && <CheckedInOverlay onDismiss={handleDismissResult} />}
            {showResult === 'fail' && <FailedOverlay onDismiss={handleDismissResult} onRetry={handleRetry} />}

            {!cameraVisible && (
                <ScrollView
                    contentContainerStyle={styles.content}
                    style={cameraMounted ? [styles.scrollOverlay, { backgroundColor: colors.background }] : undefined}
                >
                    <View style={[styles.card, { backgroundColor: colors.surfacePrimary }]}>
                        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>System Status</Text>
                        <StatusRow label="Camera Permission" ok={hasPermission} />
                        <StatusRow label="Camera Device" ok={!!device} />
                        <StatusRow label="Face Registered" ok={hasRegistered} />
                    </View>

                    <View style={[styles.card, { backgroundColor: colors.surfacePrimary }]}>
                        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Actions</Text>

                        <Pressable
                            style={[
                                styles.button,
                                { backgroundColor: hasPermission ? colors.accent : colors.textTertiary },
                            ]}
                            onPress={() => startFlow('registering')}
                            disabled={!hasPermission || processing}
                        >
                            <Ionicons name="person-add" size={20} color="#FFFFFF" />
                            <Text style={styles.buttonText}>
                                {hasRegistered ? 'Re-register Face' : 'Register Face'}
                            </Text>
                        </Pressable>

                        <Pressable
                            style={[
                                styles.button,
                                { backgroundColor: hasRegistered ? '#34C759' : colors.textTertiary, marginTop: 10 },
                            ]}
                            onPress={() => startFlow('verifying')}
                            disabled={!hasPermission || !hasRegistered || processing}
                        >
                            <Ionicons name="shield-checkmark" size={20} color="#FFFFFF" />
                            <Text style={styles.buttonText}>Verify Face</Text>
                        </Pressable>
                    </View>

                    <View style={[styles.card, { backgroundColor: colors.surfacePrimary }]}>
                        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>How it works</Text>
                        <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                            1. Look straight → captures reference angle{'\n'}
                            2. Turn left → liveness check{'\n'}
                            3. Turn right → liveness check{'\n'}
                            4. Photo sent to AWS Rekognition for comparison{'\n\n'}
                            Liveness: Apple Vision (native module){'\n'}
                            Matching: AWS Rekognition CompareFaces{'\n'}
                            Platform: {Platform.OS} ({Platform.Version})
                        </Text>
                    </View>
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

function StatusRow({ label, ok, error }: { label: string; ok: boolean; error?: string | null }) {
    return (
        <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>{label}</Text>
            <View style={styles.statusRight}>
                {error ? (
                    <Text style={[styles.statusValue, { color: '#FF3B30' }]}>{error}</Text>
                ) : (
                    <Text style={[styles.statusValue, { color: ok ? '#34C759' : '#FF9500' }]}>
                        {ok ? 'Ready' : 'Not Ready'}
                    </Text>
                )}
                <Ionicons
                    name={ok ? 'checkmark-circle' : error ? 'close-circle' : 'ellipse-outline'}
                    size={18}
                    color={ok ? '#34C759' : error ? '#FF3B30' : '#FF9500'}
                    style={{ marginLeft: 6 }}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    headerTitle: { fontSize: 17, fontWeight: '600' },
    content: { padding: 16, paddingBottom: 40 },
    scrollOverlay: {
        position: 'absolute',
        top: 60,
        left: 0,
        right: 0,
        bottom: 0,
    },
    card: { borderRadius: 12, padding: 16, marginBottom: 16 },
    cardTitle: { fontSize: 15, fontWeight: '600', marginBottom: 12 },
    statusRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#E5E5EA',
    },
    statusLabel: { fontSize: 14, color: '#8E8E93' },
    statusRight: { flexDirection: 'row', alignItems: 'center' },
    statusValue: { fontSize: 14, fontWeight: '500' },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 10,
        gap: 8,
    },
    buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
    infoText: { fontSize: 13, lineHeight: 20 },
    errorText: { fontSize: 15, textAlign: 'center', marginTop: 40 },
    cameraContainer: { flex: 1 },
    overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
    faceFrame: { width: 250, height: 320, borderRadius: 125, borderWidth: 3 },
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
    promptContainer: { position: 'absolute', bottom: 120, left: 0, right: 0, alignItems: 'center' },
    promptRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginBottom: 8,
    },
    arrowText: {
        color: '#FFFFFF',
        fontSize: 24,
        fontWeight: '700',
        textShadowColor: 'rgba(0,0,0,0.7)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
    promptText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '600',
        textAlign: 'center',
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
    cancelButton: {
        position: 'absolute',
        bottom: 50,
        alignSelf: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 32,
        paddingVertical: 14,
        borderRadius: 25,
    },
    cancelText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
    // Result overlays
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
    checkedInText: {
        color: '#FFFFFF',
        fontSize: 32,
        fontWeight: '700',
        marginBottom: 32,
    },
    failText: {
        color: '#FFFFFF',
        fontSize: 24,
        fontWeight: '700',
        marginBottom: 32,
    },
    processingText: {
        color: '#FFFFFF',
        fontSize: 20,
        fontWeight: '600',
    },
    failButtons: {
        gap: 12,
    },
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
