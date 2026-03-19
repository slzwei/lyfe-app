import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface InfoRowProps {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    value: string;
    colors: ReturnType<typeof useTheme>['colors'];
}

function InfoRow({ icon, label, value, colors }: InfoRowProps) {
    return (
        <View style={[styles.infoRow, { backgroundColor: colors.surfacePrimary }]}>
            <View style={[styles.iconContainer, { backgroundColor: colors.accentLight }]}>
                <Ionicons name={icon} size={22} color={colors.accent} />
            </View>
            <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: colors.textPrimary }]}>{label}</Text>
                <Text style={[styles.infoValue, { color: colors.textSecondary }]}>{value}</Text>
            </View>
        </View>
    );
}

export default function AgencyInfoScreen() {
    const { colors } = useTheme();
    const router = useRouter();

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <ScrollView style={styles.flex} contentContainerStyle={styles.scrollContent}>
                <Text style={[styles.title, { color: colors.textPrimary }]}>What's Inside</Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                    Everything you need to grow your insurance career
                </Text>

                <View style={styles.infoList}>
                    <InfoRow
                        icon="school-outline"
                        label="Training Roadmap"
                        value="Structured learning paths to build your skills"
                        colors={colors}
                    />
                    <InfoRow
                        icon="calendar-outline"
                        label="Events"
                        value="Browse workshops, roadshows, and networking events"
                        colors={colors}
                    />
                    <InfoRow
                        icon="trophy-outline"
                        label="Exam Preparation"
                        value="Track your exam progress and certifications"
                        colors={colors}
                    />
                    <InfoRow
                        icon="people-outline"
                        label="Team"
                        value="Connect with managers and fellow professionals"
                        colors={colors}
                    />
                </View>
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity
                    style={[styles.button, { backgroundColor: colors.accent }]}
                    onPress={() => router.push('/onboarding/OnboardingComplete')}
                    testID="continue-button"
                >
                    <Text style={[styles.buttonText, { color: colors.textInverse }]}>Continue</Text>
                </TouchableOpacity>
            </View>
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
    scrollContent: {
        paddingHorizontal: 24,
        paddingTop: 48,
        paddingBottom: 24,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        marginBottom: 32,
    },
    infoList: {
        gap: 12,
        marginBottom: 24,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        gap: 14,
    },
    iconContainer: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    infoContent: {
        flex: 1,
    },
    infoLabel: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 2,
    },
    infoValue: {
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
        borderRadius: 12,
    },
    buttonText: {
        fontSize: 18,
        fontWeight: '600',
    },
});
