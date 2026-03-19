import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ResourceItem from './ResourceItem';
import Touchable from '@/components/Touchable';
import type { RoadmapModuleWithProgress } from '@/types/roadmap';
import { MODULE_TYPE_CONFIG, MODULE_TYPE_COLOR_KEY } from '@/types/roadmap';
import { displayWeight, letterSpacing } from '@/constants/platform';
import { ICON } from '@/constants/ui';
import type { ThemeColors } from '@/types/theme';
import type { IconName } from '@/types/ui';

interface Props {
    module: RoadmapModuleWithProgress;
    colors: ThemeColors;
    /** Called when the "Take Exam" CTA is pressed. Only relevant for exam modules. */
    onTakeExam?: () => void;
}

/**
 * Read-only module detail card.
 * Used on the candidate-facing Module Detail screen.
 * No completion buttons or write operations.
 */
function ModuleCard({ module, colors, onTakeExam }: Props) {
    const typeConfig = MODULE_TYPE_CONFIG[module.module_type];
    const typeColor = colors[MODULE_TYPE_COLOR_KEY[module.module_type]];

    const statusLabel =
        module.progress?.status === 'completed'
            ? 'Completed'
            : module.progress?.status === 'in_progress'
              ? 'In Progress'
              : 'Not Started';

    const statusColor =
        module.progress?.status === 'completed'
            ? colors.success
            : module.progress?.status === 'in_progress'
              ? colors.accent
              : colors.textTertiary;

    const statusIcon: IconName =
        module.progress?.status === 'completed'
            ? 'checkmark-circle'
            : module.progress?.status === 'in_progress'
              ? 'time'
              : 'ellipse-outline';

    // Format completed date if available
    const completedDate = module.progress?.completed_at
        ? new Date(module.progress.completed_at).toLocaleDateString('en-SG', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
          })
        : null;

    return (
        <View style={styles.wrapper}>
            {/* Header card */}
            <View style={[styles.headerCard, { backgroundColor: colors.surfacePrimary }]}>
                {/* Badge row: type + status */}
                <View style={styles.badgeRow}>
                    <View style={[styles.badge, { backgroundColor: typeColor + '14' }]}>
                        <Ionicons name={typeConfig.icon} size={ICON.SM} color={typeColor} />
                        <Text style={[styles.badgeText, { color: typeColor }]}>{typeConfig.label}</Text>
                    </View>

                    <View style={[styles.badge, { backgroundColor: statusColor + '14' }]}>
                        <Ionicons name={statusIcon} size={ICON.SM} color={statusColor} />
                        <Text style={[styles.badgeText, { color: statusColor }]}>{statusLabel}</Text>
                    </View>
                </View>

                {/* Module title */}
                <Text style={[styles.title, { color: colors.textPrimary }]}>{module.title}</Text>

                {/* Description */}
                {module.description ? (
                    <Text style={[styles.description, { color: colors.textSecondary }]}>{module.description}</Text>
                ) : null}

                {/* Meta row: duration + required badge */}
                <View style={styles.metaRow}>
                    {module.estimated_minutes ? (
                        <View style={styles.metaItem}>
                            <Ionicons name="time-outline" size={ICON.SM} color={colors.textTertiary} />
                            <Text style={[styles.metaText, { color: colors.textTertiary }]}>
                                ~{module.estimated_minutes} min
                            </Text>
                        </View>
                    ) : null}
                    {module.is_required && (
                        <View style={[styles.requiredBadge, { backgroundColor: colors.accent + '14' }]}>
                            <Text style={[styles.requiredText, { color: colors.accent }]}>Required</Text>
                        </View>
                    )}
                </View>

                {/* Completed-by line */}
                {module.progress?.status === 'completed' && completedDate ? (
                    <View
                        style={[
                            styles.completedBanner,
                            { backgroundColor: colors.success + '10', borderColor: colors.success + '20' },
                        ]}
                    >
                        <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                        <Text style={[styles.completedText, { color: colors.success }]}>
                            Completed on {completedDate}
                        </Text>
                    </View>
                ) : null}
            </View>

            {/* Learning objectives */}
            {module.learning_objectives ? (
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Learning Objectives</Text>
                    {module.learning_objectives.split('\n').map((obj, i) => (
                        <View key={i} style={styles.objectiveRow}>
                            <Ionicons name="checkmark-circle-outline" size={16} color={colors.success} />
                            <Text style={[styles.objectiveText, { color: colors.textSecondary }]}>{obj.trim()}</Text>
                        </View>
                    ))}
                </View>
            ) : null}

            {/* Resources */}
            {module.resources.length > 0 ? (
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Resources</Text>
                    {module.resources.map((r) => (
                        <ResourceItem key={r.id} resource={r} colors={colors} />
                    ))}
                </View>
            ) : null}

            {/* Exam CTA */}
            {module.module_type === 'exam' && module.exam_paper_id && onTakeExam ? (
                <View style={styles.section}>
                    <View style={[styles.examInfo, { backgroundColor: colors.surfacePrimary }]}>
                        {module.examPaper ? (
                            <>
                                <Text style={[styles.examCode, { color: colors.textTertiary }]}>
                                    {module.examPaper.code}
                                </Text>
                                <Text style={[styles.examTitle, { color: colors.textPrimary }]}>
                                    {module.examPaper.title}
                                </Text>
                                <Text style={[styles.examPass, { color: colors.textSecondary }]}>
                                    Pass mark: {module.examPaper.pass_percentage}%
                                </Text>
                            </>
                        ) : null}
                    </View>
                    <Touchable
                        style={[styles.examButton, { backgroundColor: colors.accent }]}
                        onPress={onTakeExam}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="school" size={ICON.MD} color={colors.textInverse} />
                        <Text style={[styles.examButtonText, { color: colors.textInverse }]}>
                            {module.progress?.status === 'completed' ? 'Retake Exam' : 'Take Exam'}
                        </Text>
                    </Touchable>
                </View>
            ) : null}

            {/* Management notes (read-only) */}
            {module.progress?.notes ? (
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Notes from your manager</Text>
                    <View style={[styles.noteCard, { backgroundColor: colors.surfacePrimary }]}>
                        <Ionicons name="chatbubble-outline" size={16} color={colors.textTertiary} />
                        <Text style={[styles.noteText, { color: colors.textSecondary }]}>{module.progress.notes}</Text>
                    </View>
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        gap: 0,
    },
    headerCard: {
        margin: 16,
        marginBottom: 0,
        padding: 20,
        borderRadius: 16,
        gap: 10,
    },
    badgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    badgeText: {
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.4,
    },
    title: {
        fontSize: 24,
        fontWeight: displayWeight('700'),
        letterSpacing: letterSpacing(-0.4),
    },
    description: {
        fontSize: 15,
        lineHeight: 22,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    metaText: {
        fontSize: 13,
    },
    requiredBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    requiredText: {
        fontSize: 11,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.3,
    },
    completedBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        marginTop: 2,
    },
    completedText: {
        fontSize: 13,
        fontWeight: '500',
    },
    section: {
        paddingHorizontal: 16,
        paddingTop: 24,
        gap: 12,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        letterSpacing: letterSpacing(-0.2),
    },
    objectiveRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
    },
    objectiveText: {
        flex: 1,
        fontSize: 14,
        lineHeight: 20,
    },
    examInfo: {
        padding: 16,
        borderRadius: 12,
        gap: 4,
    },
    examCode: {
        fontSize: 11,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    examTitle: {
        fontSize: 15,
        fontWeight: '500',
    },
    examPass: {
        fontSize: 13,
        marginTop: 2,
    },
    examButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 12,
        gap: 8,
    },
    examButtonText: {
        fontSize: 16,
        fontWeight: '600',
    },
    noteCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        padding: 14,
        borderRadius: 12,
    },
    noteText: {
        flex: 1,
        fontSize: 14,
        lineHeight: 20,
        fontStyle: 'italic',
    },
});

export default React.memo(ModuleCard);
