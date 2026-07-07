import {
    addEventToDeviceCalendar,
    getDeviceCalendarId,
    isDeviceCalendarAvailable,
    removeEventFromDeviceCalendar,
} from '@/lib/deviceCalendar';
import type { AgencyEvent } from '@/types/event';
import type { ThemeColors } from '@/types/theme';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity } from 'react-native';

/**
 * "Add to Calendar" affordance on the event detail screen.
 * Renders nothing on binaries without the expo-calendar native module
 * (pre-2026-07 builds receiving this code via OTA) — see lib/deviceCalendar.
 */
export default function AddToCalendarRow({ event, colors }: { event: AgencyEvent; colors: ThemeColors }) {
    const available = useMemo(() => isDeviceCalendarAvailable(), []);
    const [added, setAdded] = useState<boolean | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!available) return;
        let cancelled = false;
        getDeviceCalendarId(event.id).then((id) => {
            if (!cancelled) setAdded(!!id);
        });
        return () => {
            cancelled = true;
        };
    }, [available, event.id]);

    if (!available || added === null) return null;

    const handlePress = async () => {
        if (busy) return;
        if (added) {
            Alert.alert('Remove from your calendar?', `"${event.title}" will be removed from your device calendar.`, [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        setBusy(true);
                        await removeEventFromDeviceCalendar(event.id);
                        setAdded(false);
                        setBusy(false);
                    },
                },
            ]);
            return;
        }

        setBusy(true);
        const { error } = await addEventToDeviceCalendar(event);
        setBusy(false);
        if (error) {
            Alert.alert('Couldn’t add to calendar', error);
        } else {
            setAdded(true);
        }
    };

    return (
        <TouchableOpacity
            testID="event-add-to-calendar"
            style={styles.row}
            onPress={handlePress}
            disabled={busy}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={added ? 'In your calendar. Tap to remove' : 'Add to calendar'}
        >
            <Ionicons
                name={added ? 'checkmark-circle' : 'calendar-outline'}
                size={16}
                color={added ? colors.success : colors.accent}
            />
            <Text style={[styles.label, { color: added ? colors.success : colors.accent }]}>
                {added ? 'In your calendar' : 'Add to Calendar'}
            </Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        alignSelf: 'flex-start',
        paddingVertical: 6,
        minHeight: 32,
    },
    label: { fontSize: 13, fontWeight: '600' },
});
