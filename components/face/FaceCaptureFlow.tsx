/**
 * Reusable camera + liveness + overlay flow for face registration and
 * verification. Owns the camera lifecycle, the real-time liveness challenge
 * (blink-first with automatic head-turn fallback — see lib/liveness.ts), the
 * circular viewfinder mask + progress ring, result overlays, tab bar
 * hide/restore, and max screen brightness.
 *
 * The parent supplies an `onPhotoCaptured(photoPath) → Promise<FaceCaptureResult>`
 * callback that performs the actual API call (registerFace / verifyFace). The
 * component routes the returned result into the appropriate success or failure
 * overlay and calls `onDismiss` when the user is done.
 *
 * Liveness runs on MLKit frame detections (react-native-vision-camera-face-detector)
 * via useFaceLiveness; the verification photo is captured only after the
 * challenge passes and the face has settled (eyes open, frontal).
 */
import { ShimmerOverlay } from '@/components/roadshow/atoms/ShimmerOverlay';
import { TAB_BAR_HEIGHT, TAB_BAR_PADDING_BOTTOM, TAB_BAR_PADDING_TOP } from '@/constants/platform';
import { useTheme } from '@/contexts/ThemeContext';
import { useFaceLiveness, type LivenessDebugSnapshot } from '@/hooks/useFaceLiveness';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { createFaceMetricsSession } from '@/lib/faceMetrics';
import { isConnectivityError, type FaceQualityReason } from '@/lib/faceVerification';
import { createLivenessConfig, type GuidanceKey } from '@/lib/liveness';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from 'expo-router';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    AccessibilityInfo,
    ActivityIndicator,
    Image,
    LayoutChangeEvent,
    Linking,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import Animated, {
    Easing,
    FadeIn,
    FadeOut,
    cancelAnimation,
    useAnimatedProps,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withDelay,
    withRepeat,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle as SvgCircle, Path as SvgPath } from 'react-native-svg';
import { Camera, useCameraDevice, useCameraPermission, usePhotoOutput } from 'react-native-vision-camera';
import { restoreBrightness, setMaxBrightness } from '../../modules/face-detection/src';

// ── Public API ─────────────────────────────────────────────

export type FaceCaptureMode = 'register' | 'verify';

export type FaceCaptureFailReason = FaceQualityReason | 'low_similarity';

export type FaceCaptureResult = { ok: true } | { ok: false; reason: FaceCaptureFailReason; message: string };

export interface FaceCaptureFlowProps {
    mode: FaceCaptureMode;
    /** Called after liveness passes and the settled photo is captured. The
     * parent runs its API call (register or verify) and returns the outcome. */
    onPhotoCaptured: (photoPath: string) => Promise<FaceCaptureResult>;
    /** Called when the user is done — cancelled, succeeded and dismissed,
     * or failed and cancelled. Parent should unmount the component. */
    onDismiss: () => void;
    /** Whether to show the dev liveness debug overlay. Defaults to __DEV__. */
    showDebug?: boolean;
}

// ── Constants ──────────────────────────────────────────────

// How long the ring's fill-to-full + sage flip plays before the success
// overlay fades in over it.
const MORPH_DELAY_MS = 600;

// Circle geometry shared with the liveness containment rules — the mask must
// show exactly the region the reducer enforces.
const LIVENESS_CIRCLE = createLivenessConfig(Platform.OS === 'android' ? 'android' : 'ios').circle;

/** Coaching line inside the viewfinder (italic serif, one line at a time). */
const GUIDANCE_COPY: Record<GuidanceKey, string> = {
    searching: 'Looking for you…',
    face_light: 'Find a brighter spot…',
    one_face: 'Just you in the frame…',
    move_closer: 'A little closer…',
    move_back: 'A little further back…',
    center_face: 'Center your face in the circle…',
    hold_still: 'Hold still…',
    blink: 'Blink now',
    turn_left: 'Turn your head left…',
    turn_right: 'Now turn right…',
    done: '✓ Got it',
};

/**
 * Brand-voice coaching for quality-gate rejections. Keyed by the edge
 * function's reason code; unmapped reasons (notably `low_face_confidence`,
 * which parents reuse as a catch-all for proximity failures and hard errors)
 * fall through to the message the caller provided.
 */
const FAIL_COPY: Partial<Record<FaceCaptureFailReason, string>> = {
    no_face: "We couldn't see a face in the shot. Fill the circle and try again.",
    multiple_faces: 'Make sure only you are in the frame, then try again.',
    occluded: 'Something was covering your face — a mask, hand, or hair. Clear it and retry.',
    blurry: 'The shot came out blurry. Hold a little steadier this time.',
    too_dark: 'Too dark for a clean shot. Face a light source and try again.',
    too_small: 'You were a little far away. Move closer so your face fills the circle.',
    low_similarity:
        "This doesn't match your registered Lyfe ID. If your appearance has changed, re-register it from Profile.",
};

/** Verify failures allowed per sheet session before we hand off to a human. */
const MAX_VERIFY_FAILS = 3;

/** AsyncStorage key for the one-time check-in primer. */
const PRIMER_SEEN_KEY = 'face_checkin_primer_seen';

/** Screen-reader announcements (plain sentences, no ellipses/glyphs). */
const GUIDANCE_A11Y: Record<GuidanceKey, string> = {
    searching: 'Looking for your face',
    face_light: 'Move somewhere brighter',
    one_face: 'Make sure only you are in the frame',
    move_closer: 'Move a little closer',
    move_back: 'Move a little further back',
    center_face: 'Center your face in the circle',
    hold_still: 'Hold still',
    blink: 'Blink now',
    turn_left: 'Turn your head to the left',
    turn_right: 'Now turn your head to the right',
    done: 'Got it. Verifying.',
};

// ── Theme palette ──────────────────────────────────────────
// Maps the design-system tokens onto the roles this sheet uses. Everything
// renders in both themes; the only theme-independent colors are the ones
// drawn over the live camera feed, which is dark regardless of theme.

interface Palette {
    paper: string;
    paperEl: string;
    ink: string;
    muted: string;
    faint: string;
    rule: string;
    terra: string;
    terraPressed: string;
    sage: string;
    mask: string;
    onCamera: string;
}

function usePalette(): Palette {
    const { colors } = useTheme();
    return useMemo(
        () => ({
            paper: colors.surfacePrimary,
            paperEl: colors.surfaceElevated,
            ink: colors.textPrimary,
            muted: colors.textSecondary,
            faint: colors.divider,
            rule: colors.border,
            terra: colors.accent,
            terraPressed: colors.accentDark,
            sage: colors.success,
            mask: colors.background,
            // Drawn over the camera feed — theme-independent by design.
            onCamera: '#F4EEE1',
        }),
        [colors],
    );
}

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
            titleLead: 'Center your face. ',
            titleAccent: 'One blink',
            titleTail: ' and you’re in.',
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
    // verify → roadshow check-in
    return {
        eyebrow: 'STEP 2 / 3 · FACE',
        titleLead: 'Center your face. ',
        titleAccent: 'One blink',
        titleTail: ' checks you in.',
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
    palette,
}: {
    titleNode: React.ReactNode;
    sub: string;
    cta: string;
    onDismiss: () => void;
    palette: Palette;
}) {
    const cardScale = useSharedValue(0.88);
    const cardOpacity = useSharedValue(0);

    useEffect(() => {
        // Delay the pop-in so the ring's fill-to-sage morph has time to play
        // before the overlay covers it.
        cardScale.value = withDelay(MORPH_DELAY_MS, withSpring(1, { damping: 18, stiffness: 180 }));
        cardOpacity.value = withDelay(MORPH_DELAY_MS, withTiming(1, { duration: 240 }));
    }, [cardScale, cardOpacity]);

    const cardStyle = useAnimatedStyle(() => ({
        transform: [{ scale: cardScale.value }],
        opacity: cardOpacity.value,
    }));

    return (
        <Animated.View entering={FadeIn.delay(MORPH_DELAY_MS).duration(240)} style={styles.protoOverlay}>
            <Animated.View style={[styles.protoCard, { backgroundColor: palette.paper }, cardStyle]}>
                <View
                    style={[styles.protoIconRing, { backgroundColor: palette.sage + '1E', borderColor: palette.sage }]}
                >
                    <Text style={[styles.protoIconGlyph, { color: palette.sage }]}>✓</Text>
                </View>
                <Text style={[styles.protoTitle, { color: palette.ink }]}>{titleNode}</Text>
                <Text style={[styles.protoSub, { color: palette.muted }]}>{sub}</Text>
                <Pressable
                    testID="face-capture-success-dismiss"
                    onPress={onDismiss}
                    style={({ pressed }) => [
                        styles.protoCta,
                        {
                            backgroundColor: pressed ? '#5E6F51' : palette.sage,
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
    palette,
}: {
    onDismiss: () => void;
    /** Omit to hide the retry button (attempt cap reached — hand off to a human). */
    onRetry?: () => void;
    title: string;
    subtitle?: string;
    palette: Palette;
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

    // Fail accent: muted rose (deliberately softer than the danger token —
    // supportive, not alarming). Alpha tint keeps it working in both themes.
    const pink = '#D88A93';

    return (
        <Animated.View entering={FadeIn.duration(240)} style={styles.protoOverlay}>
            <Animated.View style={[styles.protoCard, { backgroundColor: palette.paper }, cardStyle]}>
                <View style={[styles.protoIconRing, { backgroundColor: pink + '26', borderColor: pink }]}>
                    <Text style={[styles.protoIconGlyph, { color: pink }]}>✕</Text>
                </View>
                <Text style={[styles.protoTitle, { color: palette.ink }]}>{title}</Text>
                {subtitle ? <Text style={[styles.protoSub, { color: palette.muted }]}>{subtitle}</Text> : null}
                <View style={styles.protoCtaCol}>
                    {onRetry ? (
                        <Pressable
                            onPress={onRetry}
                            style={({ pressed }) => [
                                styles.protoCta,
                                { backgroundColor: pressed ? palette.terraPressed : palette.terra },
                            ]}
                            accessibilityLabel="Try again"
                        >
                            <Text style={styles.protoCtaText}>Try again</Text>
                            <Text style={styles.protoCtaArrow}>↻</Text>
                        </Pressable>
                    ) : null}
                    <Pressable
                        onPress={onDismiss}
                        style={({ pressed }) => [styles.protoCtaGhost, { opacity: pressed ? 0.6 : 1 }]}
                        accessibilityLabel="Cancel"
                    >
                        <Text style={[styles.protoGhostText, { color: palette.muted }]}>
                            {onRetry ? 'Cancel' : 'Close'}
                        </Text>
                    </Pressable>
                </View>
            </Animated.View>
        </Animated.View>
    );
}

function NetworkOverlay({
    onDismiss,
    onRetry,
    palette,
}: {
    onDismiss: () => void;
    onRetry: () => void;
    palette: Palette;
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

    // Calm slate — not a hard failure, just "no signal; we'll retry".
    const slate = '#6E7E89';

    return (
        <Animated.View entering={FadeIn.duration(240)} style={styles.protoOverlay}>
            <Animated.View style={[styles.protoCard, { backgroundColor: palette.paper }, cardStyle]}>
                <View style={[styles.protoIconRing, { backgroundColor: slate + '26', borderColor: slate }]}>
                    <Ionicons name="cloud-offline-outline" size={30} color={slate} />
                </View>
                <Text style={[styles.protoTitle, { color: palette.ink }]}>No connection</Text>
                <Text style={[styles.protoSub, { color: palette.muted }]}>
                    We couldn&apos;t reach the server. We&apos;ll try again automatically once you&apos;re back online.
                </Text>
                <View style={styles.protoCtaCol}>
                    <Pressable
                        onPress={onRetry}
                        style={({ pressed }) => [
                            styles.protoCta,
                            { backgroundColor: pressed ? palette.terraPressed : palette.terra },
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
                        <Text style={[styles.protoGhostText, { color: palette.muted }]}>Cancel</Text>
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

// ── Circle mask ────────────────────────────────────────────
// Near-solid theme surface with a circular hole (evenodd path). The circle
// matches the containment region the liveness reducer enforces, so what the
// user sees is exactly what the machine checks.

function CircleMask({ width, height, fill }: { width: number; height: number; fill: string }) {
    const cx = LIVENESS_CIRCLE.cx * width;
    const cy = LIVENESS_CIRCLE.cy * height;
    const r = LIVENESS_CIRCLE.rx * width;

    const d = [
        `M0 0 H${width} V${height} H0 Z`,
        `M ${cx} ${cy - r}`,
        `A ${r} ${r} 0 1 0 ${cx} ${cy + r}`,
        `A ${r} ${r} 0 1 0 ${cx} ${cy - r}`,
        'Z',
    ].join(' ');

    return (
        <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
            <SvgPath d={d} fill={fill} fillOpacity={0.97} fillRule="evenodd" />
        </Svg>
    );
}

// ── Progress ring ──────────────────────────────────────────
// Single status indicator around the circle: fills with liveness progress,
// sweeps (indeterminate) while the server verifies, flips to sage on pass.

const AnimatedSvgCircle = Animated.createAnimatedComponent(SvgCircle);

function ProgressRing({
    width,
    height,
    progress,
    color,
    trackColor,
    indeterminate,
}: {
    width: number;
    height: number;
    progress: number;
    color: string;
    trackColor: string;
    indeterminate: boolean;
}) {
    const reduceMotion = useReducedMotion();
    const cx = LIVENESS_CIRCLE.cx * width;
    const cy = LIVENESS_CIRCLE.cy * height;
    const r = LIVENESS_CIRCLE.rx * width + 6; // sits just outside the mask edge
    const strokeWidth = 3.5;
    const circumference = 2 * Math.PI * r;

    const fill = useSharedValue(progress);
    useEffect(() => {
        if (reduceMotion) {
            fill.value = progress;
        } else {
            fill.value = withTiming(progress, { duration: 300, easing: Easing.out(Easing.exp) });
        }
    }, [progress, reduceMotion, fill]);

    const animatedProps = useAnimatedProps(() => ({
        strokeDashoffset: circumference * (1 - (indeterminate ? 0.28 : fill.value)),
    }));

    // Indeterminate sweep: rotate the whole ring while the server round-trip
    // runs. Functional progress motion (spinner-equivalent), disabled under
    // reduced motion.
    const rotation = useSharedValue(0);
    useEffect(() => {
        if (indeterminate && !reduceMotion) {
            rotation.value = 0;
            rotation.value = withRepeat(withTiming(360, { duration: 1100, easing: Easing.linear }), -1);
        } else {
            cancelAnimation(rotation);
            rotation.value = 0;
        }
    }, [indeterminate, reduceMotion, rotation]);

    const rotationStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: cx - r - strokeWidth },
            { translateY: cy - r - strokeWidth },
            { rotate: `${rotation.value}deg` },
        ],
    }));

    const size = (r + strokeWidth) * 2;
    return (
        <Animated.View
            pointerEvents="none"
            style={[{ position: 'absolute', width: size, height: size }, rotationStyle]}
        >
            <Svg width={size} height={size}>
                <SvgCircle
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    stroke={trackColor}
                    strokeWidth={strokeWidth}
                    strokeOpacity={0.25}
                    fill="none"
                />
                <AnimatedSvgCircle
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    stroke={color}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    fill="none"
                    strokeDasharray={`${circumference} ${circumference}`}
                    animatedProps={animatedProps}
                    // Start the fill from 12 o'clock.
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                />
            </Svg>
        </Animated.View>
    );
}

// ── Status tick (Proximity / Liveness / Match tiles) ──────

function StatusTick({
    label,
    passed,
    text,
    palette,
}: {
    label: string;
    passed: boolean;
    text: string;
    palette: Palette;
}) {
    return (
        <View style={[styles.tick, { backgroundColor: palette.paperEl, borderColor: palette.rule }]}>
            <Text style={[styles.tickLabel, { color: palette.muted }]}>{label.toUpperCase()}</Text>
            <View style={styles.tickStatus}>
                <View style={[styles.tickDot, { backgroundColor: passed ? palette.sage : palette.faint }]} />
                <Text style={[styles.tickText, { color: passed ? palette.sage : palette.muted }]}>{text}</Text>
            </View>
        </View>
    );
}

// ── Main component ─────────────────────────────────────────

export function FaceCaptureFlow({ mode, onPhotoCaptured, onDismiss, showDebug = __DEV__ }: FaceCaptureFlowProps) {
    const { colors } = useTheme();
    const palette = usePalette();
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const { isConnected, isInternetReachable } = useNetworkStatus();

    const device = useCameraDevice('front');
    const { hasPermission, requestPermission } = useCameraPermission();
    const photoOutput = usePhotoOutput({ quality: 0.5, qualityPrioritization: 'speed' });

    // State — the camera starts mounted on mount
    const [cameraMounted, setCameraMounted] = useState(true);
    const [cameraReady, setCameraReady] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [showResult, setShowResult] = useState<'pass' | 'fail' | 'network' | null>(null);
    const [failMessage, setFailMessage] = useState<string | null>(null);
    const [frozenPhoto, setFrozenPhoto] = useState<string | null>(null);
    const [cameraLayout, setCameraLayout] = useState({ width: 0, height: 0 });
    const [debugSnap, setDebugSnap] = useState<LivenessDebugSnapshot | null>(null);
    const [failCount, setFailCount] = useState(0);
    const [showPrimer, setShowPrimer] = useState(false);

    // Telemetry — one session per mount; completed on dismiss/unmount.
    const metricsRef = useRef(createFaceMetricsSession(mode));
    const outcomeRef = useRef<'pass' | 'fail' | 'network' | 'timed_out' | null>(null);

    const handleCameraLayout = useCallback((e: LayoutChangeEvent) => {
        const { width, height } = e.nativeEvent.layout;
        setCameraLayout({ width, height });
    }, []);

    // ── Liveness engine ──────────────────────────────────
    const livenessEnabled = cameraMounted && cameraReady && !processing && !showResult && !showPrimer;
    const liveness = useFaceLiveness({
        enabled: livenessEnabled,
        viewfinderWidth: cameraLayout.width,
        viewfinderHeight: cameraLayout.height,
    });

    // Refs for the capture/verify pipeline
    const straightPhotoRef = useRef<string | null>(null);
    const captureStartedRef = useRef(false);

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

    // ── Fail fast: known-offline at open ─────────────────
    // Surface the network overlay BEFORE the user performs the challenge,
    // not after — the auto-retry-on-reconnect path restarts the flow.

    useEffect(() => {
        if (!isOnlineRef.current) {
            retryingRef.current = false;
            setShowResult('network');
        }
        // Mount-only by design; live drops mid-flow are handled by processPhoto.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── One-time primer before the first check-in ───────

    useEffect(() => {
        if (mode !== 'verify') return;
        let cancelled = false;
        AsyncStorage.getItem(PRIMER_SEEN_KEY)
            .then((seen) => {
                if (!seen && !cancelled) setShowPrimer(true);
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, [mode]);

    const handleDismissPrimer = useCallback(() => {
        setShowPrimer(false);
        AsyncStorage.setItem(PRIMER_SEEN_KEY, '1').catch(() => {});
    }, []);

    // ── Telemetry marks ──────────────────────────────────

    useEffect(() => {
        if (cameraReady) metricsRef.current.mark('camera_ready');
    }, [cameraReady]);

    useEffect(() => {
        if (liveness.phase !== 'searching') metricsRef.current.mark('first_face');
    }, [liveness.phase]);

    useEffect(() => {
        if (liveness.challenge) {
            metricsRef.current.setChallenge(
                liveness.challenge,
                liveness.challenge === 'turn' && (liveness.blinkTimeouts > 0 || liveness.eyeDataMissing),
            );
        }
    }, [liveness.challenge, liveness.blinkTimeouts, liveness.eyeDataMissing]);

    // Session summary fires when the sheet unmounts (dismiss/cancel paths all
    // unmount via the parent). Retries keep the same session.
    useEffect(() => {
        const metrics = metricsRef.current;
        return () => {
            metrics.complete(outcomeRef.current ?? 'cancelled');
        };
    }, []);

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

    // ── Verify/register pipeline (runs after capture) ───

    const processPhoto = useCallback(async () => {
        setProcessing(true);

        // On Android, fully unmount the camera so the next flow gets a fresh session.
        if (Platform.OS === 'android') {
            setCameraMounted(false);
        }

        const photoPath = straightPhotoRef.current;
        if (!photoPath) {
            setProcessing(false);
            setFailMessage('No photo captured. Please try again.');
            setShowResult('fail');
            return;
        }

        // Route a failure to the right overlay: a connectivity failure gets the
        // "No connection" overlay (auto-retries on reconnect); a quality
        // rejection or server error gets the standard fail overlay. Non-network
        // failures count toward the per-session attempt cap.
        const showFailure = (message: string, reason?: string) => {
            restoreBrightness();
            setProcessing(false);
            setFailMessage(message);
            if (isConnectivityError(message)) {
                retryingRef.current = false; // arm one reconnect auto-retry
                outcomeRef.current = 'network';
                setShowResult('network');
            } else {
                metricsRef.current.recordFailure(reason ?? 'error');
                outcomeRef.current = 'fail';
                setFailCount((count) => count + 1);
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

        metricsRef.current.mark('verify_start');
        try {
            const result = await onPhotoCaptured(photoPath);

            if (result.ok) {
                restoreBrightness();
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                outcomeRef.current = 'pass';
                setShowResult('pass');
                // On iOS the ring's fill-to-sage morph plays during the
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
                // Prefer brand-voice coaching for known quality reasons; fall
                // back to the caller's message (proximity failures and hard
                // errors arrive under the unmapped low_face_confidence reason).
                showFailure(FAIL_COPY[result.reason] ?? result.message, result.reason);
            }
        } catch (err) {
            console.error('[FaceCaptureFlow] ERROR:', err instanceof Error ? err.message : String(err));
            showFailure(err instanceof Error ? err.message : 'An unexpected error occurred.');
        }
    }, [onPhotoCaptured]);

    // ── Capture on liveness pass (one-shot) ─────────────

    useEffect(() => {
        if (liveness.phase !== 'capture' || captureStartedRef.current) return;
        captureStartedRef.current = true;

        metricsRef.current.mark('challenge_pass');
        (async () => {
            try {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                const photoFile = await photoOutput.capturePhotoToFile(
                    { flashMode: 'off', enableShutterSound: false },
                    {},
                );
                if (!photoFile?.filePath) throw new Error('Camera returned no photo');
                metricsRef.current.mark('capture');
                straightPhotoRef.current = photoFile.filePath;
                // Freeze the shot inside the circle while the server verifies —
                // reads as "we got it" instead of a live feed with a spinner.
                setFrozenPhoto(photoFile.filePath);
                await processPhoto();
            } catch (err) {
                console.error('[FaceCaptureFlow] capture ERROR:', err instanceof Error ? err.message : String(err));
                restoreBrightness();
                setProcessing(false);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                setFailMessage('Could not capture a photo. Please try again.');
                setShowResult('fail');
            }
        })();
    }, [liveness.phase, photoOutput, processPhoto]);

    // ── Liveness timeout → fail overlay ─────────────────

    useEffect(() => {
        if (liveness.phase !== 'timed_out' || showResult) return;
        restoreBrightness();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        metricsRef.current.recordFailure('liveness_timeout');
        outcomeRef.current = 'timed_out';
        setFailMessage("We couldn't verify in time. Find even lighting and try again.");
        setShowResult('fail');
    }, [liveness.phase, showResult]);

    // ── Accessibility announcements ─────────────────────
    // Announce coaching changes for VoiceOver/TalkBack users, at most one per
    // second so rapid state flips don't flood the screen reader.

    const lastAnnounceRef = useRef<{ key: GuidanceKey | null; t: number }>({ key: null, t: 0 });
    useEffect(() => {
        if (!livenessEnabled) return;
        const guidance = liveness.guidance;
        const last = lastAnnounceRef.current;
        if (guidance === last.key) return;
        // Trailing debounce: rapid guidance flips announce only the latest,
        // once the 1s window from the previous announcement has passed.
        const wait = Math.max(0, 1000 - (Date.now() - last.t));
        const id = setTimeout(() => {
            lastAnnounceRef.current = { key: guidance, t: Date.now() };
            AccessibilityInfo.announceForAccessibility(GUIDANCE_A11Y[guidance]);
        }, wait);
        return () => clearTimeout(id);
    }, [liveness.guidance, livenessEnabled]);

    // ── Announce the blink → head-turn switch (one-shot) ─
    // The chip covers sighted users; this covers haptics + screen readers.

    const switchAnnouncedRef = useRef(false);
    useEffect(() => {
        if (liveness.challenge !== 'turn' || switchAnnouncedRef.current) return;
        switchAnnouncedRef.current = true;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        const reason =
            liveness.blinkTimeouts > 0 ? "Blink didn't register. Turn your head instead." : 'Switching to a head turn.';
        AccessibilityInfo.announceForAccessibility(reason);
    }, [liveness.challenge, liveness.blinkTimeouts]);

    // ── Dev debug overlay polling ───────────────────────

    useEffect(() => {
        if (!showDebug || !livenessEnabled) return;
        const id = setInterval(() => setDebugSnap(liveness.getDebugSnapshot()), 500);
        return () => clearInterval(id);
    }, [showDebug, livenessEnabled, liveness]);

    // ── Handlers ─────────────────────────────────────────

    const handleCancel = useCallback(() => {
        restoreBrightness();
        onDismiss();
    }, [onDismiss]);

    const handleDismissResult = useCallback(() => {
        setShowResult(null);
        setFailMessage(null);
        onDismiss();
    }, [onDismiss]);

    const handleRetry = useCallback(() => {
        // Reset everything and start the same flow fresh. The blink→turn
        // ladder is preserved across retries within this sheet session.
        retryingRef.current = false;
        captureStartedRef.current = false;
        switchAnnouncedRef.current = false;
        straightPhotoRef.current = null;
        setFrozenPhoto(null);
        setShowResult(null);
        setFailMessage(null);
        setMaxBrightness();
        liveness.reset({ preserveLadder: true });
        setCameraMounted(true);
    }, [liveness]);

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
            <Text style={[styles.protoTitleItalic, { color: palette.sage }]}>{copy.successAccent}</Text>
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
                        palette={palette}
                    />
                )}
                {showResult === 'network' && (
                    <NetworkOverlay onDismiss={handleDismissResult} onRetry={handleRetry} palette={palette} />
                )}
                {showResult === 'fail' && (
                    <FailedOverlay
                        onDismiss={handleDismissResult}
                        onRetry={handleRetry}
                        title={mode === 'register' ? 'Registration Failed' : 'Verification Failed'}
                        subtitle={failMessage ?? undefined}
                        palette={palette}
                    />
                )}
            </View>
        );
    }

    if (!device || !hasPermission) {
        // iOS never re-shows the system prompt after a deny, so the only path
        // forward is the Settings screen — offer it instead of a dead end.
        return (
            <View style={[styles.container, styles.permissionContainer]}>
                <Text style={styles.permissionText}>
                    {!device
                        ? 'No camera available'
                        : 'Lyfe needs the camera to verify it’s really you. Enable camera access in Settings.'}
                </Text>
                {device && !hasPermission ? (
                    <Pressable
                        style={[
                            styles.cancelButton,
                            { alignSelf: 'center', marginTop: 24, backgroundColor: palette.terra },
                        ]}
                        onPress={() => Linking.openSettings()}
                        accessibilityLabel="Open Settings"
                    >
                        <Text style={styles.cancelText}>Open Settings</Text>
                    </Pressable>
                ) : null}
                <Pressable
                    style={[
                        styles.cancelButton,
                        { alignSelf: 'center', marginTop: device && !hasPermission ? 12 : 24 },
                    ]}
                    onPress={onDismiss}
                >
                    <Text style={styles.cancelText}>Back</Text>
                </Pressable>
            </View>
        );
    }

    const failTitle = mode === 'register' ? 'Registration Failed' : 'Verification Failed';
    // Attempt cap: after MAX_VERIFY_FAILS verify failures in one session, stop
    // burning Rekognition calls and route to the human path (manager check-in).
    const attemptsCapped = mode === 'verify' && failCount >= MAX_VERIFY_FAILS;
    const cappedSubtitle = attemptsCapped
        ? `${failMessage ?? 'Verification failed.'}\n\nAsk your manager to check you in from their device.`
        : (failMessage ?? undefined);

    // ── Status tick semantics ──
    // Proximity: already passed by parent useCheckInFlow before this modal opens.
    const proximityPassed = true;
    // Liveness: the challenge has been completed once the capture fires.
    const livenessPassed = liveness.phase === 'capture' || processing || showResult === 'pass';
    const challengeLabel = liveness.challenge === 'turn' ? 'turn' : 'blink';
    const livenessText = livenessPassed ? `${challengeLabel} ok` : `${challengeLabel}…`;
    // Match: Rekognition + optional re-proximity. Sage on showResult=pass.
    const matchPassed = showResult === 'pass';
    const matchText = matchPassed ? 'match ok' : processing ? 'verifying…' : 'queued';

    const ringColor = livenessPassed ? palette.sage : palette.terra;

    // ── Blink → head-turn switch messaging ──
    // The turn challenge only ever runs as a fallback, so say WHY, visibly.
    const inTurnChallenge = liveness.phase === 'challenge_turn_left' || liveness.phase === 'challenge_turn_right';
    const turnSwitchCopy =
        liveness.blinkTimeouts > 0
            ? "Blink didn't register — turn your head instead"
            : liveness.eyeDataMissing
              ? "Can't see your eyes (sunglasses?) — turn your head instead"
              : "We'll use a head turn this time";

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
                            backgroundColor: palette.paper,
                            paddingBottom: insets.bottom + 20,
                        },
                    ]}
                >
                    {/* Drag handle */}
                    <View style={[styles.handle, { backgroundColor: palette.faint }]} />

                    {/* Eyebrow + title */}
                    <Text style={[styles.eyebrow, { color: palette.terra }]}>{copy.eyebrow}</Text>
                    <Text style={[styles.title, { color: palette.ink }]}>
                        {copy.titleLead}
                        <Text style={[styles.titleItalic, { color: palette.terra }]}>{copy.titleAccent}</Text>
                        {copy.titleTail}
                    </Text>

                    {/* Viewfinder: 3:4 aspect, camera behind a circle mask */}
                    <View testID="face-viewfinder" style={styles.viewfinder} onLayout={handleCameraLayout}>
                        <Camera
                            style={StyleSheet.absoluteFill}
                            device={device}
                            isActive={cameraMounted}
                            outputs={liveness.frameOutput ? [photoOutput, liveness.frameOutput] : [photoOutput]}
                            onPreviewStarted={() => setCameraReady(true)}
                        />

                        {/* Frozen shot while the server verifies */}
                        {frozenPhoto && (
                            <Image
                                source={{
                                    uri: frozenPhoto.startsWith('file://') ? frozenPhoto : `file://${frozenPhoto}`,
                                }}
                                style={StyleSheet.absoluteFill}
                                resizeMode="cover"
                            />
                        )}

                        {/* Circle mask + progress ring */}
                        {cameraLayout.width > 0 && cameraLayout.height > 0 && (
                            <>
                                <CircleMask
                                    width={cameraLayout.width}
                                    height={cameraLayout.height}
                                    fill={palette.mask}
                                />
                                <ProgressRing
                                    width={cameraLayout.width}
                                    height={cameraLayout.height}
                                    progress={liveness.progress}
                                    color={ringColor}
                                    trackColor={palette.rule}
                                    indeterminate={processing}
                                />
                            </>
                        )}

                        {/* Camera warm-up: solid cover until the session is live */}
                        {!cameraReady && (
                            <View style={[StyleSheet.absoluteFill, styles.warmup, { backgroundColor: palette.mask }]}>
                                <ActivityIndicator size="small" color={palette.terra} />
                                <Text style={[styles.warmupText, { color: palette.muted }]}>Starting camera…</Text>
                            </View>
                        )}

                        {/* Coaching line under the circle */}
                        <View style={styles.viewfinderPromptWrap} pointerEvents="none">
                            <Text style={[styles.viewfinderPrompt, { color: palette.ink }]}>
                                {GUIDANCE_COPY[liveness.guidance]}
                            </Text>
                        </View>

                        {/* Challenge-switch chip: make the blink → head-turn
                            fallback unmistakable instead of silently changing
                            the prompt. Visible for the whole turn challenge. */}
                        {inTurnChallenge && (
                            <Animated.View
                                entering={FadeIn.duration(240)}
                                style={styles.switchChipWrap}
                                pointerEvents="none"
                            >
                                <View
                                    style={[
                                        styles.switchChip,
                                        { backgroundColor: palette.paperEl, borderColor: palette.rule },
                                    ]}
                                >
                                    <Ionicons name="swap-horizontal" size={13} color={palette.terra} />
                                    <Text style={[styles.switchChipText, { color: palette.ink }]}>
                                        {turnSwitchCopy}
                                    </Text>
                                </View>
                            </Animated.View>
                        )}

                        {/* Scanning shimmer inside the circle while working */}
                        {!livenessPassed && cameraLayout.width > 0 && (
                            <View
                                pointerEvents="none"
                                style={[
                                    styles.shimmerBand,
                                    {
                                        top: LIVENESS_CIRCLE.cy * cameraLayout.height - 1,
                                        left: cameraLayout.width * (LIVENESS_CIRCLE.cx - LIVENESS_CIRCLE.rx * 0.72),
                                        right:
                                            cameraLayout.width * (1 - LIVENESS_CIRCLE.cx - LIVENESS_CIRCLE.rx * 0.72),
                                    },
                                ]}
                            >
                                <ShimmerOverlay color={palette.terra} intensity="cc" durationMs={1400} radius={0} />
                            </View>
                        )}

                        {/* Dev debug */}
                        {showDebug && debugSnap ? (
                            <View style={styles.debugOverlay}>
                                <Text style={styles.debugText}>Phase: {debugSnap.phase}</Text>
                                <Text style={styles.debugText}>Yaw: {debugSnap.yaw}°</Text>
                                <Text style={styles.debugText}>
                                    Eyes: {debugSnap.leftEye?.toFixed(2) ?? '—'} /{' '}
                                    {debugSnap.rightEye?.toFixed(2) ?? '—'}
                                </Text>
                                <Text style={styles.debugText}>
                                    Base: {debugSnap.baseline?.toFixed(2) ?? '—'} · n={debugSnap.armingSamples}
                                </Text>
                                <Text style={styles.debugText}>
                                    Faces: {debugSnap.faceCount} · {debugSnap.fps}fps
                                </Text>
                            </View>
                        ) : null}
                    </View>

                    {/* 3 status ticks */}
                    <View style={styles.tickRow}>
                        {copy.showProximityTick && (
                            <StatusTick label="Proximity" passed={proximityPassed} text="100m OK" palette={palette} />
                        )}
                        <StatusTick label="Liveness" passed={livenessPassed} text={livenessText} palette={palette} />
                        {copy.showMatchTick ? (
                            <StatusTick label="Match" passed={matchPassed} text={matchText} palette={palette} />
                        ) : (
                            <>
                                <StatusTick
                                    label="Photo"
                                    passed={livenessPassed}
                                    text={livenessPassed ? 'ready' : '—'}
                                    palette={palette}
                                />
                                <StatusTick
                                    label="Save"
                                    passed={matchPassed}
                                    text={matchPassed ? 'saved' : processing ? 'saving…' : 'queued'}
                                    palette={palette}
                                />
                            </>
                        )}
                    </View>

                    {/* PDPA consent note (enrollment only) */}
                    {mode === 'register' ? (
                        <Text style={[styles.consentNote, { color: palette.muted }]}>
                            Your face photo is stored securely and used only to verify you at event check-ins. It&apos;s
                            deleted with your account.
                        </Text>
                    ) : null}

                    {/* CTA (informational — the flow auto-progresses) */}
                    <View
                        style={[
                            styles.cta,
                            {
                                backgroundColor: livenessPassed ? palette.terra : palette.paperEl,
                                borderColor: livenessPassed ? palette.terra : palette.rule,
                            },
                        ]}
                    >
                        <Text
                            style={[
                                styles.ctaText,
                                {
                                    color: livenessPassed ? palette.paperEl : palette.ink,
                                },
                            ]}
                        >
                            {livenessPassed ? copy.ctaActive : copy.ctaCapturing}
                        </Text>
                        {livenessPassed ? <Text style={[styles.ctaArrow, { color: palette.paperEl }]}>→</Text> : null}
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
                    palette={palette}
                />
            )}
            {showResult === 'network' && (
                <NetworkOverlay onDismiss={handleDismissResult} onRetry={handleRetry} palette={palette} />
            )}
            {showResult === 'fail' && (
                <FailedOverlay
                    onDismiss={handleDismissResult}
                    onRetry={attemptsCapped ? undefined : handleRetry}
                    title={attemptsCapped ? 'Let’s get you checked in another way' : failTitle}
                    subtitle={cappedSubtitle}
                    palette={palette}
                />
            )}

            {/* One-time primer: teaches the gesture before the first check-in */}
            {showPrimer && !showResult && (
                <Animated.View entering={FadeIn.duration(200)} style={styles.protoOverlay}>
                    <View style={[styles.protoCard, { backgroundColor: palette.paper }]}>
                        <Text style={[styles.protoTitle, { color: palette.ink }]}>
                            One blink,{' '}
                            <Text style={[styles.protoTitleItalic, { color: palette.terra }]}>you’re in</Text>
                        </Text>
                        <View style={styles.primerRows}>
                            <View style={styles.primerRow}>
                                <Ionicons name="scan-circle-outline" size={22} color={palette.terra} />
                                <Text style={[styles.primerText, { color: palette.muted }]}>
                                    Fill the circle with your face
                                </Text>
                            </View>
                            <View style={styles.primerRow}>
                                <Ionicons name="eye-outline" size={22} color={palette.terra} />
                                <Text style={[styles.primerText, { color: palette.muted }]}>Blink when asked</Text>
                            </View>
                            <View style={styles.primerRow}>
                                <Ionicons name="checkmark-circle-outline" size={22} color={palette.sage} />
                                <Text style={[styles.primerText, { color: palette.muted }]}>
                                    You&apos;re on the booth
                                </Text>
                            </View>
                        </View>
                        <Pressable
                            testID="face-capture-primer-dismiss"
                            onPress={handleDismissPrimer}
                            style={({ pressed }) => [
                                styles.protoCta,
                                { backgroundColor: pressed ? palette.terraPressed : palette.terra, marginTop: 18 },
                            ]}
                            accessibilityLabel="Start check-in"
                        >
                            <Text style={styles.protoCtaText}>Got it</Text>
                            <Text style={styles.protoCtaArrow}>→</Text>
                        </Pressable>
                    </View>
                </Animated.View>
            )}
        </View>
    );
}

// ── Styles ─────────────────────────────────────────────────
// Geometry/typography only — colors come from the theme palette inline.

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000000' },
    permissionContainer: { justifyContent: 'center', alignItems: 'center', padding: 32 },
    permissionText: { color: '#FFFFFF', fontSize: 16, textAlign: 'center' },

    // Bottom sheet shell
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
        alignSelf: 'center',
        marginBottom: 10,
    },
    eyebrow: {
        fontFamily: 'Inter-SemiBold',
        fontSize: 10.5,
        letterSpacing: 1.2,
    },
    title: {
        fontFamily: 'Fraunces',
        fontWeight: '500',
        fontSize: 22,
        letterSpacing: -0.4,
        lineHeight: 26,
        marginTop: 4,
    },
    titleItalic: {
        fontFamily: 'Fraunces-Italic',
        fontWeight: '500',
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
    warmup: {
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        zIndex: 2,
    },
    warmupText: {
        fontFamily: 'Fraunces-Italic',
        fontSize: 14,
    },

    // Coaching line (italic serif) — sits on the mask below the circle
    viewfinderPromptWrap: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 12,
        alignItems: 'center',
        gap: 3,
    },
    viewfinderPrompt: {
        fontFamily: 'Fraunces-Italic',
        fontSize: 16,
        textAlign: 'center',
    },
    viewfinderHint: {
        fontFamily: 'Inter-SemiBold',
        fontSize: 11,
        textAlign: 'center',
    },

    // Blink → head-turn switch chip (top of viewfinder)
    switchChipWrap: {
        position: 'absolute',
        top: 12,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 2,
    },
    switchChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 6,
        maxWidth: '88%',
    },
    switchChipText: {
        fontFamily: 'Inter-SemiBold',
        fontSize: 11.5,
    },

    // Status ticks row
    tickRow: {
        marginTop: 14,
        flexDirection: 'row',
        gap: 8,
    },
    tick: {
        flex: 1,
        borderWidth: 1,
        borderRadius: 10,
        paddingVertical: 8,
        paddingHorizontal: 10,
    },
    tickLabel: {
        fontFamily: 'Inter-SemiBold',
        fontSize: 9.5,
        letterSpacing: 0.7,
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
    consentNote: {
        fontFamily: 'Inter-SemiBold',
        fontSize: 11,
        lineHeight: 15,
        marginTop: 10,
        textAlign: 'center',
        paddingHorizontal: 8,
    },

    // One-time primer card
    primerRows: {
        width: '100%',
        marginTop: 16,
        gap: 12,
    },
    primerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    primerText: {
        fontFamily: 'Fraunces-Italic',
        fontSize: 15,
        flex: 1,
    },

    // CTA (informational)
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

    // ── Result card overlays ──
    protoOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.45)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    protoCard: {
        width: '82%',
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
        textAlign: 'center',
    },
    protoTitleItalic: {
        fontFamily: 'Fraunces-Italic',
        fontWeight: '500',
    },
    protoSub: {
        fontFamily: 'Fraunces-Italic',
        fontSize: 14,
        marginTop: 6,
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

    // Full-screen helpers
    debugOverlay: {
        position: 'absolute',
        top: 10,
        left: 10,
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderRadius: 8,
        padding: 8,
        zIndex: 3,
    },
    debugText: {
        color: '#00FF00',
        fontSize: 11,
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        lineHeight: 16,
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
    processingText: { color: '#FFFFFF', fontSize: 20, fontWeight: '600' },
});
