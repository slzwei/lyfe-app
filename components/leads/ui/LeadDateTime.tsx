/**
 * Date + time picker for follow-ups — wraps lyfe-native InlineCalendar +
 * InlineTimePicker into a single `Date` value/onChange (NO new native dep).
 * Reused by the Log + Follow-up sheets.
 */
import React from 'react';
import { View } from 'react-native';
import InlineCalendar from '@/components/events/InlineCalendar';
import InlineTimePicker from '@/components/InlineTimePicker';
import { toDateStr } from '@/lib/dateTime';
import { useLeadsTheme, spacing } from '@/lib/leads/theme';

const MINUTE_STEP = 5;
const NO_EVENTS: Set<string> = new Set();

function toParts(d: Date): { dateStr: string; hour: number; minute: number; amPm: 'AM' | 'PM' } {
    const h24 = d.getHours();
    const amPm: 'AM' | 'PM' = h24 >= 12 ? 'PM' : 'AM';
    const hour = h24 % 12 === 0 ? 12 : h24 % 12;
    const minute = (Math.round(d.getMinutes() / MINUTE_STEP) * MINUTE_STEP) % 60;
    return { dateStr: toDateStr(d), hour, minute, amPm };
}

function compose(dateStr: string, hour: number, minute: number, amPm: 'AM' | 'PM'): Date {
    const [y, m, d] = dateStr.split('-').map(Number);
    const h24 = amPm === 'PM' ? (hour % 12) + 12 : hour % 12;
    return new Date(y, (m || 1) - 1, d || 1, h24, minute, 0, 0);
}

export function LeadDateTime({ value, onChange }: { value: Date; onChange: (d: Date) => void }) {
    const { colors } = useLeadsTheme();
    const p = toParts(value);
    return (
        <View style={{ gap: spacing.md }}>
            <InlineCalendar
                selectedDate={p.dateStr}
                onSelectDate={(ds) => onChange(compose(ds, p.hour, p.minute, p.amPm))}
                eventDates={NO_EVENTS}
                colors={colors}
            />
            <InlineTimePicker
                hour={p.hour}
                minute={p.minute}
                amPm={p.amPm}
                onHourChange={(h) => onChange(compose(p.dateStr, h, p.minute, p.amPm))}
                onMinuteChange={(mn) => onChange(compose(p.dateStr, p.hour, mn, p.amPm))}
                onAmPmChange={(ap) => onChange(compose(p.dateStr, p.hour, p.minute, ap))}
                colors={colors}
            />
        </View>
    );
}
