import { letterSpacing } from '@/constants/platform';
import { Fonts } from '@/constants/type';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

interface InfoRowProps {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    value: string;
    colors: ReturnType<typeof useTheme>['colors'];
    index: number;
}

function InfoRow({ icon, label, value, colors, index }: InfoRowProps) {
    return (
        <Animated.View
            style={[styles.infoRow, { backgroundColor: colors.surfacePrimary, borderColor: colors.border }]}
            entering={FadeInDown.delay(200 + index * 80)
                .springify()
                .duration(500)}
        >
            <View style={[styles.iconContainer, { backgroundColor: colors.accentLight }]}>
                <Ionicons name={icon} size={20} color={colors.accent} />
            </View>
            <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: colors.textPrimary }]}>{label}</Text>
                <Text style={[styles.infoValue, { color: colors.textSecondary }]}>{value}</Text>
            </View>
        </Animated.View>
    );
}

/** Onboarding step 4/5. Preview what's inside the app. */
export default function AgencyInfoScreen() {
    const { colors } = useTheme();
    const router = useRouter();

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            <ScrollView style={styles.flex} contentContainerStyle={styles.scrollContent}>
                <Animated.View entering={FadeInDown.springify().duration(500)}>
                    <Text style={[styles.eyebrow, { color: colors.textTertiary }]}>STEP 4 OF 5</Text>
                    <Text style={[styles.title, { color: colors.textPrimary }]}>
                        What's <Text style={[styles.titleItalic, { color: colors.accent }]}>inside.</Text>
                    </Text>
                    <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                        Everything you need to grow your insurance career.
                    </Text>
                </Animated.View>

                <View style={styles.infoList}>
                    <InfoRow
                        icon="school-outline"
                        label="Training roadmap"
                        value="Structured learning paths to build your skills"
                        colors={colors}
                        index={0}
                    />
                    <InfoRow
                        icon="calendar-outline"
                        label="Events"
                        value="Browse workshops, roadshows, and networking events"
                        colors={colors}
                        index={1}
                    />
                    <InfoRow
                        icon="trophy-outline"
                        label="Exam preparation"
                        value="Track your exam progress and certifications"
                        colors={colors}
                        index={2}
                    />
                    <InfoRow
                        icon="people-outline"
                        label="Team"
                        value="Connect with managers and fellow professionals"
                        colors={colors}
                        index={3}
                    />
                </View>
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity
                    style={[styles.button, { backgroundColor: colors.accent }]}
                    onPress={() => router.push('/onboarding/OnboardingComplete')}
                    activeOpacity={0.85}
                    testID="continue-button"
                >
                    <Text style={[styles.buttonText, { color: colors.textInverse }]}>Continue</Text>
                </TouchableOpacity>
            </View>
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
        paddingBottom: 24,
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
        marginBottom: 32,
    },
    infoList: {
        gap: 16, // bumped from 12 for more breathing room
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 18,
        borderRadius: 14,
        borderWidth: 1, // added: info cards were flat, now have subtle hairline
        gap: 14,
    },
    iconContainer: {
        width: 44,
        height: 44,
        borderRadius: 12, // softer rectangle, not a circle — differentiates from avatars
        alignItems: 'center',
        justifyContent: 'center',
    },
    infoContent: { flex: 1 },
    infoLabel: {
        fontFamily: Fonts.sansSemibold,
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 3,
        letterSpacing: letterSpacing(-0.1),
    },
    infoValue: {
        fontFamily: Fonts.sans,
        fontSize: 14,
        lineHeight: 20,
    },
    footer: {
        paddingHorizontal: 24,
        paddingBottom: 32,
        paddingTop: 12,
    },
    button: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 14,
    },
    buttonText: {
        fontFamily: Fonts.sansSemibold,
        fontSize: 17,
        fontWeight: '600',
    },
});
