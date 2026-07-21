/**
 * Leads-local list card (mktr-leads UI/UX adoption · Option B).
 *
 * This is a NEW, leads-only card — it deliberately does NOT touch the shared
 * `components/LeadCard.tsx` (also used by the Team agent view). Only the leads
 * list imports this. Monogram + source badge + filled status chip + status rail,
 * all on the leads theme bridge.
 */
import React from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Txt } from './ui/Txt';
import { Monogram } from './ui/Monogram';
import { SourceBadge } from './ui/SourceBadge';
import { StatusChip } from './ui/StatusChip';
import { useLeadsTheme, useLeadsThemedStyles, statusColors, spacing, radius, type LeadsTheme } from '@/lib/leads/theme';
import { resolveLeadSource } from '@/lib/leads/meta';
import { formatSgPhone } from '@/lib/phone';
import { timeAgo } from '@/lib/dateTime';
import { PRODUCT_LABELS, type Lead } from '@/types/lead';

function LeadListCardBase({ lead, onPress }: { lead: Lead; onPress: () => void }) {
    const { colors } = useLeadsTheme();
    const styles = useLeadsThemedStyles(makeStyles);
    const isWon = lead.status === 'won';
    const isNew = lead.status === 'new';
    const src = resolveLeadSource(lead);
    const sub = [PRODUCT_LABELS[lead.product_interest], src.label].filter(Boolean).join(' · ');

    return (
        <Pressable
            testID={`lead-card-${lead.id}`}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={`Lead: ${lead.full_name}, Status: ${lead.status}, from ${src.label}`}
            style={({ pressed }) => [styles.card, isWon && styles.cardWon, pressed && { opacity: 0.88 }]}
        >
            <View
                style={[styles.bar, { backgroundColor: statusColors[lead.status], opacity: isNew || isWon ? 1 : 0.4 }]}
            />

            <View style={styles.row}>
                <View style={styles.avatarWrap}>
                    <Monogram name={lead.full_name} status={lead.status} size={42} />
                    <View style={styles.srcBadge}>
                        <SourceBadge lead={lead} size={18} ringColor={isWon ? colors.wonSurface : colors.surface} />
                    </View>
                </View>

                <View style={styles.identity}>
                    <Txt
                        role="body"
                        weight="semibold"
                        size={16.5}
                        color={colors.text}
                        tracking={-0.2}
                        numberOfLines={1}
                    >
                        {lead.full_name || 'Unknown'}
                    </Txt>
                    {lead.phone ? (
                        <Txt role="mono" size={13} color={colors.textMuted} style={styles.phone}>
                            {formatSgPhone(lead.phone)}
                        </Txt>
                    ) : null}
                    {/* Do-not-contact (MKTR suppression propagation) */}
                    {lead.do_not_contact_at ? (
                        <View style={styles.dncRow}>
                            <Ionicons
                                name="ban"
                                size={12}
                                color={lead.do_not_contact_scope === 'all' ? colors.danger : colors.warning}
                            />
                            <Txt
                                role="body"
                                weight="semibold"
                                size={12}
                                color={lead.do_not_contact_scope === 'all' ? colors.danger : colors.warning}
                            >
                                {lead.do_not_contact_scope === 'all' ? 'Do not contact' : 'No marketing'}
                            </Txt>
                        </View>
                    ) : null}
                </View>

                <StatusChip status={lead.status} />
            </View>

            <View style={styles.footer}>
                <Txt role="body" size={13} color={colors.textFaint} numberOfLines={1} style={styles.sub}>
                    {sub}
                </Txt>
                <View style={styles.timeRow}>
                    <Ionicons name="time-outline" size={13} color={isWon ? colors.success : colors.textFaint} />
                    <Txt role="mono" size={13} color={isWon ? colors.success : colors.textFaint}>
                        {timeAgo(lead.updated_at)}
                    </Txt>
                </View>
            </View>
        </Pressable>
    );
}

export const LeadListCard = React.memo(LeadListCardBase);

const makeStyles = ({ colors }: LeadsTheme) =>
    StyleSheet.create({
        card: {
            position: 'relative',
            overflow: 'hidden',
            backgroundColor: colors.surface,
            borderRadius: radius.card,
            borderWidth: 1,
            borderColor: colors.border,
            paddingVertical: 14,
            paddingRight: spacing.lg,
            paddingLeft: spacing.lg + 2,
            marginBottom: 11,
        },
        cardWon: { backgroundColor: colors.wonSurface },
        bar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
        row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
        avatarWrap: { width: 42, height: 42, flexShrink: 0 },
        srcBadge: { position: 'absolute', right: -4, bottom: -4 },
        identity: { flex: 1, minWidth: 0 },
        phone: { marginTop: 2 },
        dncRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
        footer: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 12,
            paddingTop: 11,
            borderTopWidth: 1,
            borderTopColor: colors.border,
        },
        sub: { flex: 1, marginRight: spacing.sm },
        timeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    });
