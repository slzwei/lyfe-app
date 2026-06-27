/**
 * Filled status pill (ported from mktr-leads `StatusChip`, re-skinned).
 * Uses the leads-scoped AA-checked statusColors/pillText. Display-only here
 * (the whole card is the tap target); the tappable detail status grid (P2)
 * adds 44pt sizing.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Txt } from './Txt';
import { statusColors, pillText, STATUS_LABELS, radius, type LeadStatusKey } from '@/lib/leads/theme';

export function StatusChip({ status }: { status: LeadStatusKey }) {
    return (
        <View style={[styles.chip, { backgroundColor: statusColors[status] }]}>
            <Txt role="body" weight="bold" size={13} color={pillText[status]}>
                {STATUS_LABELS[status]}
            </Txt>
        </View>
    );
}

const styles = StyleSheet.create({
    chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.chip, alignSelf: 'flex-start' },
});
