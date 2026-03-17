import { STATUS_CONFIG, type LeadStatus } from '@/types/lead';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface StatusBadgeProps {
    status: LeadStatus;
    size?: 'small' | 'medium';
}

function StatusBadge({ status, size = 'small' }: StatusBadgeProps) {
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
            accessibilityLabel={`Status: ${config.label}`}
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

export default React.memo(StatusBadge);

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
