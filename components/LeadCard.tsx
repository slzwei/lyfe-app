import StatusBadge from '@/components/StatusBadge';
import { useTheme } from '@/contexts/ThemeContext';
import { PRODUCT_LABELS, type Lead } from '@/types/lead';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface LeadCardProps {
    lead: Lead;
    onPress: () => void;
    lastActivity?: string;
    agentName?: string;
}

function timeAgo(dateStr: string): string {
    const now = Date.now();
    const diff = now - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' });
}

export default function LeadCard({ lead, onPress, lastActivity, agentName }: LeadCardProps) {
    const { colors } = useTheme();

    return (
        <TouchableOpacity
            style={[styles.card, { backgroundColor: colors.cardBackground }]}
            onPress={onPress}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Lead: ${lead.full_name}, Status: ${lead.status}`}
        >
            {/* Top Row */}
            <View style={styles.topRow}>
                <View style={styles.nameRow}>
                    <View style={[styles.avatar, { backgroundColor: colors.accentLight }]}>
                        <Text style={[styles.avatarText, { color: colors.accent }]}>
                            {lead.full_name.charAt(0).toUpperCase()}
                        </Text>
                    </View>
                    <View style={styles.nameCol}>
                        <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
                            {lead.full_name}
                        </Text>
                        {lead.phone && (
                            <Text style={[styles.phone, { color: colors.textTertiary }]}>{lead.phone}</Text>
                        )}
                    </View>
                </View>
                <StatusBadge status={lead.status} />
            </View>

            {/* Bottom Row */}
            <View style={[styles.bottomRow, { borderTopColor: colors.border }]}>
                <View style={styles.bottomLeft}>
                    <View style={styles.tagsRow}>
                        <View style={styles.tag}>
                            <Ionicons name="shield-outline" size={13} color={colors.textTertiary} />
                            <Text style={[styles.tagText, { color: colors.textTertiary }]}>
                                {PRODUCT_LABELS[lead.product_interest]}
                            </Text>
                        </View>
                        {agentName && (
                            <View style={styles.tag}>
                                <Ionicons name="person-outline" size={13} color={colors.accent} />
                                <Text style={[styles.tagText, { color: colors.accent, fontWeight: '600' }]}>
                                    {agentName}
                                </Text>
                            </View>
                        )}
                    </View>
                    {lastActivity && (
                        <Text style={[styles.activityPreview, { color: colors.textTertiary }]} numberOfLines={1}>
                            {lastActivity}
                        </Text>
                    )}
                </View>
                <Text style={[styles.timeText, { color: colors.textTertiary }]}>
                    {timeAgo(lead.updated_at)}
                </Text>
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: {
        borderRadius: 12,
        padding: 14,
        marginBottom: 6,
    },
    topRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flex: 1,
        marginRight: 8,
    },
    avatar: {
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: { fontSize: 15, fontWeight: '600' },
    nameCol: { flex: 1 },
    name: { fontSize: 16, fontWeight: '600', letterSpacing: -0.2 },
    phone: { fontSize: 13, marginTop: 1 },
    bottomRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 10,
        paddingTop: 10,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    tag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    tagsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    tagText: { fontSize: 12, fontWeight: '500' },
    timeText: { fontSize: 12 },
    bottomLeft: { flex: 1, marginRight: 8, gap: 4 },
    activityPreview: { fontSize: 11, fontStyle: 'italic' },
});
