import ScreenHeader from '@/components/ScreenHeader';
import { useTheme } from '@/contexts/ThemeContext';
import { Fonts } from '@/constants/type';
import { letterSpacing } from '@/constants/platform';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const PRIVACY_SECTIONS = [
    {
        icon: 'shield-checkmark' as const,
        title: 'Data We Collect',
        body: 'Lyfe collects your name, phone number, email, and activity data (leads, candidates, events) to provide the service. Biometric data never leaves your device.',
    },
    {
        icon: 'lock-closed' as const,
        title: 'How We Use It',
        body: 'Your data is used solely to operate the Lyfe platform. We do not sell or share your personal data with third parties.',
    },
    {
        icon: 'server' as const,
        title: 'Data Storage',
        body: "All data is stored securely on Supabase (AWS Singapore region). Session tokens are stored in your device's secure enclave and never transmitted.",
    },
    {
        icon: 'trash' as const,
        title: 'Data Deletion',
        body: 'You can request full account deletion at any time by contacting support. All your data will be permanently deleted within 30 days.',
    },
    {
        icon: 'eye-off' as const,
        title: 'Analytics',
        body: 'Lyfe does not use third-party analytics or advertising SDKs. Only anonymous crash reports may be collected to improve app stability.',
    },
];

export default function PrivacyScreen() {
    const { colors } = useTheme();

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            <ScreenHeader title="Privacy" showBack backLabel="Profile" />
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <Text style={[styles.intro, { color: colors.textSecondary }]}>Last updated: March 2026</Text>

                {PRIVACY_SECTIONS.map((section, index) => (
                    <View key={section.title} style={[styles.card, { backgroundColor: colors.cardBackground }]}>
                        <View style={styles.cardHeader}>
                            <View style={[styles.iconCircle, { backgroundColor: colors.accentLight }]}>
                                <Ionicons name={section.icon} size={18} color={colors.accent} />
                            </View>
                            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>{section.title}</Text>
                        </View>
                        <Text style={[styles.cardBody, { color: colors.textSecondary }]}>{section.body}</Text>
                    </View>
                ))}

                <TouchableOpacity
                    style={[styles.contactBtn, { borderColor: colors.border }]}
                    onPress={() => Linking.openURL('mailto:admin@mktr.sg')}
                    activeOpacity={0.7}
                >
                    <Ionicons name="mail-outline" size={16} color={colors.accent} />
                    <Text style={[styles.contactBtnText, { color: colors.accent }]}>Contact Privacy Team</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    // Long-form reading: cap at 640 for tablet readability (line-length < 75ch)
    scrollContent: {
        padding: 20,
        paddingBottom: 48,
        maxWidth: 640,
        width: '100%',
        alignSelf: 'center',
    },
    intro: {
        fontFamily: Fonts.sans,
        fontSize: 13,
        lineHeight: 18,
        marginBottom: 20,
        paddingHorizontal: 4,
    },

    card: {
        borderRadius: 16,
        padding: 20,
        marginBottom: 14,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 12,
    },
    iconCircle: {
        width: 34,
        height: 34,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    // Section title: stronger hierarchy — 16pt bold + negative tracking
    cardTitle: {
        fontFamily: Fonts.sansBold,
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: letterSpacing(-0.2),
    },
    // Body: 15pt minimum + 1.53 line-height ratio for comfortable reading
    cardBody: {
        fontFamily: Fonts.sans,
        fontSize: 15,
        fontWeight: '400',
        lineHeight: 23,
    },

    contactBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: 16,
        paddingVertical: 14,
        borderRadius: 14,
        borderWidth: 1.5,
    },
    contactBtnText: {
        fontFamily: Fonts.sansSemibold,
        fontSize: 15,
        fontWeight: '600',
    },
});
