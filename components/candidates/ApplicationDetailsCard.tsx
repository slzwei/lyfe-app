import type { CandidateProfileDetails } from '@/types/recruitment';
import type { ThemeColors } from '@/types/theme';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Props {
    profile: CandidateProfileDetails;
    colors: ThemeColors;
}

function DetailRow({ label, value, colors }: { label: string; value: string | null | undefined; colors: ThemeColors }) {
    if (!value) return null;
    return (
        <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>{label}</Text>
            <Text style={[styles.detailValue, { color: colors.textPrimary }]}>{value}</Text>
        </View>
    );
}

function Section({
    title,
    icon,
    colors,
    children,
}: {
    title: string;
    icon: string;
    colors: ThemeColors;
    children: React.ReactNode;
}) {
    if (!React.Children.toArray(children).some(Boolean)) return null;
    return (
        <View style={[styles.section, { borderTopColor: colors.borderLight || colors.border }]}>
            <View style={styles.sectionHeader}>
                <Ionicons name={icon as any} size={15} color={colors.textTertiary} />
                <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>{title}</Text>
            </View>
            {children}
        </View>
    );
}

function ApplicationDetailsCard({ profile, colors }: Props) {
    const [expanded, setExpanded] = useState(false);

    const address = [profile.address_block, profile.address_street, profile.address_unit, profile.address_postal]
        .filter(Boolean)
        .join(', ');

    const completionLabel = profile.completed ? 'Completed' : `Step ${profile.onboarding_step} of 5`;
    const completionColor = profile.completed ? colors.success : colors.warning;

    return (
        <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
            <TouchableOpacity style={styles.headerRow} onPress={() => setExpanded(!expanded)} activeOpacity={0.7}>
                <View style={styles.headerLeft}>
                    <Ionicons name="document-text-outline" size={18} color={colors.textTertiary} />
                    <Text style={[styles.title, { color: colors.textPrimary }]}>Application Details</Text>
                </View>
                <View style={styles.headerRight}>
                    <View style={[styles.statusBadge, { backgroundColor: completionColor + '14' }]}>
                        <Text style={[styles.statusText, { color: completionColor }]}>{completionLabel}</Text>
                    </View>
                    <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textTertiary} />
                </View>
            </TouchableOpacity>

            {expanded && (
                <View style={styles.content}>
                    <Section title="Personal" icon="person-outline" colors={colors}>
                        <DetailRow label="Full Name" value={profile.full_name} colors={colors} />
                        <DetailRow label="Chinese Name" value={profile.chinese_name} colors={colors} />
                        <DetailRow label="Alias" value={profile.alias} colors={colors} />
                        <DetailRow label="Date of Birth" value={profile.date_of_birth} colors={colors} />
                        <DetailRow label="Nationality" value={profile.nationality} colors={colors} />
                        <DetailRow label="Race" value={profile.race} colors={colors} />
                        <DetailRow label="Gender" value={profile.gender} colors={colors} />
                        <DetailRow label="Marital Status" value={profile.marital_status} colors={colors} />
                    </Section>

                    <Section title="Address" icon="location-outline" colors={colors}>
                        <DetailRow label="Address" value={address || null} colors={colors} />
                    </Section>

                    <Section title="Position" icon="briefcase-outline" colors={colors}>
                        <DetailRow label="Applied For" value={profile.position_applied} colors={colors} />
                        <DetailRow
                            label="Expected Salary"
                            value={
                                profile.expected_salary
                                    ? `$${profile.expected_salary}${profile.salary_period ? ` / ${profile.salary_period}` : ''}`
                                    : null
                            }
                            colors={colors}
                        />
                        <DetailRow label="Available From" value={profile.date_available} colors={colors} />
                    </Section>

                    <Section title="Emergency Contact" icon="alert-circle-outline" colors={colors}>
                        <DetailRow label="Name" value={profile.emergency_name} colors={colors} />
                        <DetailRow label="Relationship" value={profile.emergency_relationship} colors={colors} />
                        <DetailRow label="Contact" value={profile.emergency_contact} colors={colors} />
                    </Section>

                    {profile.education.length > 0 && (
                        <Section title="Education" icon="school-outline" colors={colors}>
                            {profile.education.map((edu, i) => (
                                <View key={i} style={styles.listItem}>
                                    <Text style={[styles.listPrimary, { color: colors.textPrimary }]}>
                                        {edu.institution}
                                    </Text>
                                    <Text style={[styles.listSecondary, { color: colors.textSecondary }]}>
                                        {[edu.qualification, edu.year].filter(Boolean).join(' · ')}
                                    </Text>
                                </View>
                            ))}
                        </Section>
                    )}

                    {profile.employment_history.length > 0 && (
                        <Section title="Employment History" icon="business-outline" colors={colors}>
                            {profile.employment_history.map((job, i) => (
                                <View key={i} style={styles.listItem}>
                                    <Text style={[styles.listPrimary, { color: colors.textPrimary }]}>
                                        {job.position} at {job.company}
                                    </Text>
                                    <Text style={[styles.listSecondary, { color: colors.textSecondary }]}>
                                        {[job.period, job.reason_for_leaving ? `Left: ${job.reason_for_leaving}` : null]
                                            .filter(Boolean)
                                            .join(' · ')}
                                    </Text>
                                </View>
                            ))}
                        </Section>
                    )}

                    {profile.languages.length > 0 && (
                        <Section title="Languages" icon="language-outline" colors={colors}>
                            {profile.languages.map((lang, i) => (
                                <View key={i} style={styles.listItem}>
                                    <Text style={[styles.listPrimary, { color: colors.textPrimary }]}>
                                        {lang.language}
                                    </Text>
                                    <Text style={[styles.listSecondary, { color: colors.textSecondary }]}>
                                        Spoken: {lang.spoken || '–'} · Written: {lang.written || '–'}
                                    </Text>
                                </View>
                            ))}
                        </Section>
                    )}

                    <Section title="Skills" icon="construct-outline" colors={colors}>
                        <DetailRow label="Software" value={profile.software_competencies} colors={colors} />
                        <DetailRow
                            label="Typing"
                            value={profile.typing_wpm ? `${profile.typing_wpm} WPM` : null}
                            colors={colors}
                        />
                        <DetailRow
                            label="Shorthand"
                            value={profile.shorthand_wpm ? `${profile.shorthand_wpm} WPM` : null}
                            colors={colors}
                        />
                    </Section>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        borderRadius: 14,
        borderWidth: 0.5,
        padding: 16,
        marginBottom: 12,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    title: { fontSize: 15, fontWeight: '700' },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
    },
    statusText: { fontSize: 11, fontWeight: '600' },
    content: { marginTop: 12 },
    section: {
        borderTopWidth: 0.5,
        paddingTop: 12,
        marginTop: 12,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 8,
    },
    sectionLabel: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase' },
    detailRow: {
        flexDirection: 'row',
        paddingVertical: 4,
    },
    detailLabel: { width: 110, fontSize: 13 },
    detailValue: { flex: 1, fontSize: 13, fontWeight: '500' },
    listItem: {
        paddingVertical: 4,
    },
    listPrimary: { fontSize: 13, fontWeight: '500' },
    listSecondary: { fontSize: 12, marginTop: 2 },
});

export default React.memo(ApplicationDetailsCard);
