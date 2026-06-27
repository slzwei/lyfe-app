/**
 * Lead actions sheet — Archive / Unarchive (D2: archive-only, no delete).
 * Mounted on the detail top-bar owner slot.
 */
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Sheet, SheetHeader } from './ui/Sheet';
import { Txt } from './ui/Txt';
import { useLeadsTheme, alpha, radius, spacing } from '@/lib/leads/theme';
import type { IconName } from '@/types/ui';

function ActionRow({
    icon,
    label,
    sub,
    danger,
    onPress,
    testID,
}: {
    icon: IconName;
    label: string;
    sub?: string;
    danger?: boolean;
    onPress: () => void;
    testID?: string;
}) {
    const { colors } = useLeadsTheme();
    const tint = danger ? colors.danger : colors.text;
    return (
        <Pressable
            testID={testID}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={label}
            style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.surfaceAlt : 'transparent' }]}
        >
            <View style={[styles.icon, { backgroundColor: alpha(danger ? colors.danger : colors.accent, 0.14) }]}>
                <Ionicons name={icon} size={18} color={danger ? colors.danger : colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
                <Txt role="body" weight="semibold" size={15} color={tint}>
                    {label}
                </Txt>
                {sub ? (
                    <Txt role="body" size={13} color={colors.textMuted}>
                        {sub}
                    </Txt>
                ) : null}
            </View>
        </Pressable>
    );
}

export function LeadActionsSheet({
    visible,
    onClose,
    isArchived,
    onArchive,
    onUnarchive,
}: {
    visible: boolean;
    onClose: () => void;
    isArchived: boolean;
    onArchive: () => void;
    onUnarchive: () => void;
}) {
    return (
        <Sheet visible={visible} onClose={onClose}>
            <SheetHeader icon="ellipsis-horizontal" title="Lead actions" onClose={onClose} />
            {isArchived ? (
                <ActionRow
                    testID="lead-unarchive-action"
                    icon="arrow-undo-outline"
                    label="Unarchive"
                    sub="Return this lead to your active list"
                    onPress={onUnarchive}
                />
            ) : (
                <ActionRow
                    testID="lead-archive-action"
                    icon="archive-outline"
                    label="Archive"
                    sub="Hide from your active list — never deleted"
                    onPress={onArchive}
                />
            )}
        </Sheet>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 13,
        paddingVertical: 12,
        paddingHorizontal: spacing.sm,
        borderRadius: radius.card,
    },
    icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
