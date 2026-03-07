import LyfeLogo from '@/components/LyfeLogo';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getBiometryType, type BiometryType } from '@/lib/biometrics';
import { Ionicons } from '@expo/vector-icons';
import { createVideoPlayer, VideoView } from 'expo-video';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';

// Create the player at module level so it starts buffering before the screen mounts.
const bgPlayer = createVideoPlayer(require('@/assets/videos/login-bg.mp4'));
bgPlayer.loop = true;
bgPlayer.muted = true;
bgPlayer.play();

const OVERLAY_TEXT = '#FFFFFF';
const OVERLAY_TEXT_MUTED = 'rgba(255,255,255,0.8)';
const OVERLAY_TEXT_SUBTLE = 'rgba(255,255,255,0.6)';
const OVERLAY_TINT = 'rgba(0,0,0,0.1)';

type Step = 'welcome' | 'phone' | 'otp';

export default function LoginScreen() {
    const { colors } = useTheme();
    const {
        signInWithOtp,
        verifyOtp,
        pendingBiometricSession,
        authenticateWithBiometrics,
        biometricsEnabled,
    } = useAuth();

    const [step, setStep] = useState<Step>('welcome');
    const [phone, setPhone] = useState('');
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [biometryType, setBiometryType] = useState<BiometryType>('none');
    const [isBiometricLoading, setIsBiometricLoading] = useState(false);

    const otpRefs = useRef<(TextInput | null)[]>([]);
    const fadeAnim = useRef(new Animated.Value(1)).current;
    const videoOpacity = useRef(new Animated.Value(0)).current;
    const phoneInputRef = useRef<TextInput | null>(null);

    const handleFirstFrameRender = () => {
        Animated.timing(videoOpacity, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
        }).start();
    };
    useEffect(() => {
        getBiometryType().then(setBiometryType);
    }, []);

    const animateTransition = (callback: () => void) => {
        Animated.sequence([
            Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
            Animated.timing(fadeAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
        ]).start();
        setTimeout(callback, 150);
    };

    const handleBiometricSignIn = async () => {
        if (isBiometricLoading) return;
        setIsBiometricLoading(true);
        setError(null);
        try {
            await authenticateWithBiometrics();
            // On success AuthGate redirects automatically
        } catch (e) {
            console.error('[FaceID] Auth error:', e);
        } finally {
            setIsBiometricLoading(false);
        }
    };

    const handleSendOtp = async () => {
        const cleanedPhone = phone.replace(/\D/g, '');
        if (cleanedPhone.length !== 8) {
            setError('Please enter a valid 8-digit phone number');
            return;
        }
        if (!/^[89]/.test(cleanedPhone)) {
            setError('Singapore mobile numbers must start with 8 or 9');
            return;
        }
        setError(null);
        setIsLoading(true);
        const { error: otpError } = await signInWithOtp(`+65${cleanedPhone}`);
        setIsLoading(false);
        if (otpError) { setError(otpError.message); return; }
        animateTransition(() => setStep('otp'));
    };

    const handleOtpChange = (value: string, index: number) => {
        const digits = value.replace(/\D/g, '');
        if (digits.length > 1) {
            const newOtp = ['', '', '', '', '', ''];
            digits.slice(0, 6).split('').forEach((ch, i) => { newOtp[i] = ch; });
            setOtp(newOtp);
            const lastIndex = Math.min(digits.length - 1, 5);
            otpRefs.current[lastIndex]?.focus();
            if (digits.length >= 6) handleVerifyOtp(newOtp.join(''));
            return;
        }
        const newOtp = [...otp];
        newOtp[index] = digits;
        setOtp(newOtp);
        if (digits && index < 5) otpRefs.current[index + 1]?.focus();
        if (digits && index === 5 && newOtp.join('').length === 6) handleVerifyOtp(newOtp.join(''));
    };

    const handleOtpKeyPress = (key: string, index: number) => {
        if (key === 'Backspace' && !otp[index] && index > 0) otpRefs.current[index - 1]?.focus();
    };

    const handleVerifyOtp = async (code?: string) => {
        const otpCode = code || otp.join('');
        if (otpCode.length !== 6) { setError('Please enter the 6-digit code'); return; }
        setError(null);
        setIsLoading(true);
        const cleanedPhone = phone.replace(/\D/g, '');
        const { error: verifyError } = await verifyOtp(`+65${cleanedPhone}`, otpCode);
        setIsLoading(false);
        if (verifyError) {
            setError(verifyError.message);
            setOtp(['', '', '', '', '', '']);
            otpRefs.current[0]?.focus();
        }
    };

    // Show Face ID button whenever biometrics is set up on this device
    const showBiometricButton = biometricsEnabled && biometryType !== 'none';
    const biometricLabel = biometryType === 'faceid' ? 'Face ID' : 'Touch ID';
    const biometricIcon: keyof typeof Ionicons.glyphMap = biometryType === 'faceid' ? 'scan' : 'finger-print';

    return (
        <View style={[styles.container, { backgroundColor: colors.accent }]}>
            <Animated.View style={[styles.backgroundVideo, { opacity: videoOpacity }]}>
                <VideoView
                    player={bgPlayer}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    nativeControls={false}
                    allowsFullscreen={false}
                    onFirstFrameRender={handleFirstFrameRender}
                />
            </Animated.View>
            <View style={[styles.videoOverlay, { backgroundColor: OVERLAY_TINT }]} />
            <View style={[styles.videoTint, { backgroundColor: colors.accent }]} />

            <SafeAreaView style={styles.safeArea}>
                <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
                    <KeyboardAvoidingView
                        style={styles.keyboardView}
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    >
                        <View style={styles.content}>
                            <View style={styles.logoContainer}>
                                <LyfeLogo size="lg" color="#F5F5F0" />
                            </View>

                            <Animated.View style={[styles.formContainer, { opacity: fadeAnim }]}>
                                {step === 'welcome' ? (
                                    <>
                                        {/* Face ID button — shown when biometrics is configured */}
                                        {showBiometricButton && (
                                            <>
                                                <TouchableOpacity
                                                    style={[styles.biometricButton, { backgroundColor: colors.accent }]}
                                                    onPress={handleBiometricSignIn}
                                                    disabled={isBiometricLoading}
                                                    activeOpacity={0.8}
                                                    accessibilityRole="button"
                                                    accessibilityLabel={`Sign in with ${biometricLabel}`}
                                                >
                                                    {isBiometricLoading ? (
                                                        <ActivityIndicator color={OVERLAY_TEXT} />
                                                    ) : (
                                                        <>
                                                            <Ionicons name={biometricIcon} size={26} color={OVERLAY_TEXT} />
                                                            <Text style={styles.primaryButtonText}>
                                                                Sign in with {biometricLabel}
                                                            </Text>
                                                        </>
                                                    )}
                                                </TouchableOpacity>

                                                <View style={styles.dividerRow}>
                                                    <View style={[styles.dividerLine, { backgroundColor: OVERLAY_TEXT_SUBTLE }]} />
                                                    <Text style={[styles.dividerText, { color: OVERLAY_TEXT_SUBTLE }]}>or</Text>
                                                    <View style={[styles.dividerLine, { backgroundColor: OVERLAY_TEXT_SUBTLE }]} />
                                                </View>
                                            </>
                                        )}

                                        {/* Phone number button — always visible */}
                                        <TouchableOpacity
                                            style={[
                                                showBiometricButton ? styles.ghostButton : styles.primaryButton,
                                                !showBiometricButton && { backgroundColor: colors.accent },
                                            ]}
                                            onPress={() => animateTransition(() => {
                                                setStep('phone');
                                                setTimeout(() => phoneInputRef.current?.focus(), 200);
                                            })}
                                            activeOpacity={0.8}
                                            accessibilityRole="button"
                                            accessibilityLabel="Log in using phone number"
                                        >
                                            <Text style={showBiometricButton ? styles.ghostButtonText : styles.primaryButtonText}>
                                                Log in with phone number
                                            </Text>
                                        </TouchableOpacity>
                                    </>
                                ) : step === 'phone' ? (
                                    <>
                                        <Text style={[styles.heading, { color: OVERLAY_TEXT }]}>Welcome back</Text>
                                        <Text style={[styles.subheading, { color: OVERLAY_TEXT_MUTED }]}>
                                            Enter your phone number to continue
                                        </Text>

                                        <View style={[styles.phoneInputContainer, {
                                            backgroundColor: colors.background,
                                            borderColor: error ? colors.danger : colors.border,
                                        }]}>
                                            <View style={styles.countryCodeContainer}>
                                                <Text style={[styles.countryCodeText, { color: colors.textPrimary }]}>+65</Text>
                                            </View>
                                            <View style={[styles.dividerVertical, { backgroundColor: colors.border }]} />
                                            <TextInput
                                                ref={phoneInputRef}
                                                style={[styles.phoneInput, { color: colors.textPrimary }]}
                                                value={phone}
                                                onChangeText={(text) => {
                                                    let cleaned = text.replace(/\D/g, '');
                                                    if (cleaned.startsWith('65') && cleaned.length > 8) cleaned = cleaned.substring(2);
                                                    const truncated = cleaned.slice(0, 8);
                                                    setPhone(truncated.length > 4 ? `${truncated.slice(0, 4)} ${truncated.slice(4)}` : truncated);
                                                    setError(null);
                                                }}
                                                keyboardType="number-pad"
                                                placeholder="9XXX XXXX"
                                                placeholderTextColor={colors.textTertiary}
                                                maxLength={9}
                                            />
                                        </View>

                                        {error && <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>}

                                        <TouchableOpacity
                                            style={[styles.primaryButton, { backgroundColor: colors.accent }]}
                                            onPress={handleSendOtp}
                                            disabled={isLoading}
                                            activeOpacity={0.8}
                                        >
                                            {isLoading ? <ActivityIndicator color={OVERLAY_TEXT} /> : <Text style={styles.primaryButtonText}>Send OTP</Text>}
                                        </TouchableOpacity>
                                    </>
                                ) : (
                                    <>
                                        <Text style={[styles.heading, { color: OVERLAY_TEXT }]}>Verify your number</Text>
                                        <Text style={[styles.subheading, { color: OVERLAY_TEXT_MUTED }]}>
                                            Enter the 6-digit code sent to +65 {phone}
                                        </Text>

                                        <View style={styles.otpContainer}>
                                            {otp.map((digit, index) => (
                                                <TextInput
                                                    key={index}
                                                    ref={(ref) => { otpRefs.current[index] = ref; }}
                                                    style={[styles.otpInput, {
                                                        backgroundColor: colors.background,
                                                        borderColor: digit ? colors.accent : error ? colors.danger : colors.border,
                                                        color: colors.textPrimary,
                                                    }]}
                                                    value={digit}
                                                    onChangeText={(v) => handleOtpChange(v, index)}
                                                    onKeyPress={({ nativeEvent }) => handleOtpKeyPress(nativeEvent.key, index)}
                                                    keyboardType="number-pad"
                                                    textContentType={index === 0 ? 'oneTimeCode' : 'none'}
                                                    autoComplete={index === 0 ? 'one-time-code' : 'off'}
                                                    autoFocus={index === 0}
                                                    selectTextOnFocus
                                                    accessibilityLabel={`OTP digit ${index + 1} of 6`}
                                                />
                                            ))}
                                        </View>

                                        {error && <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>}

                                        <TouchableOpacity
                                            style={[styles.primaryButton, { backgroundColor: colors.accent }]}
                                            onPress={() => handleVerifyOtp()}
                                            disabled={isLoading}
                                            activeOpacity={0.8}
                                        >
                                            {isLoading ? <ActivityIndicator color={OVERLAY_TEXT} /> : <Text style={styles.primaryButtonText}>Verify</Text>}
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={styles.linkButton}
                                            onPress={() => { setError(null); setOtp(['', '', '', '', '', '']); animateTransition(() => setStep('phone')); }}
                                        >
                                            <Text style={[styles.linkText, { color: OVERLAY_TEXT }]}>Use a different number</Text>
                                        </TouchableOpacity>
                                    </>
                                )}
                            </Animated.View>

                            <Text style={[styles.footer, { color: OVERLAY_TEXT_SUBTLE }]}>
                                By continuing, you agree to Lyfe's Terms of Service
                            </Text>
                        </View>
                    </KeyboardAvoidingView>
                </TouchableWithoutFeedback>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    backgroundVideo: { ...StyleSheet.absoluteFillObject },
    videoOverlay: { ...StyleSheet.absoluteFillObject, opacity: 0.85 },
    videoTint: { ...StyleSheet.absoluteFillObject, opacity: 0.3 },
    safeArea: { flex: 1 },
    keyboardView: { flex: 1 },
    content: { flex: 1, paddingHorizontal: 32, justifyContent: 'center' },
    logoContainer: { alignItems: 'center', marginBottom: 48 },
    formContainer: { width: '100%', maxWidth: 400, alignSelf: 'center' },
    heading: { fontSize: 28, fontWeight: '700', marginBottom: 8, letterSpacing: -0.5 },
    subheading: { fontSize: 15, marginBottom: 28, lineHeight: 22 },
    phoneInputContainer: {
        flexDirection: 'row', alignItems: 'center', borderWidth: 1.5,
        borderRadius: 16, paddingHorizontal: 16, height: 56, marginBottom: 8,
    },
    countryCodeContainer: { flexDirection: 'row', alignItems: 'center', marginRight: 12 },
    countryCodeText: { fontSize: 16, fontWeight: '600', letterSpacing: 0.5 },
    dividerVertical: { width: 1, height: 24, marginRight: 12, opacity: 0.5 },
    phoneInput: { flex: 1, fontSize: 18, fontWeight: '500', letterSpacing: 1 },
    otpContainer: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 8 },
    otpInput: { width: 48, height: 56, borderWidth: 1.5, borderRadius: 12, textAlign: 'center', fontSize: 22, fontWeight: '600' },
    errorText: { fontSize: 13, marginBottom: 16, marginTop: 4 },
    primaryButton: { height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
    primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', letterSpacing: 0.3 },
    biometricButton: {
        height: 56, borderRadius: 14, flexDirection: 'row',
        alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 8,
    },
    dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 20, gap: 12 },
    dividerLine: { flex: 1, height: StyleSheet.hairlineWidth },
    dividerText: { fontSize: 13, fontWeight: '500' },
    ghostButton: {
        height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
        borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)',
    },
    ghostButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
    linkButton: { alignItems: 'center', marginTop: 16, padding: 8 },
    linkText: { fontSize: 14, fontWeight: '500' },
    footer: { fontSize: 12, textAlign: 'center', marginTop: 12, lineHeight: 18 },
});
