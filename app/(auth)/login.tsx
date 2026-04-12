import LyfeLogo from '@/components/LyfeLogo';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { biometricMeta, getBiometricRefreshToken, getBiometryType, type BiometryType } from '@/lib/biometrics';
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
    const { checkPhoneEligible, signInWithOtp, verifyOtp, authenticateWithBiometrics, biometricsEnabled } = useAuth();

    const [step, setStep] = useState<'phone' | 'otp'>('phone');
    const [phoneRevealed, setPhoneRevealed] = useState(false);
    const [phone, setPhone] = useState('');
    const [otpValue, setOtpValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [cooldown, setCooldown] = useState(0);
    const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const [biometryType, setBiometryType] = useState<BiometryType>('none');
    const [isBiometricLoading, setIsBiometricLoading] = useState(false);
    const [hasStoredToken, setHasStoredToken] = useState(false);

    const hiddenOtpRef = useRef<TextInput | null>(null);
    const phoneInputRef = useRef<TextInput | null>(null);

    // Accordion: 0 = ghost button visible, 1 = phone input revealed
    const expandAnim = useRef(new Animated.Value(0)).current;
    // Page slide: 0 = phone page, 1 = OTP page
    const pageAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        getBiometryType().then(setBiometryType);
        getBiometricRefreshToken().then((token) => setHasStoredToken(!!token));
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

    const showBiometricButton = biometricsEnabled && biometryType !== 'none' && hasStoredToken;
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
        setTimeout(() => hiddenOtpRef.current?.focus(), 350);
    };

    const goToPhone = () => {
        setError(null);
        setOtpValue('');
        Animated.spring(pageAnim, { toValue: 0, ...PAGE_SPRING }).start(() => setStep('phone'));
    };

    /* ── Handlers ── */

    const handleBiometricSignIn = async () => {
        if (isBiometricLoading) return;
        setIsBiometricLoading(true);
        setError(null);
        const { error: bioError } = await authenticateWithBiometrics();
        setIsBiometricLoading(false);
        if (bioError) {
            setError(bioError);
            if (!phoneRevealed) expandPhone();
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

        // Check eligibility before sending OTP
        const fullPhone = `+65${cleanedPhone}`;
        const eligibility = await checkPhoneEligible(fullPhone);
        if (!eligibility.eligible) {
            setIsLoading(false);
            if (eligibility.reason === 'invitation_expired') {
                setError('Your invitation has expired. Please ask your manager for a new invite.');
            } else {
                setError('No account found for this number. Please ask your manager for an invite.');
            }
            return;
        }

        const { error: otpError } = await signInWithOtp(fullPhone);
        setIsLoading(false);
        if (otpError) {
            setError(otpError.message);
            return;
        }
        startCooldown();
        goToOtp();
    };

    const handleOtpInput = (value: string) => {
        const digits = value.replace(/\D/g, '').slice(0, 6);
        setOtpValue(digits);
        setError(null);
        if (digits.length === 6) handleVerifyOtp(digits);
    };

    const handleVerifyOtp = async (code?: string) => {
        const otpCode = code || otpValue;
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
            setOtpValue('');
            hiddenOtpRef.current?.focus();
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
                <TouchableWithoutFeedback onPress={step === 'phone' ? Keyboard.dismiss : undefined} accessible={false}>
                    <KeyboardAvoidingView
                        style={styles.keyboardView}
                        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
                                                testID="login-biometric-button"
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

                                            {error && !phoneRevealed && (
                                                <Text
                                                    testID="login-biometric-error-text"
                                                    style={[styles.errorText, { color: colors.danger, marginTop: 8 }]}
                                                >
                                                    {error}
                                                </Text>
                                            )}

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

                                    <TouchableOpacity
                                        style={styles.otpContainer}
                                        activeOpacity={1}
                                        onPress={() => hiddenOtpRef.current?.focus()}
                                        accessibilityLabel="OTP input"
                                    >
                                        <TextInput
                                            testID="login-otp-input"
                                            ref={hiddenOtpRef}
                                            style={styles.hiddenOtpInput}
                                            value={otpValue}
                                            onChangeText={handleOtpInput}
                                            keyboardType="number-pad"
                                            textContentType="oneTimeCode"
                                            autoComplete="one-time-code"
                                            maxLength={6}
                                            caretHidden
                                        />
                                        {Array.from({ length: 6 }).map((_, index) => {
                                            const digit = otpValue[index] || '';
                                            const isFocused = index === otpValue.length;
                                            return (
                                                <View
                                                    key={index}
                                                    style={[
                                                        styles.otpInput,
                                                        {
                                                            backgroundColor: OVERLAY_TINT,
                                                            borderColor: digit
                                                                ? OVERLAY_TEXT
                                                                : error
                                                                  ? colors.danger
                                                                  : isFocused
                                                                    ? OVERLAY_TEXT
                                                                    : OVERLAY_BORDER,
                                                        },
                                                    ]}
                                                >
                                                    <Text style={[styles.otpDigitText, { color: OVERLAY_TEXT }]}>
                                                        {digit}
                                                    </Text>
                                                </View>
                                            );
                                        })}
                                    </TouchableOpacity>

                                    {error && (
                                        <Text
                                            testID="login-otp-error-text"
                                            style={[styles.errorText, { color: colors.danger }]}
                                        >
                                            {error}
                                        </Text>
                                    )}

                                    <TouchableOpacity
                                        testID="login-verify-button"
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
                    <View testID="login-country-code" style={styles.countryCodeContainer}>
                        <Text style={[styles.countryCodeText, { color: OVERLAY_TEXT }]}>+65</Text>
                    </View>
                    <View style={[styles.dividerVertical, { backgroundColor: OVERLAY_BORDER }]} />
                    <TextInput
                        testID="login-phone-input"
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

                {error && (
                    <Text testID="login-error-text" style={[styles.errorText, { color: colors.danger }]}>
                        {error}
                    </Text>
                )}

                <TouchableOpacity
                    testID="login-send-otp-button"
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
        // Without minHeight the verify button overflows into the TOS footer.
        minHeight: 380,
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
    hiddenOtpInput: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        opacity: 0.01,
        color: 'transparent',
    },
    otpInput: {
        width: 48,
        height: 56,
        borderWidth: 1.5,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    otpDigitText: {
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
});
