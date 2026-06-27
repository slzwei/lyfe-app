/**
 * Filled status pill (ported from mktr-leads `StatusChip`, re-skinned).
 * Uses the leads-scoped AA-checked statusColors/pillText. Display-only here
 * (the whole card is the tap target); the tappable detail status grid (P2)
 * adds 44pt sizing.
 */
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Txt } from './Txt';
import { statusColors, pillText, radius, type LeadStatusKey } from '@/lib/leads/theme';

const LABELS: Record<LeadStatusKey, string> = {
    new: 'New',
    contacted: 'Contacted',
    qualified: 'Qualified',
    proposed: 'Proposed',
    won: 'Won',
    lost: 'Lost',
    disputed: 'Disputed',
};

export function StatusChip({ status }: { status: LeadStatusKey }) {
    return (
        <View style={[styles.chip, { backgroundColor: statusColors[status] }]}>
            <Txt role="body" weight="bold" size={13} color={pillText[status]}>
                {LABELS[status]}
            </Txt>
        </View>
    );
}

const styles = StyleSheet.create({
    chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.chip, alignSelf: 'flex-start' },
});
