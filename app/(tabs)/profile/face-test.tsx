/**
 * DEV-ONLY: Face Verification Test Screen
 *
 * Smooth architecture: camera preview has ZERO face scanning.
 * A timer takes snapshots and feeds them to a native Swift module
 * (Apple Vision framework) for async face detection. Preview is
 * completely decoupled from detection — 100% smooth.
 */
import { useTheme } from '@/contexts/ThemeContext';
import { deleteEmbedding, getEmbedding, hasEmbedding, saveEmbedding } from '@/lib/faceEmbeddingStore';
import { compareEmbeddings, extractEmbedding, loadModel, MATCH_THRESHOLD } from '@/lib/faceVerification';
import { detectFaces } from '@/modules/face-detection/src';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
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
const TEST_USER_ID = '__face_test_user__';

const YAW_STRAIGHT_MAX = 10;
const YAW_LEFT_THRESHOLD = -20;
const YAW_RIGHT_THRESHOLD = 20;
const SCAN_INTERVAL_MS = 300;

const STEP_PROMPTS: Record<LivenessStep, string> = {
    look_straight: 'Look straight at the camera',
    turn_left: 'Slowly turn your head left',
    turn_right: 'Now turn your head right',
    done: 'Liveness check passed!',
};

// ── Component ───────────────────────────────────────────────

export default function FaceTestScreen() {
    const { colors } = useTheme();
    const router = useRouter();
    const cameraRef = useRef<CameraRef>(null);

    const device = useCameraDevice('front');
    const { hasPermission, requestPermission } = useCameraPermission();
    const photoOutput = usePhotoOutput();

    // State
    const [phase, setPhase] = useState<TestPhase>('idle');
    const [step, setStep] = useState<LivenessStep>('look_straight');
    const [modelReady, setModelReady] = useState(false);
    const [modelError, setModelError] = useState<string | null>(null);
    const [hasRegistered, setHasRegistered] = useState(false);
    const [cameraActive, setCameraActive] = useState(false);
    const [similarity, setSimilarity] = useState<number | null>(null);
    const [matchResult, setMatchResult] = useState<'pass' | 'fail' | null>(null);
    const [displayYaw, setDisplayYaw] = useState(0);
    const [displayFace, setDisplayFace] = useState(false);
    const [captureCount, setCaptureCount] = useState(0);

    // Refs for async detection loop
    const stepRef = useRef<LivenessStep>('look_straight');
    const phaseRef = useRef<TestPhase>('idle');
    const scanningRef = useRef(false);
    const captureCountRef = useRef(0);
    stepRef.current = step;
    phaseRef.current = phase;

    // ── Init ────────────────────────────────────────────────

    useEffect(() => {
        loadModel()
            .then(() => setModelReady(true))
            .catch((err) => setModelError(err.message));
        hasEmbedding(TEST_USER_ID).then(setHasRegistered);
    }, []);

    useEffect(() => {
        if (!hasPermission) requestPermission();
    }, [hasPermission, requestPermission]);

    // ── Snapshot-based face detection loop ───────────────────
    // Camera preview is UNTOUCHED. Snapshots are taken on a timer
    // and analyzed by the native Vision module on a background thread.

    useEffect(() => {
        if (!cameraActive || phaseRef.current === 'idle') return;
        let cancelled = false;

        const tick = async () => {
            if (cancelled || scanningRef.current) return;
            scanningRef.current = true;

            try {
                // Take a snapshot from the preview buffer
                const snapshot = await cameraRef.current?.preview?.takeSnapshot();
                if (!snapshot || cancelled) {
                    scanningRef.current = false;
                    if (!cancelled) setTimeout(tick, SCAN_INTERVAL_MS);
                    return;
                }

                // Save snapshot to a temp file for the native module
                const filePath = await snapshot.toFile('jpeg', 50);

                // Run face detection on the static image (background thread)
                const faces = await detectFaces(filePath);

                if (cancelled) {
                    scanningRef.current = false;
                    return;
                }

                if (faces.length > 0) {
                    const face = faces[0];
                    // Negate yaw for front camera mirror
                    const yaw = -face.yaw;
                    setDisplayYaw(Math.round(yaw * 10) / 10);
                    setDisplayFace(true);

                    // Auto-capture logic
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
                                processEmbedding();
                                return;
                            }
                        }
                    }
                } else {
                    setDisplayFace(false);
                }
            } catch {
                // Snapshot or detection error — skip this cycle
            }

            scanningRef.current = false;
            if (!cancelled) setTimeout(tick, SCAN_INTERVAL_MS);
        };

        // Start the detection loop
        setTimeout(tick, 500); // Initial delay to let camera warm up
        return () => {
            cancelled = true;
        };
    }, [cameraActive]);

    // ── Process embedding ───────────────────────────────────

    const processEmbedding = useCallback(async () => {
        setCameraActive(false);

        try {
            const embedding = await generateTestEmbedding();

            if (phaseRef.current === 'registering') {
                await saveEmbedding(TEST_USER_ID, embedding);
                setHasRegistered(true);
                Alert.alert('Registered', `Face embedding saved (${embedding.length}-d vector)`);
            } else if (phaseRef.current === 'verifying') {
                const stored = await getEmbedding(TEST_USER_ID);
                if (!stored) {
                    Alert.alert('Error', 'No registered face found.');
                } else {
                    const score = compareEmbeddings(embedding, stored);
                    setSimilarity(Math.round(score * 1000) / 1000);
                    setMatchResult(score >= MATCH_THRESHOLD ? 'pass' : 'fail');
                    Alert.alert(
                        score >= MATCH_THRESHOLD ? 'Match!' : 'No Match',
                        `Cosine similarity: ${score.toFixed(3)} (threshold: ${MATCH_THRESHOLD})`,
                    );
                }
            }
        } catch (err) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Processing failed');
        } finally {
            setPhase('idle');
        }
    }, []);

    async function generateTestEmbedding(): Promise<Float32Array> {
        const testInput = new Float32Array(3 * 112 * 112);
        const seed = Date.now() % 10000;
        for (let i = 0; i < testInput.length; i++) {
            testInput[i] = Math.sin(seed + i * 0.01) * 0.5;
        }
        return extractEmbedding(testInput);
    }

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
            setSimilarity(null);
            setMatchResult(null);
            setCameraActive(true);
        },
        [hasRegistered],
    );

    const handleCancel = useCallback(() => {
        setCameraActive(false);
        setPhase('idle');
    }, []);

    const handleClearRegistration = useCallback(async () => {
        await deleteEmbedding(TEST_USER_ID);
        setHasRegistered(false);
        setSimilarity(null);
        setMatchResult(null);
        Alert.alert('Cleared', 'Face registration deleted.');
    }, []);

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

            {cameraActive && device ? (
                <View style={styles.cameraContainer}>
                    {/* Camera with ONLY photoOutput — zero scanning, 100% smooth */}
                    <Camera
                        ref={cameraRef}
                        style={StyleSheet.absoluteFill}
                        device={device}
                        isActive={cameraActive}
                        outputs={[photoOutput]}
                    />

                    {/* Face frame guide */}
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

                    {/* Prompt */}
                    <View style={styles.promptContainer}>
                        <Text style={styles.promptText}>{STEP_PROMPTS[step]}</Text>
                    </View>

                    {/* Debug */}
                    <View style={styles.debugOverlay}>
                        <Text style={styles.debugText}>Yaw: {displayYaw}°</Text>
                        <Text style={styles.debugText}>Face: {displayFace ? 'YES' : 'NO'}</Text>
                        <Text style={styles.debugText}>Step: {step}</Text>
                    </View>

                    <Pressable style={styles.cancelButton} onPress={handleCancel}>
                        <Text style={styles.cancelText}>Cancel</Text>
                    </Pressable>
                </View>
            ) : (
                <ScrollView contentContainerStyle={styles.content}>
                    <View style={[styles.card, { backgroundColor: colors.surfacePrimary }]}>
                        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>System Status</Text>
                        <StatusRow label="Camera Permission" ok={hasPermission} />
                        <StatusRow label="Camera Device" ok={!!device} />
                        <StatusRow label="ONNX Model" ok={modelReady} error={modelError} />
                        <StatusRow label="Face Registered" ok={hasRegistered} />
                    </View>

                    {similarity !== null && (
                        <View style={[styles.card, { backgroundColor: colors.surfacePrimary }]}>
                            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Last Result</Text>
                            <Text
                                style={[
                                    styles.similarityScore,
                                    { color: matchResult === 'pass' ? '#34C759' : '#FF3B30' },
                                ]}
                            >
                                {similarity.toFixed(3)}
                            </Text>
                            <Text style={[styles.similarityLabel, { color: colors.textSecondary }]}>
                                Cosine Similarity (threshold: {MATCH_THRESHOLD})
                            </Text>
                            <Text
                                style={[styles.matchBadge, { color: matchResult === 'pass' ? '#34C759' : '#FF3B30' }]}
                            >
                                {matchResult === 'pass' ? 'MATCH' : 'NO MATCH'}
                            </Text>
                        </View>
                    )}

                    <View style={[styles.card, { backgroundColor: colors.surfacePrimary }]}>
                        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Actions</Text>

                        <Pressable
                            style={[
                                styles.button,
                                { backgroundColor: hasPermission ? colors.accent : colors.textTertiary },
                            ]}
                            onPress={() => startFlow('registering')}
                            disabled={!hasPermission}
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
                            disabled={!hasPermission || !hasRegistered}
                        >
                            <Ionicons name="shield-checkmark" size={20} color="#FFFFFF" />
                            <Text style={styles.buttonText}>Verify Face</Text>
                        </Pressable>

                        {hasRegistered && (
                            <Pressable
                                style={[styles.button, { backgroundColor: '#FF3B30', marginTop: 10 }]}
                                onPress={handleClearRegistration}
                            >
                                <Ionicons name="trash" size={20} color="#FFFFFF" />
                                <Text style={styles.buttonText}>Clear Registration</Text>
                            </Pressable>
                        )}
                    </View>

                    <View style={[styles.card, { backgroundColor: colors.surfacePrimary }]}>
                        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>How it works</Text>
                        <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                            1. Look straight → auto-detects centered face{'\n'}
                            2. Turn left → auto-detects at -20° yaw{'\n'}
                            3. Turn right → auto-detects at +20° yaw{'\n'}
                            4. All 3 detected = liveness passed{'\n\n'}
                            Detection: Apple Vision (native module, background thread){'\n'}
                            Model: OpenCV SFace (MobileFaceNet, int8, 9.4 MB){'\n'}
                            Embedding: 128-d vector{'\n'}
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
    similarityScore: { fontSize: 48, fontWeight: '700', textAlign: 'center' },
    similarityLabel: { fontSize: 13, textAlign: 'center', marginTop: 4 },
    matchBadge: { fontSize: 20, fontWeight: '700', textAlign: 'center', marginTop: 8 },
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
});
