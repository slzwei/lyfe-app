import type { ThemeColors } from '@/types/theme';
import type { IconName } from '@/types/ui';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface DisplayActivity {
    id: string;
    type: string;
    leadName: string;
    detail: string;
    time: string;
    icon: IconName;
}

interface Props {
    activities: DisplayActivity[];
    colors: ThemeColors;
    onSeeAll: () => void;
}

function RecentActivityCard({ activities, colors, onSeeAll }: Props) {
    return (
        <View style={[styles.card, { backgroundColor: colors.cardBackground, shadowColor: colors.textPrimary }]}>
            <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Recent Activity</Text>
                <TouchableOpacity
                    onPress={onSeeAll}
                    accessibilityRole="button"
                    accessibilityLabel="See all recent activity"
                >
                    <Text style={[styles.seeAllText, { color: colors.accent }]}>See All</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.activityFeed}>
                {activities.length === 0 ? (
                    <Text style={[styles.emptyText, { color: colors.textTertiary }]}>No recent activity</Text>
                ) : (
                    activities.map((activity) => (
                        <View key={activity.id} style={styles.activityRow}>
                            <View style={[styles.activityIconCircle, { backgroundColor: colors.accentLight }]}>
                                <Ionicons name={activity.icon} size={18} color={colors.accent} />
                            </View>
                            <View style={styles.activityContent}>
                                <Text style={[styles.activityLeadName, { color: colors.textPrimary }]}>
                                    {activity.leadName}
                                </Text>
                                <Text style={[styles.activityDetail, { color: colors.textSecondary }]}>
                                    {activity.detail}
                                </Text>
                            </View>
                            <Text style={[styles.activityTime, { color: colors.textTertiary }]}>{activity.time}</Text>
                        </View>
                    ))
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        marginHorizontal: 16,
        marginBottom: 20,
        borderRadius: 20,
        padding: 20,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 12,
        elevation: 2,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 0 },
    seeAllText: { fontSize: 14, fontWeight: '600' },
    activityFeed: { gap: 16 },
    emptyText: { fontSize: 14, textAlign: 'center', paddingVertical: 8 },
    activityRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    activityIconCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    activityContent: { flex: 1 },
    activityLeadName: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
    activityDetail: { fontSize: 13, fontWeight: '400' },
    activityTime: { fontSize: 12, alignSelf: 'flex-start', marginTop: 2 },
});

export default React.memo(RecentActivityCard);
