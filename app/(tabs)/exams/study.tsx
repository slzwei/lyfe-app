import ScreenHeader from '@/components/ScreenHeader';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

// ── Study Resources Data ──

interface StudyTopic {
    id: string;
    paperCode: string;
    title: string;
    description: string;
    chapters: number;
    estimatedMinutes: number;
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
}

const STUDY_TOPICS: StudyTopic[] = [
    {
        id: 's1', paperCode: 'M5',
        title: 'Rules & Regulations of Life Insurance',
        description: 'MAS guidelines, policy types, compliance requirements, and regulatory frameworks.',
        chapters: 12, estimatedMinutes: 180, icon: 'shield-checkmark', color: '#007AFF',
    },
    {
        id: 's2', paperCode: 'M9',
        title: 'Investment-Linked Policies',
        description: 'ILP fund structures, risk assessment, suitability analysis, and unit pricing.',
        chapters: 10, estimatedMinutes: 150, icon: 'trending-up', color: '#AF52DE',
    },
    {
        id: 's3', paperCode: 'M9A',
        title: 'ILP Supplementary Module',
        description: 'Additional ILP regulations, switching rules, and advanced product features.',
        chapters: 6, estimatedMinutes: 90, icon: 'documents', color: '#FF9500',
    },
    {
        id: 's4', paperCode: 'HI',
        title: 'Health Insurance Fundamentals',
        description: 'MediShield Life, Integrated Shield Plans, riders, and claims processes.',
        chapters: 8, estimatedMinutes: 120, icon: 'heart', color: '#FF3B30',
    },
];

const STUDY_TIPS = [
    { id: 't1', text: 'Focus on M5 first — it covers foundational regulations', icon: 'bulb' as const },
    { id: 't2', text: 'Review key terms and definitions before attempting practice exams', icon: 'bookmark' as const },
    { id: 't3', text: 'Aim for at least 2 study sessions per week', icon: 'calendar' as const },
];

export default function StudyScreen() {
    const { colors } = useTheme();
    const router = useRouter();

    const totalChapters = STUDY_TOPICS.reduce((n, t) => n + t.chapters, 0);
    const totalMinutes = STUDY_TOPICS.reduce((n, t) => n + t.estimatedMinutes, 0);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <ScreenHeader
                    showBack
                    backLabel="Home"
                    title="Study Materials"
                    subtitle={`${totalChapters} chapters · ~${Math.round(totalMinutes / 60)}h total`}
                />

                {/* Overview Card */}
                <View style={[styles.overviewCard, { backgroundColor: colors.accent }]}>
                    <Ionicons name="book" size={60} color="rgba(255,255,255,0.15)" style={styles.overviewIcon} />
                    <Text style={styles.overviewTitle}>Your Study Plan</Text>
                    <Text style={styles.overviewSub}>
                        Complete all 4 modules to prepare for your licensing exams
                    </Text>
                    <View style={styles.overviewStats}>
                        <View style={styles.overviewStat}>
                            <Text style={styles.overviewStatValue}>4</Text>
                            <Text style={styles.overviewStatLabel}>Modules</Text>
                        </View>
                        <View style={[styles.overviewDivider]} />
                        <View style={styles.overviewStat}>
                            <Text style={styles.overviewStatValue}>{totalChapters}</Text>
                            <Text style={styles.overviewStatLabel}>Chapters</Text>
                        </View>
                        <View style={[styles.overviewDivider]} />
                        <View style={styles.overviewStat}>
                            <Text style={styles.overviewStatValue}>~{Math.round(totalMinutes / 60)}h</Text>
                            <Text style={styles.overviewStatLabel}>Est. Time</Text>
                        </View>
                    </View>
                </View>

                {/* Study Tips */}
                <View style={[styles.tipsCard, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
                    <View style={styles.tipsHeader}>
                        <Ionicons name="bulb" size={18} color="#FF9500" />
                        <Text style={[styles.tipsTitle, { color: colors.textPrimary }]}>Study Tips</Text>
                    </View>
                    {STUDY_TIPS.map((tip) => (
                        <View key={tip.id} style={styles.tipRow}>
                            <Ionicons name={tip.icon} size={14} color={colors.textTertiary} />
                            <Text style={[styles.tipText, { color: colors.textSecondary }]}>{tip.text}</Text>
                        </View>
                    ))}
                </View>

                {/* Topics */}
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Modules</Text>
                {STUDY_TOPICS.map((topic) => (
                    <TouchableOpacity
                        key={topic.id}
                        style={[styles.topicCard, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}
                        activeOpacity={0.7}
                        onPress={() => {
                            // Future: navigate to topic detail
                        }}
                    >
                        <View style={styles.topicRow}>
                            <View style={[styles.topicIconWrap, { backgroundColor: topic.color + '14' }]}>
                                <Ionicons name={topic.icon} size={22} color={topic.color} />
                            </View>
                            <View style={styles.topicInfo}>
                                <View style={styles.topicHeaderRow}>
                                    <View style={[styles.paperBadge, { backgroundColor: topic.color + '18' }]}>
                                        <Text style={[styles.paperBadgeText, { color: topic.color }]}>{topic.paperCode}</Text>
                                    </View>
                                </View>
                                <Text style={[styles.topicTitle, { color: colors.textPrimary }]} numberOfLines={2}>
                                    {topic.title}
                                </Text>
                                <Text style={[styles.topicDesc, { color: colors.textTertiary }]} numberOfLines={2}>
                                    {topic.description}
                                </Text>
                                <View style={styles.topicMeta}>
                                    <View style={styles.topicMetaItem}>
                                        <Ionicons name="document-text-outline" size={12} color={colors.textTertiary} />
                                        <Text style={[styles.topicMetaText, { color: colors.textTertiary }]}>
                                            {topic.chapters} chapters
                                        </Text>
                                    </View>
                                    <View style={styles.topicMetaItem}>
                                        <Ionicons name="time-outline" size={12} color={colors.textTertiary} />
                                        <Text style={[styles.topicMetaText, { color: colors.textTertiary }]}>
                                            ~{topic.estimatedMinutes} min
                                        </Text>
                                    </View>
                                </View>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                        </View>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: { paddingHorizontal: 16, paddingBottom: 40 },
    overviewCard: {
        borderRadius: 20,
        padding: 24,
        marginBottom: 16,
        position: 'relative',
        overflow: 'hidden',
    },
    overviewIcon: {
        position: 'absolute',
        top: -5,
        right: -5,
        transform: [{ rotate: '15deg' }],
    },
    overviewTitle: { color: '#FFF', fontSize: 20, fontWeight: '800', marginBottom: 4 },
    overviewSub: { color: 'rgba(255,255,255,0.85)', fontSize: 14, lineHeight: 20, marginBottom: 20 },
    overviewStats: { flexDirection: 'row', alignItems: 'center' },
    overviewStat: { flex: 1, alignItems: 'center' },
    overviewStatValue: { color: '#FFF', fontSize: 22, fontWeight: '800' },
    overviewStatLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 },
    overviewDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.2)' },
    tipsCard: {
        borderRadius: 14,
        borderWidth: 0.5,
        padding: 16,
        marginBottom: 20,
    },
    tipsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 12,
    },
    tipsTitle: { fontSize: 14, fontWeight: '700' },
    tipRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        marginBottom: 8,
    },
    tipText: { flex: 1, fontSize: 13, lineHeight: 18 },
    sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
    topicCard: {
        borderRadius: 14,
        borderWidth: 0.5,
        padding: 16,
        marginBottom: 10,
    },
    topicRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
    },
    topicIconWrap: {
        width: 48,
        height: 48,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    topicInfo: { flex: 1 },
    topicHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    paperBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    paperBadgeText: { fontSize: 11, fontWeight: '700' },
    topicTitle: { fontSize: 15, fontWeight: '600', marginBottom: 2 },
    topicDesc: { fontSize: 12, lineHeight: 16, marginBottom: 6 },
    topicMeta: { flexDirection: 'row', gap: 12 },
    topicMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    topicMetaText: { fontSize: 11 },
});
