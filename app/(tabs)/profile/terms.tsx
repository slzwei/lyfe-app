import ScreenHeader from '@/components/ScreenHeader';
import { useTheme } from '@/contexts/ThemeContext';
import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

const SECTIONS = [
    {
        title: '1. Acceptance of Terms',
        body: 'By using Lyfe, you agree to these Terms of Service. If you do not agree, do not use the application. Lyfe is provided exclusively to authorised agency personnel.',
    },
    {
        title: '2. Authorised Use',
        body: 'Lyfe is an internal agency management platform. Access is granted only to licensed agents, managers, directors, personal assistants, and approved candidates of the agency. Sharing your credentials with any third party is strictly prohibited.',
    },
    {
        title: '3. Data Responsibility',
        body: 'You are responsible for the accuracy of lead, candidate, and client information you enter. Do not input data belonging to individuals without their consent. All client data must be handled in compliance with Singapore\'s Personal Data Protection Act (PDPA).',
    },
    {
        title: '4. Confidentiality',
        body: 'All data within Lyfe — including lead pipelines, candidate details, agency performance, and internal communications — is strictly confidential. You must not share, export, or reproduce this information outside of authorised agency workflows.',
    },
    {
        title: '5. Account Security',
        body: 'You are responsible for maintaining the security of your account. Report any suspected unauthorised access to your agency administrator immediately. Lyfe uses SMS OTP and optional biometric authentication to protect your account.',
    },
    {
        title: '6. Acceptable Use',
        body: 'You agree not to misuse Lyfe by attempting to access data of other users outside your hierarchy, reverse-engineer the application, or use it for any unlawful purpose.',
    },
    {
        title: '7. Service Availability',
        body: 'Lyfe is provided on an "as is" basis. We do not guarantee uninterrupted access. Scheduled maintenance may result in temporary downtime, and we will provide advance notice where possible.',
    },
    {
        title: '8. Changes to Terms',
        body: 'These terms may be updated from time to time. Continued use of Lyfe after changes constitutes your acceptance of the new terms. You will be notified of material changes through the application.',
    },
    {
        title: '9. Governing Law',
        body: 'These terms are governed by the laws of Singapore. Any disputes arising from use of Lyfe shall be subject to the exclusive jurisdiction of the courts of Singapore.',
    },
];

export default function TermsScreen() {
    const { colors } = useTheme();

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <ScreenHeader title="Terms of Service" showBack backLabel="Profile" />
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                <Text style={[styles.effective, { color: colors.textTertiary }]}>
                    Effective date: 1 January 2026
                </Text>

                {SECTIONS.map((section) => (
                    <View key={section.title} style={styles.section}>
                        <Text style={[styles.heading, { color: colors.textPrimary }]}>{section.title}</Text>
                        <Text style={[styles.body, { color: colors.textSecondary }]}>{section.body}</Text>
                    </View>
                ))}

                <View style={[styles.footer, { borderTopColor: colors.border }]}>
                    <Text style={[styles.footerText, { color: colors.textTertiary }]}>
                        For questions about these terms, contact your agency administrator or email legal@lyfe.sg
                    </Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: { padding: 20, paddingBottom: 48 },
    effective: { fontSize: 13, marginBottom: 20 },

    section: { marginBottom: 20 },
    heading: { fontSize: 15, fontWeight: '700', marginBottom: 6 },
    body: { fontSize: 14, lineHeight: 22 },

    footer: {
        borderTopWidth: StyleSheet.hairlineWidth,
        paddingTop: 16,
        marginTop: 8,
    },
    footerText: { fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
