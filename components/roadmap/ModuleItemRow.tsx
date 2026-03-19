import React from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Touchable from '@/components/Touchable';
import type { ModuleItemWithProgress, ModuleItemType } from '@/types/roadmap';
import { MODULE_ITEM_TYPE_CONFIG } from '@/types/roadmap';
import { letterSpacing } from '@/constants/platform';
import type { ThemeColors } from '@/types/theme';
import type { IconName } from '@/types/ui';

interface Props {
    item: ModuleItemWithProgress;
    colors: ThemeColors;
    isLast: boolean;
    /** Navigate to exam screen */
    onStartExam?: (examPaperId: string) => void;
    /** Navigate to results screen for a completed quiz */
    onViewResults?: (examPaperId: string) => void;
    /** Open material in-app (for file/pdf resources). Falls back to Linking.openURL if not provided. */
    onViewMaterial?: (url: string, title: string) => void;
    /** When true, the left-side status icon is hidden (e.g. management context provides its own). */
    hideStatusIcon?: boolean;
}

function ModuleItemRow({ item, colors, isLast, onStartExam, onViewResults, onViewMaterial, hideStatusIcon }: Props) {
    const status = item.progress?.status ?? 'not_started';
    const isCompleted = status === 'completed';
    const typeConfig = MODULE_ITEM_TYPE_CONFIG[item.item_type];

    // Status icon (left)
    const statusIcon: IconName = isCompleted
        ? 'checkmark-circle'
        : status === 'in_progress'
          ? 'contrast-outline'
          : 'ellipse-outline';

    const statusColor = isCompleted ? colors.success : status === 'in_progress' ? colors.accent : colors.textTertiary;

    // Action button config
    const action = getAction(item.item_type, status, item, colors);

    const handleAction = () => {
        if (item.item_type === 'material' && item.resource_url) {
            if (onViewMaterial && item.resource_type === 'file') {
                onViewMaterial(item.resource_url, item.title);
            } else {
                Linking.openURL(item.resource_url);
            }
        } else if (['pre_quiz', 'quiz', 'exam'].includes(item.item_type) && item.exam_paper_id && onStartExam) {
            onStartExam(item.exam_paper_id);
        }
    };

    const handleViewResults = () => {
        if (item.exam_paper_id && onViewResults) {
            onViewResults(item.exam_paper_id);
        }
    };

    return (
        <View
            style={[
                styles.container,
                !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border + '30' },
            ]}
        >
            {!hideStatusIcon && <Ionicons name={statusIcon} size={20} color={statusColor} />}

            <View style={styles.content}>
                <Text
                    style={[styles.title, { color: isCompleted ? colors.textTertiary : colors.textPrimary }]}
                    numberOfLines={2}
                >
                    {item.title}
                </Text>
                {item.description ? (
                    <Text style={[styles.subtitle, { color: colors.textTertiary }]} numberOfLines={1}>
                        {item.description}
                    </Text>
                ) : null}
            </View>

            {/* Action / badge */}
            {action.type === 'button' && (
                <Touchable
                    style={[styles.pill, { backgroundColor: action.bg }]}
                    onPress={handleAction}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={`${action.label} ${item.title}`}
                >
                    <Text style={[styles.pillText, { color: action.textColor }]}>{action.label}</Text>
                </Touchable>
            )}
            {action.type === 'badge' && (
                <View style={[styles.pill, { backgroundColor: action.bg }]}>
                    <Text style={[styles.pillText, { color: action.textColor }]}>{action.label}</Text>
                </View>
            )}
            {action.type === 'score' && (
                <View style={styles.scoreContainer}>
                    <Text style={[styles.scoreText, { color: colors.success }]}>
                        {item.progress?.score != null ? `${item.progress.score}%` : ''}
                    </Text>
                    <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                </View>
            )}
            {action.type === 'completed_personality' && (
                <Touchable
                    style={[styles.pill, { backgroundColor: colors.success + '15' }]}
                    onPress={handleViewResults}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={`View results for ${item.title}`}
                >
                    <Text style={[styles.pillText, { color: colors.success }]}>Results</Text>
                </Touchable>
            )}
        </View>
    );
}

type ActionConfig =
    | { type: 'button'; label: string; bg: string; textColor: string }
    | { type: 'badge'; label: string; bg: string; textColor: string }
    | { type: 'score' }
    | { type: 'completed_personality' }
    | { type: 'none' };

function getAction(
    itemType: ModuleItemType,
    status: string,
    item: ModuleItemWithProgress,
    colors: ThemeColors,
): ActionConfig {
    if (itemType === 'attendance') {
        return status === 'completed'
            ? { type: 'badge', label: 'Attended', bg: colors.success + '15', textColor: colors.success }
            : { type: 'badge', label: 'Pending', bg: colors.textTertiary + '15', textColor: colors.textTertiary };
    }

    if (itemType === 'material') {
        if (!item.resource_url) return { type: 'none' };
        return status === 'completed'
            ? { type: 'button', label: 'View', bg: colors.success + '15', textColor: colors.success }
            : { type: 'button', label: 'View', bg: colors.info + '15', textColor: colors.info };
    }

    // pre_quiz, quiz, exam
    if (status === 'completed' && item.progress?.score != null) {
        return { type: 'score' };
    }
    // Personality quizzes complete with no numeric score
    if (status === 'completed' && item.exam_paper_id) {
        return { type: 'completed_personality' };
    }
    if (status === 'in_progress') {
        return { type: 'button', label: 'Continue', bg: colors.accent + '15', textColor: colors.accent };
    }
    if (!item.exam_paper_id) return { type: 'none' };
    return { type: 'button', label: 'Start', bg: colors.accent + '15', textColor: colors.accent };
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 12,
    },
    content: {
        flex: 1,
        gap: 2,
    },
    title: {
        fontSize: 14,
        fontWeight: '500',
        letterSpacing: letterSpacing(-0.1),
    },
    subtitle: {
        fontSize: 12,
        lineHeight: 16,
    },
    pill: {
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 6,
    },
    pillText: {
        fontSize: 12,
        fontWeight: '600',
    },
    scoreContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    scoreText: {
        fontSize: 13,
        fontWeight: '600',
    },
});

export default React.memo(ModuleItemRow);
