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
            style={[styles.quickAction, { opacity: disabled ? 0.4 : 1 }]}
            onPress={onPress}
            disabled={disabled}
        >
            <View style={[styles.quickActionIcon, { backgroundColor: bgColor }]}>
                <Ionicons name={icon} size={20} color={color} />
            </View>
            <Text style={[styles.quickActionLabel, { color }]}>{label}</Text>
        </TouchableOpacity>
    );
}

export default React.memo(QuickAction);

const styles = StyleSheet.create({
    quickAction: {
        alignItems: 'center',
        gap: 4,
    },
    quickActionIcon: {
        width: 44,
        height: 44,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    quickActionLabel: { fontSize: 11, fontWeight: '600' },
});
