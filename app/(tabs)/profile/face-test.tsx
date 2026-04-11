/**
 * DEV-ONLY: Face Verification Test Screen
 *
 * Tests the full pipeline in isolation:
 * 1. Camera + ML Kit face detection (real-time Euler angles)
 * 2. Liveness detection state machine (nod gesture)
 * 3. ONNX face embedding extraction
 * 4. Face registration + verification (cosine similarity)
 *
 * Not wired into any production flow. Access via profile > Face Test.
 */
import { useTheme } from '@/contexts/ThemeContext';
import { useLivenessDetection } from '@/hooks/useLivenessDetection';
import type { FaceFrame } from '@/hooks/useLivenessDetection';
import { deleteEmbedding, getEmbedding, hasEmbedding, saveEmbedding } from '@/lib/faceEmbeddingStore';
import {
    compareEmbeddings,
    extractEmbedding,
    loadModel,
    MATCH_THRESHOLD,
    rgbaToModelInput,
} from '@/lib/faceVerification';
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
import { runOnJS } from 'react-native-reanimated';
import { Camera, useCameraDevice, useCameraPermission, useFrameProcessor } from 'react-native-vision-camera';
import { useFaceDetector } from 'react-native-vision-camera-face-detector';

// ── Types ───────────────────────────────────────────────────

type TestPhase = 'idle' | 'registering' | 'verifying';

// Test user ID for SecureStore (not a real user)
const TEST_USER_ID = '__face_test_user__';

// ── Component ───────────────────────────────────────────────

export default function FaceTestScreen() {
    const { colors } = useTheme();
    const router = useRouter();
    const cameraRef = useRef<Camera>(null);

    // Camera
    const device = useCameraDevice('front');
    const { hasPermission, requestPermission } = useCameraPermission();

    // Liveness
    const {
        state: livenessState,
        prompt: livenessPrompt,
        pitchAngle,
        onFaceDetected,
        reset: resetLiveness,
    } = useLivenessDetection();

    // Face detection
    const { detectFaces } = useFaceDetector({
        performanceMode: 'fast',
        landmarkMode: 'all',
        classificationMode: 'all',
        contourMode: 'none',
        trackingEnabled: true,
        minFaceSize: 0.25,
    });

    // State
    const [phase, setPhase] = useState<TestPhase>('idle');
    const [modelReady, setModelReady] = useState(false);
    const [modelError, setModelError] = useState<string | null>(null);
    const [hasRegistered, setHasRegistered] = useState(false);
    const [cameraActive, setCameraActive] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [similarity, setSimilarity] = useState<number | null>(null);
    const [matchResult, setMatchResult] = useState<'pass' | 'fail' | null>(null);
    const [lastEuler, setLastEuler] = useState({ pitch: 0, yaw: 0, roll: 0 });
    const [faceDetected, setFaceDetected] = useState(false);

    // ── Init ──────────────────────────────────────��─────────

    useEffect(() => {
        // Pre-load the ONNX model
        loadModel()
            .then(() => setModelReady(true))
            .catch((err) => setModelError(err.message));

        // Check if test user has a registered face
        hasEmbedding(TEST_USER_ID).then(setHasRegistered);
    }, []);

    useEffect(() => {
        if (!hasPermission) requestPermission();
    }, [hasPermission, requestPermission]);

    // ── Frame processor helpers (called from worklet via runOnJS) ──

    const updateEulerAngles = useCallback((pitch: number, yaw: number, roll: number) => {
        setLastEuler({
            pitch: Math.round(pitch * 10) / 10,
            yaw: Math.round(yaw * 10) / 10,
            roll: Math.round(roll * 10) / 10,
        });
    }, []);

    const handleFaceFrame = useCallback(
        (faceFrame: FaceFrame) => {
            onFaceDetected(faceFrame);
        },
        [onFaceDetected],
    );

    const setFaceDetectedJS = useCallback((detected: boolean) => {
        setFaceDetected(detected);
    }, []);

    // ── Frame processor ─────────────────────────────────────

    const frameProcessor = useFrameProcessor(
        (frame) => {
            'worklet';
            try {
                const faces = detectFaces(frame);
                if (faces.length > 0) {
                    const face = faces[0];
                    runOnJS(updateEulerAngles)(face.pitchAngle, face.yawAngle, face.rollAngle);
                    runOnJS(setFaceDetectedJS)(true);
                    runOnJS(handleFaceFrame)({
                        pitchAngle: face.pitchAngle,
                        yawAngle: face.yawAngle,
                        rollAngle: face.rollAngle,
                        leftEyeOpenProbability: face.leftEyeOpenProbability,
                        rightEyeOpenProbability: face.rightEyeOpenProbability,
                    });
                } else {
                    runOnJS(setFaceDetectedJS)(false);
                }
            } catch (e) {
                // Log errors to Metro console for debugging
                runOnJS(console.warn)('Frame processor error: ' + String(e));
            }
        },
        [detectFaces, updateEulerAngles, setFaceDetectedJS, handleFaceFrame],
    );

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
            // Take a photo
            const photo = await cameraRef.current.takePhoto({
                flash: 'off',
                enableShutterSound: false,
            });

            // For now, we'll use a placeholder approach for pixel data extraction.
            // In a real implementation, we'd decode the photo and extract RGBA pixels.
            // The ONNX model needs 112x112 RGB CHW normalised input.
            //
            // TODO: Use react-native-image-crop-tools or a native module to:
            // 1. Crop to face bounding box
            // 2. Resize to 112x112
            // 3. Extract raw RGBA pixel data
            //
            // For this POC, we'll generate a dummy embedding from the photo path
            // to validate the pipeline flow. Replace with real pixel extraction
            // when testing on device.
            const embedding = await generateTestEmbedding(photo.path);

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

    /**
     * Generate a face embedding from a photo.
     *
     * NOTE: This is a simplified path for the POC. On-device, we need a way
     * to decode the JPEG, crop the face region, resize to 112x112, and get
     * raw RGBA pixel data. That will require either:
     * - A native module (e.g., react-native-image-crop-tools)
     * - An offscreen canvas (react-native-skia)
     * - A custom frame processor that outputs pixel buffers
     *
     * For now this uses the ONNX model with a deterministic test input
     * derived from the photo path hash, to validate the ONNX pipeline works.
     */
    async function generateTestEmbedding(_photoPath: string): Promise<Float32Array> {
        // Attempt real ONNX inference with a test input
        // This validates: model loads, tensor creation works, inference runs
        const testInput = new Float32Array(3 * 112 * 112);

        // Fill with deterministic pseudo-random data based on timestamp
        // (different each capture, to simulate different face embeddings)
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
                /* Camera view */
                <View style={styles.cameraContainer}>
                    <Camera
                        ref={cameraRef}
                        style={StyleSheet.absoluteFill}
                        device={device}
                        isActive={cameraActive}
                        photo={true}
                        frameProcessor={frameProcessor}
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

                    {/* Euler angle debug readout */}
                    <View style={styles.debugOverlay}>
                        <Text style={styles.debugText}>Pitch: {lastEuler.pitch}°</Text>
                        <Text style={styles.debugText}>Yaw: {lastEuler.yaw}°</Text>
                        <Text style={styles.debugText}>Roll: {lastEuler.roll}°</Text>
                        <Text style={styles.debugText}>Liveness: {livenessState}</Text>
                        <Text style={styles.debugText}>Face: {faceDetected ? 'YES' : 'NO'}</Text>
                    </View>

                    {/* Cancel button */}
                    <Pressable style={styles.cancelButton} onPress={handleCancel}>
                        <Text style={styles.cancelText}>Cancel</Text>
                    </Pressable>
                </View>
            ) : (
                /* Control panel */
                <ScrollView contentContainerStyle={styles.content}>
                    {/* Status cards */}
                    <View style={[styles.card, { backgroundColor: colors.surfacePrimary }]}>
                        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>System Status</Text>
                        <StatusRow label="Camera Permission" ok={hasPermission} />
                        <StatusRow label="Camera Device" ok={!!device} />
                        <StatusRow label="ONNX Model" ok={modelReady} error={modelError} />
                        <StatusRow label="Face Registered" ok={hasRegistered} />
                    </View>

                    {/* Last result */}
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
                                style={[
                                    styles.matchBadge,
                                    {
                                        color: matchResult === 'pass' ? '#34C759' : '#FF3B30',
                                    },
                                ]}
                            >
                                {matchResult === 'pass' ? 'MATCH' : 'NO MATCH'}
                            </Text>
                        </View>
                    )}

                    {/* Actions */}
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
                                {
                                    backgroundColor: hasRegistered ? '#34C759' : colors.textTertiary,
                                    marginTop: 10,
                                },
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

                    {/* Info */}
                    <View style={[styles.card, { backgroundColor: colors.surfacePrimary }]}>
                        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>How it works</Text>
                        <Text style={[styles.infoText, { color: colors.textSecondary }]}>
                            1. Register: Camera opens, nod to prove liveness, face embedding is saved{'\n'}
                            2. Verify: Camera opens again, nod again, new embedding is compared against stored one
                            {'\n'}
                            3. If cosine similarity exceeds {MATCH_THRESHOLD}, it's a match{'\n\n'}
                            Model: OpenCV SFace (MobileFaceNet, int8, 9.4 MB){'\n'}
                            Embedding: 128-d vector{'\n'}
                            Detection: Google ML Kit (on-device){'\n'}
                            Platform: {Platform.OS} ({Platform.Version})
                        </Text>
                    </View>
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

// ── Status row ──────────────────────────────────────────────

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

// ── Styles ──────────────────────────────────────────────────

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
    card: {
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
    },
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

    // Camera view
    cameraContainer: { flex: 1 },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
    },
    faceFrame: {
        width: 250,
        height: 320,
        borderRadius: 125,
        borderWidth: 3,
    },
    promptContainer: {
        position: 'absolute',
        bottom: 120,
        left: 0,
        right: 0,
        alignItems: 'center',
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
