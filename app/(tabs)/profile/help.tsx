import ScreenHeader from '@/components/ScreenHeader';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Linking, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const FAQS = [
    {
        q: 'How do I add a new lead?',
        a: 'Go to Leads → tap the "Add" button in the top right. Fill in the client\'s name, phone, and source, then tap Save.',
    },
    {
        q: 'How do I schedule a candidate interview?',
        a: 'Open a candidate\'s profile from the Candidates tab, then tap "Schedule" in the Actions section to set the date, time, and interview type.',
    },
    {
        q: 'How do I switch between Agent and Manager view?',
        a: 'Go to Profile → View Mode, then select "Manager View". This shows team leads and candidate pipelines instead of your personal leads.',
    },
    {
        q: 'What are roadshow events?',
        a: 'Roadshow events are field marketing days at external venues. Agents check in, log prospect interactions, and track pledges in real time. Managers see live booth totals.',
    },
    {
        q: 'How do I enable Face ID / Touch ID?',
        a: 'After logging in with OTP once, you\'ll be prompted to enable biometric sign-in. You can also toggle it anytime in Profile → Security.',
    },
    {
        q: 'My OTP isn\'t arriving — what do I do?',
        a: 'Check that your phone number is correct and has SMS reception. OTPs expire after 5 minutes. If the issue persists, contact your agency administrator.',
    },
];

export default function HelpScreen() {
    const { colors } = useTheme();
    const [openIndex, setOpenIndex] = useState<number | null>(null);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <ScreenHeader title="Help & Support" showBack backLabel="Profile" />
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                {/* Contact card */}
                <View style={[styles.contactCard, { backgroundColor: colors.accent }]}>
                    <Ionicons name="headset" size={28} color="rgba(255,255,255,0.9)" />
                    <View style={styles.contactInfo}>
                        <Text style={styles.contactTitle}>Need help?</Text>
                        <Text style={styles.contactSub}>Reach out to your agency admin or email us directly.</Text>
                    </View>
                </View>

                <View style={styles.contactRow}>
                    <TouchableOpacity
                        style={[styles.contactBtn, { backgroundColor: colors.cardBackground }]}
                        onPress={() => Linking.openURL('mailto:support@lyfe.sg')}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="mail-outline" size={18} color={colors.accent} />
                        <Text style={[styles.contactBtnText, { color: colors.textPrimary }]}>Email Support</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.contactBtn, { backgroundColor: colors.cardBackground }]}
                        onPress={() => Linking.openURL('https://wa.me/6512345678')}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="logo-whatsapp" size={18} color={colors.success} />
                        <Text style={[styles.contactBtnText, { color: colors.textPrimary }]}>WhatsApp</Text>
                    </TouchableOpacity>
                </View>

                {/* FAQs */}
                <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>FREQUENTLY ASKED QUESTIONS</Text>
                {FAQS.map((faq, index) => {
                    const isOpen = openIndex === index;
                    return (
                        <TouchableOpacity
                            key={faq.q}
                            style={[styles.faqCard, { backgroundColor: colors.cardBackground }]}
                            onPress={() => setOpenIndex(isOpen ? null : index)}
                            activeOpacity={0.7}
                        >
                            <View style={styles.faqHeader}>
                                <Text style={[styles.faqQ, { color: colors.textPrimary, flex: 1 }]}>{faq.q}</Text>
                                <Ionicons
                                    name={isOpen ? 'chevron-up' : 'chevron-down'}
                                    size={16}
                                    color={colors.textTertiary}
                                />
                            </View>
                            {isOpen && (
                                <Text style={[styles.faqA, { color: colors.textSecondary }]}>{faq.a}</Text>
                            )}
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: { padding: 16, paddingBottom: 40 },

    contactCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        borderRadius: 16,
        padding: 18,
        marginBottom: 12,
    },
    contactInfo: { flex: 1 },
    contactTitle: { fontSize: 16, fontWeight: '700', color: '#FFF', marginBottom: 2 },
    contactSub: { fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 18 },

    contactRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 24,
    },
    contactBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 13,
        borderRadius: 14,
    },
    contactBtnText: { fontSize: 14, fontWeight: '600' },

    sectionLabel: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.8,
        marginBottom: 8,
        paddingHorizontal: 4,
    },

    faqCard: {
        borderRadius: 14,
        padding: 16,
        marginBottom: 8,
    },
    faqHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    faqQ: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
    faqA: { fontSize: 14, lineHeight: 21, marginTop: 10 },
});
