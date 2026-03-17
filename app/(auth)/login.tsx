import LyfeLogo from '@/components/LyfeLogo';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { biometricMeta, getBiometryType, type BiometryType } from '@/lib/biometrics';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Colors';
import { letterSpacing } from '@/constants/platform';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Dimensions,
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

const OVERLAY_TEXT = Colors.light.textInverse;
const OVERLAY_TEXT_MUTED = 'rgba(255,255,255,0.8)';
const OVERLAY_TEXT_SUBTLE = 'rgba(255,255,255,0.6)';
const OVERLAY_TINT = 'rgba(255,255,255,0.18)';
const OVERLAY_BORDER = 'rgba(255,255,255,0.35)';
const BRAND_ORANGE = Colors.light.accent;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/* Heights for the accordion reveal */
const GHOST_BTN_H = 52;
const PHONE_SECTION_H = 180; // generous max — phone input + button + possible error

const PAGE_SPRING = { damping: 22, stiffness: 250, useNativeDriver: true } as const;

export default function LoginScreen() {
    const { colors } = useTheme();
    const { signInWithOtp, verifyOtp, authenticateWithBiometrics, biometricsEnabled } = useAuth();

    const [step, setStep] = useState<'phone' | 'otp'>('phone');
    const [phoneRevealed, setPhoneRevealed] = useState(false);
    const [phone, setPhone] = useState('');
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [cooldown, setCooldown] = useState(0);
    const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const [biometryType, setBiometryType] = useState<BiometryType>('none');
    const [isBiometricLoading, setIsBiometricLoading] = useState(false);

    const otpRefs = useRef<(TextInput | null)[]>([]);
    const phoneInputRef = useRef<TextInput | null>(null);

    // Accordion: 0 = ghost button visible, 1 = phone input revealed
    const expandAnim = useRef(new Animated.Value(0)).current;
    // Page slide: 0 = phone page, 1 = OTP page
    const pageAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        getBiometryType().then(setBiometryType);
    }, []);

    useEffect(() => {
        return () => {
            if (cooldownRef.current) clearInterval(cooldownRef.current);
        };
    }, []);

    const startCooldown = () => {
        setCooldown(60);
        if (cooldownRef.current) clearInterval(cooldownRef.current);
        cooldownRef.current = setInterval(() => {
            setCooldown((prev) => {
                if (prev <= 1) {
                    clearInterval(cooldownRef.current!);
                    cooldownRef.current = null;
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const showBiometricButton = biometricsEnabled && biometryType !== 'none';
    const { label: biometricLabel, icon: biometricIcon } = biometricMeta(biometryType);

    /* ── Accordion: ghost button → phone input ── */

    const expandPhone = () => {
        setPhoneRevealed(true);
        Animated.spring(expandAnim, {
            toValue: 1,
            damping: 18,
            stiffness: 140,
            useNativeDriver: false, // needed for maxHeight
        }).start();
        setTimeout(() => phoneInputRef.current?.focus(), 500);
    };

    /* ── Page slide: phone ↔ OTP ── */

    const goToOtp = () => {
        setStep('otp');
        setError(null);
        Animated.spring(pageAnim, { toValue: 1, ...PAGE_SPRING }).start();
        setTimeout(() => otpRefs.current[0]?.focus(), 350);
    };

    const goToPhone = () => {
        setError(null);
        setOtp(['', '', '', '', '', '']);
        Animated.spring(pageAnim, { toValue: 0, ...PAGE_SPRING }).start(() => setStep('phone'));
    };

    /* ── Handlers ── */

    const handleBiometricSignIn = async () => {
        if (isBiometricLoading) return;
        setIsBiometricLoading(true);
        setError(null);
        try {
            await authenticateWithBiometrics();
        } catch (e) {
            if (__DEV__) console.error('[FaceID] Auth error:', e);
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
        if (otpError) {
            setError(otpError.message);
            return;
        }
        startCooldown();
        goToOtp();
    };

    const handleOtpChange = (value: string, index: number) => {
        const digits = value.replace(/\D/g, '');
        if (digits.length > 1) {
            const newOtp = ['', '', '', '', '', ''];
            digits
                .slice(0, 6)
                .split('')
                .forEach((ch, i) => {
                    newOtp[i] = ch;
                });
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
        if (otpCode.length !== 6) {
            setError('Please enter the 6-digit code');
            return;
        }
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

    /* ── Accordion interpolations (JS-driven for height) ── */

    const ghostOpacity = expandAnim.interpolate({
        inputRange: [0, 0.35],
        outputRange: [1, 0],
        extrapolate: 'clamp',
    });
    const ghostMaxH = expandAnim.interpolate({
        inputRange: [0, 0.5],
        outputRange: [GHOST_BTN_H, 0],
        extrapolate: 'clamp',
    });

    const phoneOpacity = expandAnim.interpolate({
        inputRange: [0.25, 0.7],
        outputRange: [0, 1],
        extrapolate: 'clamp',
    });
    const phoneMaxH = expandAnim.interpolate({
        inputRange: [0.15, 0.85],
        outputRange: [0, PHONE_SECTION_H],
        extrapolate: 'clamp',
    });
    const phoneTranslateY = expandAnim.interpolate({
        inputRange: [0.15, 0.85],
        outputRange: [24, 0],
        extrapolate: 'clamp',
    });

    /* ── Page slide interpolations (native-driven) ── */

    const page1TranslateX = pageAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -SCREEN_WIDTH],
    });
    const page1Opacity = pageAnim.interpolate({
        inputRange: [0, 0.3],
        outputRange: [1, 0],
    });

    const page2TranslateX = pageAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [SCREEN_WIDTH, 0],
    });
    const page2Opacity = pageAnim.interpolate({
        inputRange: [0.7, 1],
        outputRange: [0, 1],
    });

    /* ── Render ── */

    return (
        <View style={[styles.container, { backgroundColor: BRAND_ORANGE }]}>
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

                            <View style={styles.formContainer}>
                                {/* ═══ Page 1: Welcome + Phone ═══ */}
                                <Animated.View
                                    pointerEvents={step === 'phone' ? 'auto' : 'none'}
                                    style={{
                                        opacity: page1Opacity,
                                        transform: [{ translateX: page1TranslateX }],
                                    }}
                                >
                                    {showBiometricButton ? (
                                        <>
                                            {/* FaceID — always visible */}
                                            <TouchableOpacity
                                                style={styles.biometricButton}
                                                onPress={handleBiometricSignIn}
                                                disabled={isBiometricLoading}
                                                activeOpacity={0.8}
                                                accessibilityRole="button"
                                                accessibilityLabel={`Sign in with ${biometricLabel}`}
                                            >
                                                {isBiometricLoading ? (
                                                    <ActivityIndicator color={BRAND_ORANGE} />
                                                ) : (
                                                    <>
                                                        <Ionicons name={biometricIcon} size={26} color={BRAND_ORANGE} />
                                                        <Text style={[styles.buttonText, { color: colors.accent }]}>
                                                            Sign in with {biometricLabel}
                                                        </Text>
                                                    </>
                                                )}
                                            </TouchableOpacity>

                                            {/* Divider */}
                                            <View style={styles.dividerRow}>
                                                <View
                                                    style={[
                                                        styles.dividerLine,
                                                        { backgroundColor: OVERLAY_TEXT_SUBTLE },
                                                    ]}
                                                />
                                                <Text style={[styles.dividerText, { color: OVERLAY_TEXT_SUBTLE }]}>
                                                    or
                                                </Text>
                                                <View
                                                    style={[
                                                        styles.dividerLine,
                                                        { backgroundColor: OVERLAY_TEXT_SUBTLE },
                                                    ]}
                                                />
                                            </View>

                                            {/* Ghost button — fades out + shrinks */}
                                            <Animated.View
                                                style={{
                                                    opacity: ghostOpacity,
                                                    maxHeight: ghostMaxH,
                                                    overflow: 'hidden',
                                                }}
                                                pointerEvents={phoneRevealed ? 'none' : 'auto'}
                                            >
                                                <TouchableOpacity
                                                    style={styles.ghostButton}
                                                    onPress={expandPhone}
                                                    activeOpacity={0.8}
                                                    accessibilityRole="button"
                                                    accessibilityLabel="Log in using phone number"
                                                >
                                                    <Text style={styles.ghostButtonText}>Log in with phone number</Text>
                                                </TouchableOpacity>
                                            </Animated.View>

                                            {/* Phone input — fades in + slides up */}
                                            <Animated.View
                                                style={{
                                                    opacity: phoneOpacity,
                                                    maxHeight: phoneMaxH,
                                                    overflow: 'hidden',
                                                    transform: [{ translateY: phoneTranslateY }],
                                                }}
                                                pointerEvents={phoneRevealed ? 'auto' : 'none'}
                                            >
                                                {renderPhoneInput()}
                                            </Animated.View>
                                        </>
                                    ) : (
                                        /* No biometrics — show phone input directly */
                                        <>
                                            <Text style={[styles.heading, { color: OVERLAY_TEXT }]}>Welcome back</Text>
                                            <Text style={[styles.subheading, { color: OVERLAY_TEXT_MUTED }]}>
                                                Enter your phone number to continue
                                            </Text>
                                            {renderPhoneInput()}
                                        </>
                                    )}
                                </Animated.View>

                                {/* ═══ Page 2: OTP ═══ */}
                                <Animated.View
                                    pointerEvents={step === 'otp' ? 'auto' : 'none'}
                                    style={[
                                        StyleSheet.absoluteFill,
                                        {
                                            opacity: page2Opacity,
                                            transform: [{ translateX: page2TranslateX }],
                                        },
                                    ]}
                                >
                                    <Text style={[styles.heading, { color: OVERLAY_TEXT }]}>Verify your number</Text>
                                    <Text style={[styles.subheading, { color: OVERLAY_TEXT_MUTED }]}>
                                        Enter the 6-digit code sent to{'\n'}+65 {phone}
                                    </Text>

                                    <View style={styles.otpContainer}>
                                        {otp.map((digit, index) => (
                                            <TextInput
                                                key={index}
                                                ref={(ref) => {
                                                    otpRefs.current[index] = ref;
                                                }}
                                                style={[
                                                    styles.otpInput,
                                                    {
                                                        backgroundColor: OVERLAY_TINT,
                                                        borderColor: digit
                                                            ? OVERLAY_TEXT
                                                            : error
                                                              ? colors.danger
                                                              : OVERLAY_BORDER,
                                                        color: OVERLAY_TEXT,
                                                    },
                                                ]}
                                                value={digit}
                                                onChangeText={(v) => handleOtpChange(v, index)}
                                                onKeyPress={({ nativeEvent }) =>
                                                    handleOtpKeyPress(nativeEvent.key, index)
                                                }
                                                keyboardType="number-pad"
                                                textContentType={index === 0 ? 'oneTimeCode' : 'none'}
                                                autoComplete={index === 0 ? 'one-time-code' : 'off'}
                                                selectTextOnFocus
                                                accessibilityLabel={`OTP digit ${index + 1} of 6`}
                                            />
                                        ))}
                                    </View>

                                    {error && <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>}

                                    <TouchableOpacity
                                        style={[styles.primaryButton, styles.whiteButton]}
                                        onPress={() => handleVerifyOtp()}
                                        disabled={isLoading}
                                        activeOpacity={0.8}
                                        accessibilityRole="button"
                                        accessibilityLabel="Verify OTP"
                                    >
                                        {isLoading ? (
                                            <ActivityIndicator color={BRAND_ORANGE} />
                                        ) : (
                                            <Text style={[styles.buttonText, { color: colors.accent }]}>Verify</Text>
                                        )}
                                    </TouchableOpacity>

                                    <View style={styles.otpLinksRow}>
                                        <TouchableOpacity
                                            style={styles.backLink}
                                            onPress={goToPhone}
                                            activeOpacity={0.7}
                                            accessibilityRole="button"
                                            accessibilityLabel="Use a different phone number"
                                        >
                                            <Ionicons name="arrow-back" size={16} color={OVERLAY_TEXT} />
                                            <Text style={[styles.linkText, { color: OVERLAY_TEXT }]}>
                                                Different number
                                            </Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={styles.backLink}
                                            onPress={handleSendOtp}
                                            disabled={cooldown > 0 || isLoading}
                                            activeOpacity={0.7}
                                            accessibilityRole="button"
                                            accessibilityLabel={
                                                cooldown > 0 ? `Resend OTP in ${cooldown} seconds` : 'Resend OTP'
                                            }
                                        >
                                            <Ionicons
                                                name="refresh"
                                                size={16}
                                                color={cooldown > 0 ? OVERLAY_TEXT_SUBTLE : OVERLAY_TEXT}
                                            />
                                            <Text
                                                style={[
                                                    styles.linkText,
                                                    { color: cooldown > 0 ? OVERLAY_TEXT_SUBTLE : OVERLAY_TEXT },
                                                ]}
                                            >
                                                {cooldown > 0 ? `Resend (${cooldown}s)` : 'Resend OTP'}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>

                                    {showBiometricButton && (
                                        <TouchableOpacity
                                            style={styles.biometricPill}
                                            onPress={handleBiometricSignIn}
                                            disabled={isBiometricLoading}
                                            activeOpacity={0.7}
                                            accessibilityRole="button"
                                            accessibilityLabel={`Use ${biometricLabel} instead`}
                                        >
                                            {isBiometricLoading ? (
                                                <ActivityIndicator size="small" color={OVERLAY_TEXT} />
                                            ) : (
                                                <>
                                                    <Ionicons name={biometricIcon} size={16} color={OVERLAY_TEXT} />
                                                    <Text style={[styles.pillText, { color: OVERLAY_TEXT }]}>
                                                        Use {biometricLabel} instead
                                                    </Text>
                                                </>
                                            )}
                                        </TouchableOpacity>
                                    )}
                                </Animated.View>
                            </View>

                            <Text style={[styles.footer, { color: OVERLAY_TEXT_SUBTLE }]}>
                                By continuing, you agree to Lyfe's Terms of Service
                            </Text>
                        </View>
                    </KeyboardAvoidingView>
                </TouchableWithoutFeedback>
            </SafeAreaView>
        </View>
    );

    /* ── Shared phone input section ── */
    function renderPhoneInput() {
        return (
            <>
                <View
                    style={[
                        styles.phoneInputContainer,
                        {
                            backgroundColor: OVERLAY_TINT,
                            borderColor: error ? colors.danger : OVERLAY_BORDER,
                        },
                    ]}
                >
                    <View style={styles.countryCodeContainer}>
                        <Text style={[styles.countryCodeText, { color: OVERLAY_TEXT }]}>+65</Text>
                    </View>
                    <View style={[styles.dividerVertical, { backgroundColor: OVERLAY_BORDER }]} />
                    <TextInput
                        ref={phoneInputRef}
                        style={[styles.phoneInput, { color: OVERLAY_TEXT }]}
                        value={phone}
                        onChangeText={(text) => {
                            let cleaned = text.replace(/\D/g, '');
                            if (cleaned.startsWith('65') && cleaned.length > 8) cleaned = cleaned.substring(2);
                            const truncated = cleaned.slice(0, 8);
                            setPhone(
                                truncated.length > 4 ? `${truncated.slice(0, 4)} ${truncated.slice(4)}` : truncated,
                            );
                            setError(null);
                        }}
                        keyboardType="number-pad"
                        placeholder="9XXX XXXX"
                        placeholderTextColor={OVERLAY_TEXT_SUBTLE}
                        maxLength={9}
                        accessibilityLabel="Phone number"
                        accessibilityHint="Enter your 8-digit Singapore phone number"
                    />
                </View>

                {error && <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>}

                <TouchableOpacity
                    style={[styles.primaryButton, styles.whiteButton]}
                    onPress={handleSendOtp}
                    disabled={isLoading}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel="Send OTP"
                >
                    {isLoading ? (
                        <ActivityIndicator color={BRAND_ORANGE} />
                    ) : (
                        <Text style={[styles.buttonText, { color: colors.accent }]}>Send OTP</Text>
                    )}
                </TouchableOpacity>
            </>
        );
    }
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    safeArea: { flex: 1 },
    keyboardView: { flex: 1 },
    content: { flex: 1, paddingHorizontal: 32, justifyContent: 'center' },
    logoContainer: { alignItems: 'center', marginBottom: 48 },
    formContainer: {
        width: '100%',
        maxWidth: 400,
        alignSelf: 'center',
        // OTP page (Page 2) uses absoluteFill — its content is taller than Page 1.
        // On Android, KAV behavior='height' shrinks the view, causing the verify
        // button to overflow into the TOS footer. minHeight prevents this.
        ...(Platform.OS === 'android' && { minHeight: 310 }),
    },

    heading: { fontSize: 28, fontWeight: '700', marginBottom: 8, letterSpacing: letterSpacing(-0.5) },
    subheading: { fontSize: 15, marginBottom: 28, lineHeight: 22 },

    /* Phone input */
    phoneInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1.5,
        borderRadius: 16,
        paddingHorizontal: 16,
        height: 56,
        marginBottom: 8,
    },
    countryCodeContainer: { flexDirection: 'row', alignItems: 'center', marginRight: 12 },
    countryCodeText: { fontSize: 16, fontWeight: '600', letterSpacing: 0.5 },
    dividerVertical: { width: 1, height: 24, marginRight: 12, opacity: 0.5 },
    phoneInput: { flex: 1, fontSize: 18, fontWeight: '500', letterSpacing: 1 },

    /* OTP */
    otpContainer: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 8 },
    otpInput: {
        width: 48,
        height: 56,
        borderWidth: 1.5,
        borderRadius: 12,
        textAlign: 'center',
        fontSize: 22,
        fontWeight: '600',
    },

    /* Buttons */
    primaryButton: { height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
    whiteButton: { backgroundColor: Colors.light.surfacePrimary },
    buttonText: { fontSize: 16, fontWeight: '600', letterSpacing: 0.3 },
    biometricButton: {
        height: 56,
        borderRadius: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        backgroundColor: Colors.light.surfacePrimary,
    },
    ghostButton: {
        height: 52,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.4)',
    },
    ghostButtonText: { color: Colors.light.textInverse, fontSize: 15, fontWeight: '600' },

    /* Divider */
    dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 20, gap: 12 },
    dividerLine: { flex: 1, height: StyleSheet.hairlineWidth },
    dividerText: { fontSize: 13, fontWeight: '500' },

    /* OTP page links */
    otpLinksRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 },
    backLink: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: 8,
    },
    linkText: { fontSize: 14, fontWeight: '500' },
    biometricPill: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: 24,
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
        alignSelf: 'center',
    },
    pillText: { fontSize: 13, fontWeight: '500' },

    /* Error & footer */
    errorText: { fontSize: 13, marginBottom: 16, marginTop: 4 },
    footer: { fontSize: 12, textAlign: 'center', marginTop: 12, lineHeight: 18 },
});
