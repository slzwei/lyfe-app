import Avatar from '@/components/Avatar';
import { ATTENDEE_ROLE_COLORS, ATTENDEE_ROLE_LABELS, ATTENDEE_ROLE_ORDER, AVATAR_COLORS } from '@/constants/ui';
import type { AttendeeRole, EventAttendee, ExternalAttendee } from '@/types/event';
import type { Colors } from '@/constants/Colors';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export interface EventAttendeesProps {
    colors: typeof Colors.light;
    grouped: Record<AttendeeRole, EventAttendee[]>;
    totalAttendees: number;
    externalAttendees: ExternalAttendee[];
}

function EventAttendeesInner({ colors, grouped, totalAttendees, externalAttendees }: EventAttendeesProps) {
    return (
        <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Attendees ({totalAttendees})</Text>
            {totalAttendees === 0 ? (
                <Text style={[styles.noAttendees, { color: colors.textTertiary }]}>No attendees added yet</Text>
            ) : (
                <>
                    {ATTENDEE_ROLE_ORDER.filter((r) => grouped[r].length > 0).map((role) => (
                        <View key={role} style={styles.roleGroup}>
                            <Text style={[styles.roleGroupLabel, { color: colors.textTertiary }]}>
                                {ATTENDEE_ROLE_LABELS[role]}
                            </Text>
                            {grouped[role].map((a) => {
                                const ac = AVATAR_COLORS[(a.full_name ?? '?').charCodeAt(0) % AVATAR_COLORS.length];
                                return (
                                    <View key={a.id} style={styles.attendeeRow}>
                                        <Avatar
                                            name={a.full_name ?? '?'}
                                            avatarUrl={a.avatar_url}
                                            size={36}
                                            backgroundColor={ac + '18'}
                                            textColor={ac}
                                        />
                                        <Text style={[styles.attendeeName, { color: colors.textPrimary }]}>
                                            {a.full_name}
                                        </Text>
                                        <View
                                            style={[
                                                styles.roleBadge,
                                                { backgroundColor: ATTENDEE_ROLE_COLORS[a.attendee_role] + '18' },
                                            ]}
                                        >
                                            <Text
                                                style={[
                                                    styles.roleText,
                                                    { color: ATTENDEE_ROLE_COLORS[a.attendee_role] },
                                                ]}
                                            >
                                                {ATTENDEE_ROLE_LABELS[a.attendee_role]}
                                            </Text>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    ))}
                    {externalAttendees.length > 0 && (
                        <View style={styles.roleGroup}>
                            <Text style={[styles.roleGroupLabel, { color: colors.textTertiary }]}>External Guests</Text>
                            {externalAttendees.map((a, i) => {
                                const ac = AVATAR_COLORS[a.name.charCodeAt(0) % AVATAR_COLORS.length];
                                return (
                                    <View key={i} style={styles.attendeeRow}>
                                        <Avatar
                                            name={a.name}
                                            avatarUrl={null}
                                            size={36}
                                            backgroundColor={ac + '18'}
                                            textColor={ac}
                                        />
                                        <Text style={[styles.attendeeName, { color: colors.textPrimary }]}>
                                            {a.name}
                                        </Text>
                                        <View
                                            style={[
                                                styles.roleBadge,
                                                {
                                                    backgroundColor:
                                                        (ATTENDEE_ROLE_COLORS[a.attendee_role] ?? '#8E8E93') + '18',
                                                },
                                            ]}
                                        >
                                            <Text
                                                style={[
                                                    styles.roleText,
                                                    {
                                                        color: ATTENDEE_ROLE_COLORS[a.attendee_role] ?? '#8E8E93',
                                                    },
                                                ]}
                                            >
                                                {ATTENDEE_ROLE_LABELS[a.attendee_role] ?? a.attendee_role}
                                            </Text>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    )}
                </>
            )}
        </View>
    );
}

export const EventAttendees = React.memo(EventAttendeesInner);

const styles = StyleSheet.create({
    card: { borderRadius: 16, padding: 16, gap: 12 },
    cardTitle: { fontSize: 15, fontWeight: '700' },
    noAttendees: { fontSize: 14 },
    roleGroup: { gap: 8, marginTop: 4 },
    roleGroupLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
    attendeeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    attendeeName: { flex: 1, fontSize: 15, fontWeight: '500' },
    roleBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    roleText: { fontSize: 11, fontWeight: '700' },
});
