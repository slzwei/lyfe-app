import { STATUS_CONFIG, type LeadStatus } from '@/types/lead';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface StatusBadgeProps {
    status: LeadStatus;
    size?: 'small' | 'medium';
    showIcon?: boolean;
}

export default function StatusBadge({ status, size = 'small', showIcon = false }: StatusBadgeProps) {
    const config = STATUS_CONFIG[status];
    const isSmall = size === 'small';

    return (
        <View
            style={[
                styles.badge,
                {
                    backgroundColor: config.bgColor,
                    paddingHorizontal: isSmall ? 8 : 12,
                    paddingVertical: isSmall ? 3 : 5,
                },
            ]}
        >
            {showIcon && (
                <Ionicons
                    name={config.icon as any}
                    size={isSmall ? 12 : 14}
                    color={config.color}
                />
            )}
            <Text
                style={[
                    styles.text,
                    {
                        color: config.color,
                        fontSize: isSmall ? 11 : 13,
                    },
                ]}
            >
                {config.label}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        borderRadius: 6,
    },
    text: {
        fontWeight: '700',
        letterSpacing: 0.3,
    },
});
