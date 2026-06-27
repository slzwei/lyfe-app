/**
 * Small source badge pinned to the monogram (ported from mktr-leads, re-skinned).
 * Shows where the lead came from (MKTR / referral / event / …).
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLeadsTheme } from '@/lib/leads/theme';
import { resolveLeadSource } from '@/lib/leads/meta';
import type { Lead } from '@/types/lead';

export function SourceBadge({
    lead,
    size = 18,
    ringColor,
}: {
    lead: Pick<Lead, 'source' | 'source_name'>;
    size?: number;
    ringColor?: string;
}) {
    const { colors } = useLeadsTheme();
    const src = resolveLeadSource(lead);
    return (
        <View
            style={[
                styles.badge,
                {
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    backgroundColor: colors.surface,
                    borderColor: ringColor ?? colors.surface,
                },
            ]}
        >
            <Ionicons name={src.icon} size={Math.round(size * 0.62)} color={colors.textMuted} />
        </View>
    );
}

const styles = StyleSheet.create({
    badge: { alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
});
