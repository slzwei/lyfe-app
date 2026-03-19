import type { ThemeColors } from '@/types/theme';
import type { IconName } from '@/types/ui';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface QuickActionItem {
    icon: IconName;
    label: string;
    color: string;
    bgColor: string;
    onPress: () => void;
    disabled?: boolean;
}

interface Props {
    actions: QuickActionItem[];
    colors: ThemeColors;
}

function QuickActionsBar({ actions, colors }: Props) {
    return (
        <View style={[styles.actionsCard, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
            {actions.map((action) => (
                <TouchableOpacity
                    key={action.label}
                    style={[styles.quickAction, { opacity: action.disabled ? 0.4 : 1 }]}
                    onPress={action.onPress}
                    disabled={action.disabled}
                >
                    <View style={[styles.quickActionIcon, { backgroundColor: action.bgColor }]}>
                        <Ionicons name={action.icon} size={20} color={action.color} />
                    </View>
                    <Text style={[styles.quickActionLabel, { color: action.color }]}>{action.label}</Text>
                </TouchableOpacity>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    actionsCard: {
        flexDirection: 'row',
        borderRadius: 14,
        borderWidth: 0.5,
        padding: 12,
        marginBottom: 12,
        justifyContent: 'space-around',
    },
    quickAction: { alignItems: 'center', gap: 4 },
    quickActionIcon: {
        width: 44,
        height: 44,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    quickActionLabel: { fontSize: 11, fontWeight: '600' },
});

export default React.memo(QuickActionsBar);
