import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import type { IconName } from '@/types/ui';

interface QuickActionProps {
    icon: IconName;
    label: string;
    color: string;
    bgColor: string;
    onPress: () => void;
    disabled?: boolean;
    testID?: string;
}

function QuickAction({ icon, label, color, bgColor, onPress, disabled, testID }: QuickActionProps) {
    return (
        <TouchableOpacity
            testID={testID}
            style={[styles.quickAction, disabled && styles.disabled]}
            onPress={onPress}
            disabled={disabled}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={label}
        >
            <View style={[styles.quickActionIcon, { backgroundColor: bgColor }]}>
                <Ionicons name={icon} size={22} color={color} />
            </View>
            <Text style={[styles.quickActionLabel, { color }]}>{label}</Text>
        </TouchableOpacity>
    );
}

export default React.memo(QuickAction);

const styles = StyleSheet.create({
    quickAction: {
        alignItems: 'center',
        gap: 7,
        minWidth: 60,
    },
    disabled: { opacity: 0.35 },
    quickActionIcon: {
        width: 52,
        height: 52,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    quickActionLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.1 },
});
