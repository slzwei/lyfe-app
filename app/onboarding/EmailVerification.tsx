import { KAV_BEHAVIOR, letterSpacing } from '@/constants/platform';
import { Fonts } from '@/constants/type';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { sendEmailOtp, verifyEmailOtp } from '@/lib/email-verification';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Keyboard,
    KeyboardAvoidingView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

type Step = 'email' | 'otp';

/**
 * Email verification — precondition screen for candidates who haven't yet verified.
 * Not a numbered step in the main 5-step onboarding flow; uses a branded eyebrow label instead.
 */
export default function EmailVerificationScreen() {
    const { colors } = useTheme();
    const { refreshUser } = useAuth();

    const [step, setStep] = useState<Step>('email');
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [cooldown, setCooldown] = useState(0);
    const [emailFocused, setEmailFocused] = useState(false);
    const [otpFocused, setOtpFocused] = useState(false);
    const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const otpInputRef = useRef<TextInput | null>(null);

    useEffect(() => {
        return () => {
            if (cooldownRef.current) clearInterval(cooldownRef.current);
        };
    }, []);

    const startCooldown = useCallback(() => {
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
    }, []);

    const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

    const handleSendCode = async () => {
        if (!isValidEmail(email)) {
            setError('Please enter a valid email address');
            return;
        }

        setIsLoading(true);
        setError(null);

        const result = await sendEmailOtp(email.trim().toLowerCase());
        setIsLoading(false);

        if (result.error) {
            setError(result.error);
        } else {
            setStep('otp');
            startCooldown();
            setTimeout(() => otpInputRef.current?.focus(), 300);
        }
    };

    const handleVerify = async () => {
        if (otp.length !== 6) {
            setError('Please enter the 6-digit code');
            return;
        }

        setIsLoading(true);
        setError(null);

        const result = await verifyEmailOtp(email.trim().toLowerCase(), otp);
        setIsLoading(false);

        if (result.error) {
            setError(result.error);
        } else {
            await refreshUser();
        }
    };

    const handleResend = async () => {
        if (cooldown > 0) return;
        setIsLoading(true);
        setError(null);
        const result = await sendEmailOtp(email.trim().toLowerCase());
        setIsLoading(false);
        if (result.error) {
            setError(result.error);
        } else {
            startCooldown();
        }
    };

    const handleChangeEmail = () => {
        setStep('email');
        setOtp('');
        setError(null);
    };

    const emailBorderColor = error ? colors.danger : emailFocused ? colors.accent : colors.inputBorder;
    const otpBorderColor = error ? colors.danger : otpFocused ? colors.accent : colors.inputBorder;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            <KeyboardAvoidingView style={styles.flex} behavior={KAV_BEHAVIOR}>
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <ScrollView
                        style={styles.flex}
                        contentContainerStyle={styles.scrollContent}
                        keyboardShouldPersistTaps="handled"
                    >
                        <Animated.View entering={FadeInDown.springify().duration(500)}>
                            <Text style={[styles.eyebrow, { color: colors.accent }]}>VERIFY EMAIL</Text>
                            {step === 'email' ? (
                                <>
                                    <Text style={[styles.title, { color: colors.textPrimary }]}>
                                        Your <Text style={[styles.titleItalic, { color: colors.accent }]}>email</Text>,
                                        please.
                                    </Text>
                                    <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                                        We'll use this for important updates about your training and appointments.
                                    </Text>
                                </>
                            ) : (
                                <>
                                    <Text style={[styles.title, { color: colors.textPrimary }]}>
                                        Check your{' '}
                                        <Text style={[styles.titleItalic, { color: colors.accent }]}>inbox.</Text>
                                    </Text>
                                    <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                                        Enter the 6-digit code we sent to{' '}
                                        <Text style={{ color: colors.textPrimary, fontFamily: Fonts.sansSemibold }}>
                                            {email}
                                        </Text>
                                        .
                                    </Text>
                                </>
                            )}
                        </Animated.View>

                        <Animated.View
                            style={styles.inputBlock}
                            entering={FadeInDown.delay(120).springify().duration(500)}
                        >
                            {step === 'email' ? (
                                <>
                                    <TextInput
                                        style={[
                                            styles.input,
                                            {
                                                color: colors.textPrimary,
                                                backgroundColor: colors.inputBackground,
                                                borderColor: emailBorderColor,
                                            },
                                        ]}
                                        placeholder="you@example.com"
                                        placeholderTextColor={colors.textTertiary}
                                        value={email}
                                        onChangeText={(t) => {
                                            setEmail(t);
                                            setError(null);
                                        }}
                                        onFocus={() => setEmailFocused(true)}
                                        onBlur={() => setEmailFocused(false)}
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                        autoComplete="email"
                                        autoFocus
                                        testID="email-verification-input"
                                    />
                                    {error ? (
                                        <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>
                                    ) : null}
                                    <TouchableOpacity
                                        style={[
                                            styles.button,
                                            {
                                                backgroundColor: isValidEmail(email) ? colors.accent : colors.border,
                                            },
                                        ]}
                                        onPress={handleSendCode}
                                        disabled={isLoading || !isValidEmail(email)}
                                        activeOpacity={0.85}
                                        testID="email-send-code-button"
                                    >
                                        {isLoading ? (
                                            <ActivityIndicator color={colors.textInverse} size="small" />
                                        ) : (
                                            <Text style={[styles.buttonText, { color: colors.textInverse }]}>
                                                Send verification code
                                            </Text>
                                        )}
                                    </TouchableOpacity>
                                </>
                            ) : (
                                <>
                                    <TextInput
                                        ref={otpInputRef}
                                        style={[
                                            styles.otpInput,
                                            {
                                                color: colors.textPrimary,
                                                backgroundColor: colors.inputBackground,
                                                borderColor: otpBorderColor,
                                            },
                                        ]}
                                        placeholder="000000"
                                        placeholderTextColor={colors.textTertiary}
                                        value={otp}
                                        onChangeText={(t) => {
                                            setOtp(t.replace(/\D/g, '').slice(0, 6));
                                            setError(null);
                                        }}
                                        onFocus={() => setOtpFocused(true)}
                                        onBlur={() => setOtpFocused(false)}
                                        keyboardType="number-pad"
                                        maxLength={6}
                                        testID="email-otp-input"
                                    />
                                    {error ? (
                                        <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>
                                    ) : null}
                                    <TouchableOpacity
                                        style={[
                                            styles.button,
                                            {
                                                backgroundColor: otp.length === 6 ? colors.accent : colors.border,
                                            },
                                        ]}
                                        onPress={handleVerify}
                                        disabled={isLoading || otp.length !== 6}
                                        activeOpacity={0.85}
                                        testID="email-verify-button"
                                    >
                                        {isLoading ? (
                                            <ActivityIndicator color={colors.textInverse} size="small" />
                                        ) : (
                                            <Text style={[styles.buttonText, { color: colors.textInverse }]}>
                                                Verify
                                            </Text>
                                        )}
                                    </TouchableOpacity>

                                    <View style={styles.links}>
                                        <TouchableOpacity onPress={handleResend} disabled={cooldown > 0}>
                                            <Text
                                                style={[
                                                    styles.linkText,
                                                    { color: cooldown > 0 ? colors.textTertiary : colors.accent },
                                                ]}
                                            >
                                                {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                                            </Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity onPress={handleChangeEmail}>
                                            <Text style={[styles.linkText, { color: colors.accent }]}>
                                                Change email
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </>
                            )}
                        </Animated.View>

                        <View style={styles.iconBlock}>
                            <Ionicons
                                name={step === 'email' ? 'mail-outline' : 'mail-open-outline'}
                                size={80}
                                color={colors.accent + '22'}
                            />
                        </View>
                    </ScrollView>
                </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    flex: { flex: 1 },
    scrollContent: {
        paddingLeft: 24,
        paddingRight: 32,
        paddingTop: 24,
        paddingBottom: 32,
    },
    eyebrow: {
        fontFamily: Fonts.sansSemibold,
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 1.5,
        textTransform: 'uppercase',
        marginBottom: 20,
    },
    title: {
        fontFamily: Fonts.sansBold,
        fontSize: 32,
        fontWeight: '700',
        lineHeight: 38,
        letterSpacing: letterSpacing(-0.5),
        marginBottom: 10,
    },
    titleItalic: {
        fontFamily: Fonts.serifItalic,
        fontWeight: '500',
    },
    subtitle: {
        fontFamily: Fonts.sans,
        fontSize: 16,
        lineHeight: 24,
        maxWidth: 440,
        marginBottom: 36,
    },
    inputBlock: {},
    input: {
        fontFamily: Fonts.sans,
        borderWidth: 1.5,
        borderRadius: 14,
        paddingHorizontal: 18,
        paddingVertical: 16,
        fontSize: 17,
    },
    otpInput: {
        fontFamily: Fonts.sansBold,
        borderWidth: 1.5,
        borderRadius: 14,
        paddingHorizontal: 18,
        paddingVertical: 16,
        fontSize: 28,
        fontWeight: '700',
        letterSpacing: 8,
        textAlign: 'center',
    },
    error: {
        fontFamily: Fonts.sans,
        fontSize: 13,
        marginTop: 8,
        marginLeft: 4,
    },
    button: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 14,
        marginTop: 20,
    },
    buttonText: {
        fontFamily: Fonts.sansSemibold,
        fontSize: 17,
        fontWeight: '600',
    },
    links: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 20,
    },
    linkText: {
        fontFamily: Fonts.sansSemibold,
        fontSize: 14,
        fontWeight: '600',
    },
    // Decorative icon anchored bottom-left — aligned to title anchor
    iconBlock: {
        marginTop: 40,
        alignItems: 'flex-start',
        paddingLeft: 8,
    },
});
