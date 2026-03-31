import type { ThemeColors } from '@/types/theme';
import { LEAD_STATUSES, STATUS_CONFIG, type LeadStatus } from '@/types/lead';
import { shadow } from '@/constants/platform';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface StatusPickerProps {
    currentStatus: LeadStatus;
    isUpdating: boolean;
    colors: ThemeColors;
    onChangeStatus: (status: LeadStatus) => void;
}

function StatusPicker({ currentStatus, isUpdating, colors, onChangeStatus }: StatusPickerProps) {
    return (
        <View testID="status-picker" style={[styles.card, { backgroundColor: colors.cardBackground }, shadow('sm')]}>
            <View style={styles.header}>
                <View style={[styles.headerIcon, { backgroundColor: colors.warningLight }]}>
                    <Ionicons name="swap-horizontal" size={14} color={colors.warning} />
                </View>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Change Status</Text>
            </View>
            <View style={styles.statusGrid}>
                {LEAD_STATUSES.map((s) => {
                    const cfg = STATUS_CONFIG[s];
                    const isActive = s === currentStatus;
                    return (
                        <TouchableOpacity
                            key={s}
                            testID={`status-option-${s}`}
                            style={[
                                styles.statusOption,
                                {
                                    backgroundColor: isActive ? cfg.color + '18' : colors.surfaceSecondary,
                                    borderColor: isActive ? cfg.color : 'transparent',
                                    borderWidth: isActive ? 1.5 : 0,
                                    opacity: isUpdating ? 0.5 : 1,
                                },
                            ]}
                            onPress={() => onChangeStatus(s)}
                            disabled={isUpdating}
                            activeOpacity={0.7}
                            accessibilityRole="radio"
                            accessibilityState={{ checked: isActive }}
                            accessibilityLabel={cfg.label}
                        >
                            <View
                                style={[
                                    styles.statusDot,
                                    { backgroundColor: isActive ? cfg.color : colors.textTertiary },
                                ]}
                            />
                            <Text
                                style={[
                                    styles.statusOptionText,
                                    { color: isActive ? cfg.color : colors.textSecondary },
                                ]}
                            >
                                {cfg.label}
                            </Text>
                            {isActive && (
                                <Ionicons
                                    name="checkmark-circle"
                                    size={14}
                                    color={cfg.color}
                                    style={styles.checkIcon}
                                />
                            )}
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}

export default React.memo(StatusPicker);

const styles = StyleSheet.create({
    card: {
        borderRadius: 16,
        padding: 16,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 14,
    },
    headerIcon: {
        width: 28,
        height: 28,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sectionTitle: { fontSize: 15, fontWeight: '700' },
    statusGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    statusOption: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 9,
        borderRadius: 10,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    statusOptionText: { fontSize: 13, fontWeight: '600' },
    checkIcon: {
        marginLeft: 2,
    },
});
