import { TropicFonts } from '@/constants/roadshow/typography';
import { useTheme } from '@/contexts/ThemeContext';
import type { EventType } from '@/types/event';
import { EVENT_TYPE_CONFIG, getEventTypeColor } from '@/constants/displayConfigs';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const EVENT_TYPES: EventType[] = ['team_meeting', 'training', 'agency_event', 'roadshow', 'exam', 'other'];

export interface EventTypeSelectorProps {
    eventType: EventType;
    onSelect: (t: EventType) => void;
    disabled?: boolean;
}

export default function EventTypeSelector({ eventType, onSelect, disabled }: EventTypeSelectorProps) {
    const { colors } = useTheme();

    return (
        <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Event Type *</Text>
            <View style={styles.typeRow}>
                {EVENT_TYPES.map((t) => {
                    const isActive = eventType === t;
                    const color = getEventTypeColor(t, colors);
                    return (
                        <TouchableOpacity
                            key={t}
                            style={[
                                styles.typeChip,
                                {
                                    borderColor: isActive ? color : colors.border,
                                    backgroundColor: isActive ? color + '18' : colors.cardBackground,
                                },
                                disabled && !isActive && { opacity: 0.3 },
                            ]}
                            onPress={() => !disabled && onSelect(t)}
                            activeOpacity={disabled ? 1 : 0.7}
                        >
                            <Text style={[styles.typeChipText, { color: isActive ? color : colors.textSecondary }]}>
                                {EVENT_TYPE_CONFIG[t].label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    field: { marginBottom: 16 },
    label: { fontSize: 13, fontFamily: TropicFonts.uiSemiBold, marginBottom: 6, letterSpacing: -0.1 },
    typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    typeChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1.5 },
    typeChipText: { fontSize: 13, fontFamily: TropicFonts.uiSemiBold, letterSpacing: -0.1 },
});
