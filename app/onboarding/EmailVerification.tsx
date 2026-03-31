import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { sendEmailOtp, verifyEmailOtp } from '@/lib/email-verification';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Step = 'email' | 'otp';

export default function EmailVerificationScreen() {
    const { colors } = useTheme();
    const { refreshUser } = useAuth();

    const [step, setStep] = useState<Step>('email');
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [cooldown, setCooldown] = useState(0);
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

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <View style={styles.content}>
                        <View style={[styles.iconCircle, { backgroundColor: colors.accentLight }]}>
                            <Ionicons name="mail-outline" size={48} color={colors.accent} />
                        </View>

                        {step === 'email' ? (
                            <>
                                <Text style={[styles.title, { color: colors.textPrimary }]}>Verify your email</Text>
                                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                                    We need your email for important updates about your training and appointments.
                                </Text>

                                <TextInput
                                    style={[
                                        styles.input,
                                        {
                                            color: colors.textPrimary,
                                            backgroundColor: colors.surfacePrimary,
                                            borderColor: error ? colors.danger : colors.border,
                                        },
                                    ]}
                                    placeholder="Enter your email"
                                    placeholderTextColor={colors.textTertiary}
                                    value={email}
                                    onChangeText={(t) => {
                                        setEmail(t);
                                        setError(null);
                                    }}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    autoComplete="email"
                                    autoFocus
                                    testID="email-verification-input"
                                />

                                {error && <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>}

                                <TouchableOpacity
                                    style={[
                                        styles.button,
                                        {
                                            backgroundColor: isValidEmail(email) ? colors.accent : colors.border,
                                        },
                                    ]}
                                    onPress={handleSendCode}
                                    disabled={isLoading || !isValidEmail(email)}
                                    testID="email-send-code-button"
                                >
                                    {isLoading ? (
                                        <ActivityIndicator color="#fff" size="small" />
                                    ) : (
                                        <Text style={styles.buttonText}>Send Verification Code</Text>
                                    )}
                                </TouchableOpacity>
                            </>
                        ) : (
                            <>
                                <Text style={[styles.title, { color: colors.textPrimary }]}>Check your inbox</Text>
                                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                                    Enter the 6-digit code sent to{' '}
                                    <Text style={{ fontWeight: '600', color: colors.textPrimary }}>{email}</Text>
                                </Text>

                                <TextInput
                                    ref={otpInputRef}
                                    style={[
                                        styles.otpInput,
                                        {
                                            color: colors.textPrimary,
                                            backgroundColor: colors.surfacePrimary,
                                            borderColor: error ? colors.danger : colors.border,
                                        },
                                    ]}
                                    placeholder="000000"
                                    placeholderTextColor={colors.textTertiary}
                                    value={otp}
                                    onChangeText={(t) => {
                                        setOtp(t.replace(/\D/g, '').slice(0, 6));
                                        setError(null);
                                    }}
                                    keyboardType="number-pad"
                                    maxLength={6}
                                    testID="email-otp-input"
                                />

                                {error && <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>}

                                <TouchableOpacity
                                    style={[
                                        styles.button,
                                        {
                                            backgroundColor: otp.length === 6 ? colors.accent : colors.border,
                                        },
                                    ]}
                                    onPress={handleVerify}
                                    disabled={isLoading || otp.length !== 6}
                                    testID="email-verify-button"
                                >
                                    {isLoading ? (
                                        <ActivityIndicator color="#fff" size="small" />
                                    ) : (
                                        <Text style={styles.buttonText}>Verify</Text>
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
                                        <Text style={[styles.linkText, { color: colors.accent }]}>Change email</Text>
                                    </TouchableOpacity>
                                </View>
                            </>
                        )}
                    </View>
                </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    flex: {
        flex: 1,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
    },
    iconCircle: {
        width: 96,
        height: 96,
        borderRadius: 48,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        marginBottom: 8,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 15,
        lineHeight: 22,
        textAlign: 'center',
        marginBottom: 32,
    },
    input: {
        width: '100%',
        height: 52,
        borderRadius: 12,
        borderWidth: 1,
        paddingHorizontal: 16,
        fontSize: 16,
        marginBottom: 12,
    },
    otpInput: {
        width: '100%',
        height: 56,
        borderRadius: 12,
        borderWidth: 1,
        paddingHorizontal: 16,
        fontSize: 28,
        fontWeight: '600',
        letterSpacing: 12,
        textAlign: 'center',
        marginBottom: 12,
    },
    error: {
        fontSize: 13,
        marginBottom: 12,
        textAlign: 'center',
    },
    button: {
        width: '100%',
        height: 50,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 4,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    links: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        marginTop: 20,
    },
    linkText: {
        fontSize: 14,
        fontWeight: '500',
    },
});
