import type { ThemeColors } from '@/types/theme';
import { LEAD_STATUSES, STATUS_CONFIG, type LeadStatus } from '@/types/lead';
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
        <View
            testID="status-picker"
            style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}
        >
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Change Status</Text>
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
                                    backgroundColor: isActive ? cfg.bgColor : colors.surfacePrimary,
                                    borderColor: isActive ? cfg.color : colors.borderLight,
                                    borderWidth: isActive ? 1.5 : 0.5,
                                    opacity: isUpdating ? 0.5 : 1,
                                },
                            ]}
                            onPress={() => onChangeStatus(s)}
                            disabled={isUpdating}
                        >
                            <Ionicons name={cfg.icon} size={16} color={isActive ? cfg.color : colors.textTertiary} />
                            <Text
                                style={[
                                    styles.statusOptionText,
                                    { color: isActive ? cfg.color : colors.textSecondary },
                                ]}
                            >
                                {cfg.label}
                            </Text>
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
        borderRadius: 14,
        borderWidth: 0.5,
        padding: 16,
        marginBottom: 12,
    },
    sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 12 },
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
        paddingVertical: 8,
        borderRadius: 8,
    },
    statusOptionText: { fontSize: 13, fontWeight: '600' },
});
