/**
 * LeadCard — Tropic Office restyle.
 *
 * This is a PROOF-OF-CONCEPT showing the minimal surgery to port an existing
 * component. The props, data shape, and interaction model are UNCHANGED from
 * the original components/LeadCard.tsx — only the visual layer moves.
 *
 * Diff summary vs original:
 *  1. Added `import { Fonts } from '@/constants/type'` — use Fraunces on name,
 *     Inter on meta.
 *  2. Name uses Fonts.serif instead of fontWeight '600' sans.
 *  3. Card now has a visible hairline border (colors.cardBorder is no longer
 *     'transparent' in the new palette — this works automatically).
 *  4. Avatar letter renders in Fraunces italic for a subtle character moment.
 *  5. Phone number uses Fonts.mono for tabular scannability.
 *  6. activityPreview drops the italic style (italic is now reserved for
 *     accent words — not general emphasis).
 *  7. Radius 14 instead of 12 — matches Tropic's softer-but-not-bubbly scale.
 *
 * That's it. Replace your existing LeadCard.tsx with this file (rename import
 * path as needed), and every leads list in the app updates.
 */

import StatusBadge from '@/components/StatusBadge';
import { Fonts } from '@/constants/type';
import { letterSpacing } from '@/constants/platform';
import { useTheme } from '@/contexts/ThemeContext';
import { timeAgo } from '@/lib/dateTime';
import { formatSgPhone } from '@/lib/phone';
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

function LeadCard({ lead, onPress, lastActivity, agentName }: LeadCardProps) {
    const { colors } = useTheme();

    return (
        <TouchableOpacity
            style={[
                styles.card,
                {
                    backgroundColor: colors.cardBackground,
                    borderColor: colors.cardBorder, // now visible in Tropic
                },
            ]}
            onPress={onPress}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={`Lead: ${lead.full_name}, Status: ${lead.status}`}
        >
            {/* Top Row */}
            <View style={styles.topRow}>
                <View style={styles.nameRow}>
                    <View style={[styles.avatar, { backgroundColor: colors.accentLight }]}>
                        <Text style={[styles.avatarText, { color: colors.accent, fontFamily: Fonts.serifItalic }]}>
                            {(lead.full_name || '?').charAt(0).toUpperCase()}
                        </Text>
                    </View>
                    <View style={styles.nameCol}>
                        <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
                            {lead.full_name}
                        </Text>
                        {lead.phone && (
                            <Text style={[styles.phone, { color: colors.textTertiary }]}>
                                {formatSgPhone(lead.phone)}
                            </Text>
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
                                <Text
                                    style={[styles.tagText, { color: colors.accent, fontFamily: Fonts.sansSemibold }]}
                                >
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
                <Text style={[styles.timeText, { color: colors.textTertiary }]}>{timeAgo(lead.updated_at)}</Text>
            </View>
        </TouchableOpacity>
    );
}

export default React.memo(LeadCard);

const styles = StyleSheet.create({
    card: {
        borderRadius: 14, // ← was 12; Tropic scale
        borderWidth: StyleSheet.hairlineWidth, // ← NEW; uses cardBorder from Tropic palette
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
    avatarText: { fontSize: 17, fontWeight: '500' }, // ← serif italic now
    nameCol: { flex: 1 },
    name: {
        fontFamily: Fonts.serif, // ← Fraunces, not sans
        fontSize: 16,
        fontWeight: '500',
        letterSpacing: letterSpacing(-0.2),
    },
    phone: {
        fontFamily: Fonts.mono, // ← tabular mono for phone numbers
        fontSize: 12,
        marginTop: 1,
    },
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
    tagText: {
        fontFamily: Fonts.sans,
        fontSize: 12,
        fontWeight: '500',
    },
    timeText: {
        fontFamily: Fonts.mono,
        fontSize: 11,
    },
    bottomLeft: { flex: 1, marginRight: 8, gap: 4 },
    activityPreview: {
        fontFamily: Fonts.sans,
        fontSize: 11,
        // italic removed — italic is reserved for accent words in Tropic
    },
});
