import { letterSpacing } from '@/constants/platform';
import { Fonts } from '@/constants/type';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { captureError } from '@/lib/sentry';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * PDPA consent gate — shown to every new user before any other onboarding
 * step. Three required consents (T&C, Privacy, Operational Push) plus one
 * optional (Marketing). Marketing must be a separate decision per PDPA §36.
 *
 * Existing users were grandfathered for the three required consents in
 * migration 20260427140000_user_consent_columns.sql; their AuthGate skips
 * this screen because the columns are already populated.
 */
export default function ConsentScreen() {
    const { colors } = useTheme();
    const router = useRouter();
    const { user, refreshUser } = useAuth();

    const [tos, setTos] = useState(false);
    const [privacy, setPrivacy] = useState(false);
    const [operationalPush, setOperationalPush] = useState(true); // pre-checked — required for the app to function
    const [marketing, setMarketing] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const allRequiredAccepted = tos && privacy && operationalPush;

    const handleContinue = async () => {
        if (!user || submitting) return;
        if (!allRequiredAccepted) return;
        setSubmitting(true);
        setError(null);
        try {
            const now = new Date().toISOString();
            // Cast around the generated types until `gen:types` re-runs
            // post-migration. Columns are documented in
            // 20260427140000_user_consent_columns.sql.
            const { error: updateErr } = await supabase
                .from('users')
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .update({
                    consent_tos_at: now,
                    consent_privacy_at: now,
                    consent_operational_push_at: now,
                    consent_marketing_at: marketing ? now : null,
                } as any)
                .eq('id', user.id);
            if (updateErr) {
                setError('Could not save your consent. Please try again.');
                setSubmitting(false);
                return;
            }
            await refreshUser();
            // After consent, route to whichever onboarding step comes next.
            // For brand-new candidate flows this is EmailVerification; for
            // staff flows it's Welcome.
            if (user.role === 'candidate' && user.email_verified !== true) {
                router.replace('/onboarding/EmailVerification');
            } else {
                router.replace('/onboarding/Welcome');
            }
        } catch (e) {
            captureError(e, { fn: 'ConsentScreen.handleContinue' });
            setError('Could not save your consent. Please try again.');
            setSubmitting(false);
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <Animated.View entering={FadeInDown.springify().duration(500)}>
                    <Text style={[styles.eyebrow, { color: colors.textTertiary }]}>BEFORE WE BEGIN</Text>
                    <Text style={[styles.title, { color: colors.textPrimary }]}>
                        Let&apos;s set your{' '}
                        <Text style={[styles.titleItalic, { color: colors.accent }]}>preferences.</Text>
                    </Text>
                    <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                        Singapore&apos;s PDPA requires us to ask before we use your data. You can change any of these
                        later in Settings.
                    </Text>
                </Animated.View>

                <Animated.View
                    style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}
                    entering={FadeInDown.delay(120).springify().duration(600)}
                >
                    <ConsentRow
                        checked={tos}
                        onToggle={() => setTos((v) => !v)}
                        required
                        title="Terms of Service"
                        body="I have read and agree to the Lyfe Terms of Service."
                        linkLabel="Read terms"
                        linkRoute="/(tabs)/profile/terms"
                        colors={colors}
                    />
                    <Divider color={colors.cardBorder} />
                    <ConsentRow
                        checked={privacy}
                        onToggle={() => setPrivacy((v) => !v)}
                        required
                        title="Privacy Policy"
                        body="I have read and agree to the Lyfe Privacy Policy and consent to the processing of my personal data as described."
                        linkLabel="Read policy"
                        linkRoute="/(tabs)/profile/privacy"
                        colors={colors}
                    />
                    <Divider color={colors.cardBorder} />
                    <ConsentRow
                        checked={operationalPush}
                        onToggle={() => setOperationalPush((v) => !v)}
                        required
                        title="Operational notifications"
                        body="Send me alerts about new leads, event reminders, candidate updates, and other things I need to know to do my job."
                        colors={colors}
                    />
                    <Divider color={colors.cardBorder} />
                    <ConsentRow
                        checked={marketing}
                        onToggle={() => setMarketing((v) => !v)}
                        required={false}
                        title="Announcements & updates"
                        body="Send me agency-wide announcements, product updates, training opportunities, and occasional newsletters."
                        colors={colors}
                    />
                </Animated.View>

                {error ? (
                    <Text style={[styles.errorText, { color: colors.danger }]} accessibilityRole="alert">
                        {error}
                    </Text>
                ) : null}
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity
                    testID="consent-continue"
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !allRequiredAccepted || submitting }}
                    style={[
                        styles.button,
                        { backgroundColor: colors.accent },
                        (!allRequiredAccepted || submitting) && styles.buttonDisabled,
                    ]}
                    disabled={!allRequiredAccepted || submitting}
                    onPress={handleContinue}
                >
                    <Text style={[styles.buttonText, { color: colors.textInverse }]}>
                        {submitting ? 'Saving…' : 'Continue'}
                    </Text>
                </TouchableOpacity>
                <Text style={[styles.helper, { color: colors.textTertiary }]}>
                    Required: Terms, Privacy, and Operational notifications.
                </Text>
            </View>
        </SafeAreaView>
    );
}

interface RowProps {
    checked: boolean;
    onToggle: () => void;
    required: boolean;
    title: string;
    body: string;
    linkLabel?: string;
    linkRoute?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    colors: any;
}

function ConsentRow({ checked, onToggle, required, title, body, linkLabel, linkRoute, colors }: RowProps) {
    const router = useRouter();
    return (
        <View style={styles.row}>
            <TouchableOpacity
                testID={`consent-checkbox-${title.toLowerCase().replace(/\s+/g, '-')}`}
                accessibilityRole="checkbox"
                accessibilityState={{ checked }}
                onPress={onToggle}
                style={[
                    styles.checkbox,
                    {
                        borderColor: checked ? colors.accent : colors.cardBorder,
                        backgroundColor: checked ? colors.accent : 'transparent',
                    },
                ]}
            >
                {checked ? <Ionicons name="checkmark" size={18} color={colors.textInverse} /> : null}
            </TouchableOpacity>
            <View style={styles.rowText}>
                <View style={styles.rowTitleRow}>
                    <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>{title}</Text>
                    {required ? (
                        <Text style={[styles.requiredTag, { color: colors.danger }]}>Required</Text>
                    ) : (
                        <Text style={[styles.optionalTag, { color: colors.textTertiary }]}>Optional</Text>
                    )}
                </View>
                <Text style={[styles.rowBody, { color: colors.textSecondary }]}>{body}</Text>
                {linkLabel && linkRoute ? (
                    <TouchableOpacity
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        onPress={() => router.push(linkRoute as any)}
                        accessibilityRole="link"
                    >
                        <Text style={[styles.link, { color: colors.accent }]}>{linkLabel}</Text>
                    </TouchableOpacity>
                ) : null}
            </View>
        </View>
    );
}

function Divider({ color }: { color: string }) {
    return <View style={[styles.divider, { backgroundColor: color }]} />;
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24 },
    eyebrow: {
        fontFamily: Fonts.sans,
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: letterSpacing(1.4),
        marginBottom: 12,
    },
    title: {
        fontFamily: Fonts.sans,
        fontSize: 32,
        fontWeight: '700',
        lineHeight: 38,
        marginBottom: 12,
    },
    titleItalic: {
        fontFamily: Fonts.serifItalic,
        fontWeight: '400',
    },
    subtitle: {
        fontFamily: Fonts.sans,
        fontSize: 15,
        lineHeight: 22,
        marginBottom: 24,
        maxWidth: 320,
    },
    card: {
        borderRadius: 16,
        borderWidth: 1,
        padding: 16,
        marginTop: 8,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingVertical: 12,
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 6,
        borderWidth: 2,
        marginRight: 12,
        marginTop: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rowText: { flex: 1 },
    rowTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
    },
    rowTitle: {
        fontFamily: Fonts.sans,
        fontSize: 16,
        fontWeight: '600',
    },
    requiredTag: {
        fontFamily: Fonts.sans,
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: letterSpacing(0.6),
        textTransform: 'uppercase',
    },
    optionalTag: {
        fontFamily: Fonts.sans,
        fontSize: 11,
        fontWeight: '500',
        letterSpacing: letterSpacing(0.6),
        textTransform: 'uppercase',
    },
    rowBody: {
        fontFamily: Fonts.sans,
        fontSize: 14,
        lineHeight: 20,
    },
    link: {
        fontFamily: Fonts.sans,
        fontSize: 14,
        fontWeight: '500',
        marginTop: 6,
    },
    divider: { height: 1, marginVertical: 4 },
    footer: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 24 },
    button: {
        paddingVertical: 16,
        borderRadius: 14,
        alignItems: 'center',
        marginBottom: 12,
    },
    buttonDisabled: { opacity: 0.4 },
    buttonText: {
        fontFamily: Fonts.sans,
        fontSize: 16,
        fontWeight: '600',
    },
    helper: {
        fontFamily: Fonts.sans,
        fontSize: 12,
        textAlign: 'center',
    },
    errorText: {
        fontFamily: Fonts.sans,
        fontSize: 13,
        marginTop: 12,
        textAlign: 'center',
    },
});
