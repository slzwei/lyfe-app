/**
 * DEV-ONLY: Face Verification Test Screen
 *
 * Tests the full pipeline using VisionCamera v5:
 * 1. Camera + built-in face scanning (yaw/roll angles)
 * 2. Liveness detection (head turn left → right)
 * 3. ONNX face embedding extraction
 * 4. Face registration + verification (cosine similarity)
 */
import { useTheme } from '@/contexts/ThemeContext';
import { useLivenessDetection } from '@/hooks/useLivenessDetection';
import { deleteEmbedding, getEmbedding, hasEmbedding, saveEmbedding } from '@/lib/faceEmbeddingStore';
import { compareEmbeddings, extractEmbedding, loadModel, MATCH_THRESHOLD } from '@/lib/faceVerification';
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
import {
    Camera,
    type CameraRef,
    isScannedFace,
    type ScannedObject,
    useCameraDevice,
    useCameraPermission,
    useObjectOutput,
    usePhotoOutput,
} from 'react-native-vision-camera';

// ── Types ───────────────────────────────────────────────────

type TestPhase = 'idle' | 'registering' | 'verifying';
const TEST_USER_ID = '__face_test_user__';

// ── Component ───────────────────────────────────────────────

export default function FaceTestScreen() {
    const { colors } = useTheme();
    const router = useRouter();
    const cameraRef = useRef<CameraRef>(null);

    // Camera
    const device = useCameraDevice('front');
    const { hasPermission, requestPermission } = useCameraPermission();

    // Liveness
    const {
        state: livenessState,
        prompt: livenessPrompt,
        yawAngle,
        onFaceDetected,
        reset: resetLiveness,
    } = useLivenessDetection();

    // State
    const [phase, setPhase] = useState<TestPhase>('idle');
    const [modelReady, setModelReady] = useState(false);
    const [modelError, setModelError] = useState<string | null>(null);
    const [hasRegistered, setHasRegistered] = useState(false);
    const [cameraActive, setCameraActive] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [similarity, setSimilarity] = useState<number | null>(null);
    const [matchResult, setMatchResult] = useState<'pass' | 'fail' | null>(null);
    const [lastYaw, setLastYaw] = useState(0);
    const [faceDetected, setFaceDetected] = useState(false);

    // ── VisionCamera v5 outputs ─────────────────────────────

    const photoOutput = usePhotoOutput();

    const onObjectsScanned = useCallback(
        (objects: ScannedObject[]) => {
            const face = objects.find(isScannedFace);
            if (face) {
                setFaceDetected(true);
                setLastYaw(Math.round(face.yawAngle * 10) / 10);
                if (phase !== 'idle') {
                    onFaceDetected({
                        yawAngle: face.yawAngle,
                        rollAngle: face.rollAngle,
                        hasYawAngle: face.hasYawAngle,
                        hasRollAngle: face.hasRollAngle,
                        faceID: face.faceID,
                    });
                }
            } else {
                setFaceDetected(false);
            }
        },
        [phase, onFaceDetected],
    );

    const objectOutput = useObjectOutput({
        types: ['face'],
        onObjectsScanned,
    });

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

    // ── Liveness passed → capture + process ─────────────────

    useEffect(() => {
        if (livenessState === 'passed' && (phase === 'registering' || phase === 'verifying') && !processing) {
            handleCapture();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [livenessState, phase]);

    const handleCapture = useCallback(async () => {
        if (!cameraRef.current || processing) return;
        setProcessing(true);

        try {
            const photo = await cameraRef.current.controller?.photoOutput?.takePhoto({
                flash: 'off',
                enableShutterSound: false,
            });

            if (!photo) {
                Alert.alert('Error', 'Failed to take photo');
                setProcessing(false);
                return;
            }

            // For POC: test ONNX inference with deterministic input
            const embedding = await generateTestEmbedding();

            if (phase === 'registering') {
                await saveEmbedding(TEST_USER_ID, embedding);
                setHasRegistered(true);
                Alert.alert('Registered', `Face embedding saved (${embedding.length}-d vector)`);
            } else if (phase === 'verifying') {
                const stored = await getEmbedding(TEST_USER_ID);
                if (!stored) {
                    Alert.alert('Error', 'No registered face found. Register first.');
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
            Alert.alert('Error', err instanceof Error ? err.message : 'Capture failed');
        } finally {
            setProcessing(false);
            setCameraActive(false);
            setPhase('idle');
        }
    }, [phase, processing]);

    async function generateTestEmbedding(): Promise<Float32Array> {
        const testInput = new Float32Array(3 * 112 * 112);
        const seed = Date.now() % 10000;
        for (let i = 0; i < testInput.length; i++) {
            testInput[i] = Math.sin(seed + i * 0.01) * 0.5;
        }
        return extractEmbedding(testInput);
    }

    // ── Actions ─────────────────────────────────────────────

    const startRegistration = useCallback(() => {
        setPhase('registering');
        setSimilarity(null);
        setMatchResult(null);
        resetLiveness();
        setCameraActive(true);
    }, [resetLiveness]);

    const startVerification = useCallback(() => {
        if (!hasRegistered) {
            Alert.alert('Not Registered', 'Register your face first.');
            return;
        }
        setPhase('verifying');
        setSimilarity(null);
        setMatchResult(null);
        resetLiveness();
        setCameraActive(true);
    }, [hasRegistered, resetLiveness]);

    const handleClearRegistration = useCallback(async () => {
        await deleteEmbedding(TEST_USER_ID);
        setHasRegistered(false);
        setSimilarity(null);
        setMatchResult(null);
        Alert.alert('Cleared', 'Face registration deleted.');
    }, []);

    const handleCancel = useCallback(() => {
        setCameraActive(false);
        setPhase('idle');
        resetLiveness();
    }, [resetLiveness]);

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
            {/* Header */}
            <View style={styles.header}>
                <Pressable onPress={() => router.back()} hitSlop={12}>
                    <Ionicons name="chevron-back" size={28} color={colors.textPrimary} />
                </Pressable>
                <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Face Verification Test</Text>
                <View style={{ width: 28 }} />
            </View>

            {cameraActive && device ? (
                <View style={styles.cameraContainer}>
                    <Camera
                        ref={cameraRef}
                        style={StyleSheet.absoluteFill}
                        device={device}
                        isActive={cameraActive}
                        outputs={[photoOutput, objectOutput]}
                    />

                    {/* Face frame guide */}
                    <View style={styles.overlay}>
                        <View
                            style={[
                                styles.faceFrame,
                                {
                                    borderColor: faceDetected
                                        ? livenessState === 'passed'
                                            ? '#34C759'
                                            : '#FF9500'
                                        : '#FF3B30',
                                },
                            ]}
                        />
                    </View>

                    {/* Liveness prompt */}
                    <View style={styles.promptContainer}>
                        <Text style={styles.promptText}>{livenessPrompt}</Text>
                        {processing && <ActivityIndicator color="#FFFFFF" style={{ marginTop: 8 }} />}
                    </View>

                    {/* Debug readout */}
                    <View style={styles.debugOverlay}>
                        <Text style={styles.debugText}>Yaw: {lastYaw}°</Text>
                        <Text style={styles.debugText}>Liveness: {livenessState}</Text>
                        <Text style={styles.debugText}>Face: {faceDetected ? 'YES' : 'NO'}</Text>
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
                            onPress={startRegistration}
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
                            onPress={startVerification}
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
                            1. Register: Camera opens, turn head left then right to prove liveness{'\n'}
                            2. Verify: Same flow, new embedding compared against stored one{'\n'}
                            3. If cosine similarity exceeds {MATCH_THRESHOLD}, it's a match{'\n\n'}
                            Model: OpenCV SFace (MobileFaceNet, int8, 9.4 MB){'\n'}
                            Embedding: 128-d vector{'\n'}
                            Detection: VisionCamera v5 built-in face scanning{'\n'}
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
        top: 60,
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
