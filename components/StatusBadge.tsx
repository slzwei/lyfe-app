import { STATUS_CONFIG, type LeadStatus } from '@/types/lead';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface StatusBadgeProps {
    status: LeadStatus;
    size?: 'small' | 'medium';
    showIcon?: boolean;
}

export default function StatusBadge({ status, size = 'small' }: StatusBadgeProps) {
    const config = STATUS_CONFIG[status];
    const isSmall = size === 'small';

    return (
        <View
            style={[
                styles.badge,
                {
                    backgroundColor: config.color + '14',
                    paddingHorizontal: isSmall ? 10 : 12,
                    paddingVertical: isSmall ? 4 : 5,
                },
            ]}
        >
            <Text
                style={[
                    styles.text,
                    {
                        color: config.color,
                        fontSize: isSmall ? 12 : 13,
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
        borderRadius: 12,
    },
    text: {
        fontWeight: '600',
    },
});
