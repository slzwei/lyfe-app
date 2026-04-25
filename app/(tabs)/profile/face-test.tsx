/**
 * DEV-ONLY: Face Verification Test Screen
 *
 * Thin wrapper around FaceCaptureFlow used for diagnostics. Shows camera /
 * permission / registration status, lets you trigger either a register or
 * verify pass, and — for development — leaves the debug yaw/face/step overlay
 * visible during capture. In production builds this screen is inaccessible
 * (see __DEV__ guard).
 */
import { FaceCaptureFlow, type FaceCaptureResult } from '@/components/face/FaceCaptureFlow';
import { useTheme } from '@/contexts/ThemeContext';
import { checkFaceRegistration, registerFace, verifyFace } from '@/lib/faceVerification';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCameraDevice, useCameraPermission } from 'react-native-vision-camera';

type DevMode = 'register' | 'verify';

export default function FaceTestScreen() {
    const { colors } = useTheme();
    const router = useRouter();

    const device = useCameraDevice('front');
    const { hasPermission, requestPermission } = useCameraPermission();

    const [hasRegistered, setHasRegistered] = useState(false);
    const [registeredAt, setRegisteredAt] = useState<string | null>(null);
    const [checkingRegistration, setCheckingRegistration] = useState(true);
    const [activeMode, setActiveMode] = useState<DevMode | null>(null);

    // Ask for permission once on mount
    useEffect(() => {
        if (!hasPermission) requestPermission();
    }, [hasPermission, requestPermission]);

    // Probe the edge function on mount to learn the user's registration state
    useEffect(() => {
        let cancelled = false;
        checkFaceRegistration()
            .then((status) => {
                if (cancelled) return;
                setHasRegistered(status.registered);
                setRegisteredAt(status.registeredAt);
            })
            .catch((err) => {
                if (cancelled) return;
                console.error('[FaceVerify] check error:', err instanceof Error ? err.message : String(err));
            })
            .finally(() => {
                if (!cancelled) setCheckingRegistration(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    // Parent-side handler that drives the actual register / verify API call
    // and maps the result into the FaceCaptureFlow result shape.
    const handlePhotoCaptured = useCallback(
        async (photoPath: string): Promise<FaceCaptureResult> => {
            if (activeMode === 'register') {
                const r = await registerFace(photoPath);
                if (r.success) {
                    setHasRegistered(true);
                    setRegisteredAt(new Date().toISOString());
                    return { ok: true };
                }
                return { ok: false, reason: r.reason, message: r.message };
            }

            // verify mode
            const r = await verifyFace(photoPath);
            console.log(
                '[FaceVerify] Rekognition:',
                r.similarity.toFixed(1) + '%',
                r.match ? 'MATCH' : `REJECTED (${r.reason ?? 'unknown'})`,
            );
            if (r.match) return { ok: true };
            return {
                ok: false,
                reason: r.reason ?? 'low_similarity',
                message: r.message ?? 'Face not recognized',
            };
        },
        [activeMode],
    );

    const handleDismissCapture = useCallback(() => {
        setActiveMode(null);
    }, []);

    const startFlow = useCallback(
        (mode: DevMode) => {
            if (mode === 'verify' && !hasRegistered) {
                setActiveMode(null);
                return;
            }
            setActiveMode(mode);
        },
        [hasRegistered],
    );

    // ── Render ──────────────────────────────────────────

    if (!__DEV__) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <Text style={[styles.errorText, { color: colors.textSecondary }]}>
                    This screen is only available in development mode.
                </Text>
            </SafeAreaView>
        );
    }

    if (activeMode) {
        return (
            <FaceCaptureFlow mode={activeMode} onPhotoCaptured={handlePhotoCaptured} onDismiss={handleDismissCapture} />
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

            <ScrollView contentContainerStyle={styles.content}>
                <View style={[styles.card, { backgroundColor: colors.surfacePrimary }]}>
                    <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>System Status</Text>
                    <StatusRow label="Camera Permission" ok={hasPermission} />
                    <StatusRow label="Camera Device" ok={!!device} />
                    <StatusRow
                        label="Face Registered"
                        ok={hasRegistered}
                        loading={checkingRegistration}
                        subtitle={hasRegistered && registeredAt ? formatRegisteredAt(registeredAt) : undefined}
                    />
                </View>

                <View style={[styles.card, { backgroundColor: colors.surfacePrimary }]}>
                    <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Actions</Text>

                    <Pressable
                        style={[
                            styles.button,
                            {
                                backgroundColor:
                                    hasPermission && !checkingRegistration ? colors.accent : colors.textTertiary,
                            },
                        ]}
                        onPress={() => startFlow('register')}
                        disabled={!hasPermission || checkingRegistration}
                    >
                        <Ionicons name="person-add" size={20} color={colors.textInverse} />
                        <Text style={[styles.buttonText, { color: colors.textInverse }]}>
                            {hasRegistered ? 'Re-register Face' : 'Register Face'}
                        </Text>
                    </Pressable>

                    <Pressable
                        style={[
                            styles.button,
                            {
                                backgroundColor:
                                    hasRegistered && !checkingRegistration ? colors.success : colors.textTertiary,
                                marginTop: 10,
                            },
                        ]}
                        onPress={() => startFlow('verify')}
                        disabled={!hasPermission || !hasRegistered || checkingRegistration}
                    >
                        <Ionicons name="shield-checkmark" size={20} color={colors.textInverse} />
                        <Text style={[styles.buttonText, { color: colors.textInverse }]}>Verify Face</Text>
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
                        Quality gates: DetectFaces (shared across register + verify){'\n'}
                        Platform: {Platform.OS} ({Platform.Version})
                    </Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

// ── Helpers ─────────────────────────────────────────────────

function StatusRow({
    label,
    ok,
    error,
    loading,
    subtitle,
}: {
    label: string;
    ok: boolean;
    error?: string | null;
    loading?: boolean;
    subtitle?: string;
}) {
    // Theme tokens instead of hardcoded iOS defaults (was #8E8E93/#34C759/#FF3B30/#FF9500).
    // StatusRow now works correctly in both light and dark mode.
    const { colors } = useTheme();

    return (
        <View style={[styles.statusRow, { borderBottomColor: colors.border }]}>
            <View style={{ flex: 1 }}>
                <Text style={[styles.statusLabel, { color: colors.textTertiary }]}>{label}</Text>
                {subtitle && !loading ? (
                    <Text style={[styles.statusSubtitle, { color: colors.textTertiary }]}>{subtitle}</Text>
                ) : null}
            </View>
            <View style={styles.statusRight}>
                {loading ? (
                    <>
                        <ActivityIndicator size="small" color={colors.textTertiary} />
                        <Text style={[styles.statusValue, { color: colors.textTertiary, marginLeft: 6 }]}>
                            Checking…
                        </Text>
                    </>
                ) : error ? (
                    <Text style={[styles.statusValue, { color: colors.danger }]}>{error}</Text>
                ) : (
                    <>
                        <Text style={[styles.statusValue, { color: ok ? colors.success : colors.warning }]}>
                            {ok ? 'Ready' : 'Not Ready'}
                        </Text>
                        <Ionicons
                            name={ok ? 'checkmark-circle' : 'ellipse-outline'}
                            size={18}
                            color={ok ? colors.success : colors.warning}
                            style={{ marginLeft: 6 }}
                        />
                    </>
                )}
            </View>
        </View>
    );
}

function formatRegisteredAt(iso: string): string {
    try {
        const d = new Date(iso);
        return `Registered ${d.toLocaleDateString('en-SG', { year: 'numeric', month: 'short', day: 'numeric' })}`;
    } catch {
        return 'Registered';
    }
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
    card: { borderRadius: 12, padding: 16, marginBottom: 16 },
    cardTitle: { fontSize: 15, fontWeight: '600', marginBottom: 12 },
    // borderBottomColor applied inline from theme
    statusRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    // label/subtitle colors applied inline from theme
    statusLabel: { fontSize: 14 },
    statusSubtitle: { fontSize: 11, marginTop: 2 },
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
    // color applied inline from theme (colors.textInverse)
    buttonText: { fontSize: 16, fontWeight: '600' },
    infoText: { fontSize: 13, lineHeight: 20 },
    errorText: { fontSize: 15, textAlign: 'center', marginTop: 40 },
});
