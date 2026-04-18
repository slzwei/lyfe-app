import InlineCalendar from '@/components/InlineCalendar';
import InlineTimePicker from '@/components/InlineTimePicker';
import { KAV_BEHAVIOR, letterSpacing } from '@/constants/platform';
import { formatDateLabel, toDateStr } from '@/lib/dateTime';
import type { MilestoneCode, MilestoneStatus } from '@/types/recruitment';
import type { ThemeColors } from '@/types/theme';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Dimensions,
    KeyboardAvoidingView,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import type { ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import type { AnimatedStyle } from 'react-native-reanimated';

const SCROLL_MAX_H = Dimensions.get('window').height * 0.6;

interface Props {
    visible: boolean;
    colors: ThemeColors;
    animatedStyle: AnimatedStyle<ViewStyle>;
    milestoneCode: MilestoneCode | null;
    milestoneLabel: string;
    selectedStatus: MilestoneStatus;
    /** Start of the scheduled window (Date) or null. For single-day milestones
     *  this is the only timestamp; for multi-day the end is `scheduledEndAt`. */
    scheduledAt: Date | null;
    /** End of the scheduled window (null for single-day). */
    scheduledEndAt: Date | null;
    referenceNumber: string;
    noteText: string;
    isSaving: boolean;
    error: string | null;
    onStatusChange: (status: MilestoneStatus) => void;
    onScheduledAtChange: (at: Date | null) => void;
    onScheduledEndAtChange: (at: Date | null) => void;
    onReferenceNumberChange: (text: string) => void;
    onNoteTextChange: (text: string) => void;
    onSave: () => void;
    onDismiss: () => void;
}

// ── Schedule helpers ──────────────────────────────────────────────────────

function splitSchedule(at: Date | null): {
    dateStr: string | null;
    hour12: number;
    minute: number;
    amPm: 'AM' | 'PM';
} {
    if (!at) return { dateStr: null, hour12: 9, minute: 0, amPm: 'AM' };
    const hour24 = at.getHours();
    const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
    const amPm: 'AM' | 'PM' = hour24 >= 12 ? 'PM' : 'AM';
    // Round minute down to nearest 5 for the wheel picker.
    const minute = Math.floor(at.getMinutes() / 5) * 5;
    const yyyy = at.getFullYear();
    const mm = String(at.getMonth() + 1).padStart(2, '0');
    const dd = String(at.getDate()).padStart(2, '0');
    return { dateStr: `${yyyy}-${mm}-${dd}`, hour12, minute, amPm };
}

function composeSchedule(dateStr: string, hour12: number, minute: number, amPm: 'AM' | 'PM'): Date {
    const [y, m, d] = dateStr.split('-').map(Number);
    const hour24 = amPm === 'PM' ? (hour12 === 12 ? 12 : hour12 + 12) : hour12 === 12 ? 0 : hour12;
    return new Date(y, (m || 1) - 1, d || 1, hour24, minute, 0, 0);
}

function formatTimeLabel(hour12: number, minute: number, amPm: 'AM' | 'PM'): string {
    return `${hour12}:${String(minute).padStart(2, '0')} ${amPm}`;
}

// Mirrors the DB CHECK constraint cm_status_valid_per_code from migration
// 20260417100100. If you edit this, edit the migration too.
const STATUS_OPTIONS_BY_CODE: Record<
    MilestoneCode,
    { value: MilestoneStatus; label: string; icon: keyof typeof import('@expo/vector-icons').Ionicons.glyphMap }[]
> = {
    bdm: [
        { value: 'not_started', label: 'Not Started', icon: 'ellipse-outline' },
        { value: 'scheduled', label: 'Scheduled', icon: 'calendar-outline' },
        { value: 'completed', label: 'Completed', icon: 'checkmark-circle' },
    ],
    bes_induction: [
        { value: 'not_started', label: 'Not Started', icon: 'ellipse-outline' },
        { value: 'scheduled', label: 'Scheduled', icon: 'calendar-outline' },
        { value: 'completed', label: 'Completed', icon: 'checkmark-circle' },
    ],
    soar: [
        { value: 'not_started', label: 'Not Started', icon: 'ellipse-outline' },
        { value: 'scheduled', label: 'Scheduled', icon: 'calendar-outline' },
        { value: 'completed', label: 'Completed', icon: 'checkmark-circle' },
    ],
    rnf: [
        { value: 'not_started', label: 'Not Started', icon: 'ellipse-outline' },
        { value: 'lodged_to_mas', label: 'Lodged to MAS', icon: 'paper-plane-outline' },
        { value: 'issued', label: 'Issued', icon: 'ribbon' },
    ],
    sales_authority: [
        { value: 'not_started', label: 'Not Started', icon: 'ellipse-outline' },
        { value: 'issued', label: 'Issued', icon: 'ribbon' },
    ],
};

function statusColor(status: MilestoneStatus, colors: ThemeColors): string {
    switch (status) {
        case 'completed':
        case 'issued':
            return colors.success;
        case 'scheduled':
            return colors.warning;
        case 'lodged_to_mas':
            return colors.accent;
        default:
            return colors.textTertiary;
    }
}

export default function MilestoneMarkSheet({
    visible,
    colors,
    animatedStyle,
    milestoneCode,
    milestoneLabel,
    selectedStatus,
    scheduledAt,
    scheduledEndAt,
    referenceNumber,
    noteText,
    isSaving,
    error,
    onStatusChange,
    onScheduledAtChange,
    onScheduledEndAtChange,
    onReferenceNumberChange,
    onNoteTextChange,
    onSave,
    onDismiss,
}: Props) {
    const [calendarExpanded, setCalendarExpanded] = useState(false);
    const scrollRef = useRef<ScrollView | null>(null);
    const calendarYRef = useRef(0);
    const timeYRef = useRef(0);
    useEffect(() => {
        if (calendarExpanded) {
            const t = setTimeout(() => {
                scrollRef.current?.scrollTo({ y: Math.max(0, calendarYRef.current - 8), animated: true });
            }, 80);
            return () => clearTimeout(t);
        }
    }, [calendarExpanded]);

    // Break the incoming scheduledAt into display pieces. When no schedule is
    // set yet we still drive the time wheels with a sensible default (9 AM)
    // so the UI isn't empty; it only becomes "real" state once the user picks
    // a date (we compose the final Date then).
    const { dateStr, hour12, minute, amPm } = useMemo(() => splitSchedule(scheduledAt), [scheduledAt]);
    const { dateStr: endDateStr } = useMemo(() => splitSchedule(scheduledEndAt), [scheduledEndAt]);

    // Always range-mode. A single-day schedule is represented by end = null
    // (what the DB persists) but we still render it as "start = end" in the
    // calendar for UX clarity.
    const isSameDay = scheduledEndAt === null || (endDateStr && endDateStr === dateStr);
    const scheduledLabel = !scheduledAt
        ? 'Choose date & time'
        : !isSameDay && scheduledEndAt
          ? `${formatDateLabel(toDateStr(scheduledAt))} → ${formatDateLabel(toDateStr(scheduledEndAt))} · ${formatTimeLabel(hour12, minute, amPm)}`
          : `${formatDateLabel(toDateStr(scheduledAt))} · ${formatTimeLabel(hour12, minute, amPm)}`;

    // Time-only edit — keep the same dates but update the time on both.
    const emitTimeChange = (h: number, m: number, a: 'AM' | 'PM') => {
        if (!dateStr) return;
        onScheduledAtChange(composeSchedule(dateStr, h, m, a));
        if (scheduledEndAt && endDateStr) {
            onScheduledEndAtChange(composeSchedule(endDateStr, h, m, a));
        }
    };

    // Range edit — user picked/re-picked start+end. Collapse same-day to end=null.
    const emitRange = (startStr: string, endStr: string) => {
        onScheduledAtChange(composeSchedule(startStr, hour12, minute, amPm));
        if (startStr === endStr) {
            onScheduledEndAtChange(null);
        } else {
            onScheduledEndAtChange(composeSchedule(endStr, hour12, minute, amPm));
        }
    };

    const statusOptions = milestoneCode ? STATUS_OPTIONS_BY_CODE[milestoneCode] : [];
    const showScheduledField = selectedStatus === 'scheduled';
    const showRnfReferenceField = milestoneCode === 'rnf' && selectedStatus === 'issued';

    const canSave =
        !isSaving &&
        !!milestoneCode &&
        (!showScheduledField || !!scheduledAt) &&
        (!showRnfReferenceField || referenceNumber.trim().length > 0);

    return (
        <Modal visible={visible} transparent animationType="none" onRequestClose={onDismiss}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={KAV_BEHAVIOR}>
                <View style={styles.overlay}>
                    {/* Backdrop is a sibling of the sheet (not a parent). Dismisses
                        on tap without claiming the responder for the sheet's
                        contents — critical so the inner ScrollView can drive
                        vertical-drag scrolls. */}
                    <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
                    <Animated.View style={[styles.sheet, { backgroundColor: colors.cardBackground }, animatedStyle]}>
                        <View style={[styles.handle, { backgroundColor: colors.border }]} />

                        <View style={[styles.iconWrap, { backgroundColor: colors.surfaceSecondary }]}>
                            <Ionicons name="flag-outline" size={26} color={colors.accent} />
                        </View>

                        <Text style={[styles.title, { color: colors.textPrimary }]}>
                            {milestoneLabel ? `Mark ${milestoneLabel}` : 'Mark Milestone'}
                        </Text>
                        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                            Select a status to update this milestone
                        </Text>

                        <ScrollView
                            ref={scrollRef}
                            style={styles.scroll}
                            contentContainerStyle={styles.scrollContent}
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator
                            alwaysBounceVertical
                            bounces
                            nestedScrollEnabled
                        >
                            <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>Status</Text>
                            {statusOptions.map((opt) => {
                                const selected = opt.value === selectedStatus;
                                const accent = statusColor(opt.value, colors);
                                return (
                                    <TouchableOpacity
                                        key={opt.value}
                                        style={[
                                            styles.statusRow,
                                            {
                                                borderColor: selected ? accent : colors.border,
                                                backgroundColor: selected ? colors.surfaceSecondary : 'transparent',
                                            },
                                        ]}
                                        onPress={() => onStatusChange(opt.value)}
                                        activeOpacity={0.85}
                                        testID={`milestone-mark-status-${opt.value}`}
                                    >
                                        <Ionicons name={opt.icon} size={20} color={accent} />
                                        <Text style={[styles.statusLabel, { color: colors.textPrimary }]}>
                                            {opt.label}
                                        </Text>
                                        {selected && (
                                            <Ionicons
                                                name="checkmark"
                                                size={18}
                                                color={accent}
                                                style={{ marginLeft: 'auto' }}
                                            />
                                        )}
                                    </TouchableOpacity>
                                );
                            })}

                            {showScheduledField && (
                                <>
                                    <Text style={[styles.sectionLabel, { color: colors.textPrimary, marginTop: 18 }]}>
                                        Scheduled date & time
                                    </Text>
                                    <View style={styles.dateRow}>
                                        <TouchableOpacity
                                            style={[
                                                styles.dateBtn,
                                                {
                                                    borderColor: calendarExpanded ? colors.accent : colors.border,
                                                    backgroundColor: colors.surfacePrimary,
                                                },
                                            ]}
                                            onPress={() => setCalendarExpanded((v) => !v)}
                                            activeOpacity={0.7}
                                            testID="milestone-mark-open-date-picker"
                                        >
                                            <Ionicons name="calendar-outline" size={18} color={colors.accent} />
                                            <Text style={[styles.dateText, { color: colors.textPrimary }]}>
                                                {scheduledLabel}
                                            </Text>
                                            <Ionicons
                                                name={calendarExpanded ? 'chevron-up' : 'chevron-down'}
                                                size={18}
                                                color={colors.textTertiary}
                                                style={{ marginLeft: 'auto' }}
                                            />
                                        </TouchableOpacity>
                                        {scheduledAt && (
                                            <TouchableOpacity
                                                onPress={() => onScheduledAtChange(null)}
                                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                            >
                                                <Ionicons name="close-circle" size={22} color={colors.textTertiary} />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                    {calendarExpanded && (
                                        <View
                                            style={styles.calendarWrap}
                                            onLayout={(e) => {
                                                calendarYRef.current = e.nativeEvent.layout.y;
                                            }}
                                        >
                                            <InlineCalendar
                                                mode="range"
                                                startDate={dateStr}
                                                endDate={endDateStr ?? dateStr}
                                                onRangeChange={(s, e) => {
                                                    emitRange(s, e);
                                                    // Scroll down to time picker after user
                                                    // commits a range (second tap). Same-day
                                                    // first tap is still mid-selection.
                                                    if (s !== e) {
                                                        setTimeout(() => {
                                                            scrollRef.current?.scrollTo({
                                                                y: Math.max(0, timeYRef.current - 8),
                                                                animated: true,
                                                            });
                                                        }, 120);
                                                    }
                                                }}
                                                colors={colors}
                                            />
                                            <View
                                                style={styles.timeDivider}
                                                onLayout={(e) => {
                                                    timeYRef.current = calendarYRef.current + e.nativeEvent.layout.y;
                                                }}
                                            />
                                            <Text style={[styles.timeLabel, { color: colors.textTertiary }]}>Time</Text>
                                            <InlineTimePicker
                                                hour={hour12}
                                                minute={minute}
                                                amPm={amPm}
                                                onHourChange={(h) => emitTimeChange(h, minute, amPm)}
                                                onMinuteChange={(m) => emitTimeChange(hour12, m, amPm)}
                                                onAmPmChange={(a) => emitTimeChange(hour12, minute, a)}
                                                colors={colors}
                                            />
                                        </View>
                                    )}
                                </>
                            )}

                            {showRnfReferenceField && (
                                <>
                                    <Text style={[styles.sectionLabel, { color: colors.textPrimary, marginTop: 18 }]}>
                                        RNF reference number
                                    </Text>
                                    <TextInput
                                        style={[
                                            styles.textInput,
                                            { color: colors.textPrimary, backgroundColor: colors.surfacePrimary },
                                        ]}
                                        placeholder="e.g. RNF-2026-001"
                                        placeholderTextColor={colors.textTertiary}
                                        value={referenceNumber}
                                        onChangeText={onReferenceNumberChange}
                                        autoCapitalize="characters"
                                        testID="milestone-mark-rnf-ref-input"
                                    />
                                    <Text style={[styles.hint, { color: colors.textTertiary }]}>
                                        Required to mark the RNF as issued.
                                    </Text>
                                </>
                            )}

                            <Text style={[styles.sectionLabel, { color: colors.textPrimary, marginTop: 18 }]}>
                                Note{'  '}
                                <Text style={[styles.sectionLabelOptional, { color: colors.textTertiary }]}>
                                    optional
                                </Text>
                            </Text>
                            <TextInput
                                style={[
                                    styles.noteInput,
                                    { color: colors.textPrimary, backgroundColor: colors.surfacePrimary },
                                ]}
                                placeholder="e.g. Attended 15 Apr session"
                                placeholderTextColor={colors.textTertiary}
                                value={noteText}
                                onChangeText={onNoteTextChange}
                                multiline
                                numberOfLines={2}
                                textAlignVertical="top"
                                testID="milestone-mark-note-input"
                            />
                        </ScrollView>

                        {error && <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>}

                        <TouchableOpacity
                            style={[styles.primaryBtn, { backgroundColor: colors.accent, opacity: canSave ? 1 : 0.6 }]}
                            onPress={onSave}
                            disabled={!canSave}
                            activeOpacity={0.85}
                            testID="milestone-mark-save"
                        >
                            <Ionicons name="checkmark" size={18} color={colors.textInverse} />
                            <Text style={[styles.primaryBtnText, { color: colors.textInverse }]}>
                                {isSaving ? 'Saving…' : 'Save'}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={onDismiss}
                            style={styles.skipRow}
                            hitSlop={{ top: 12, bottom: 12, left: 24, right: 24 }}
                        >
                            <Text style={[styles.skipText, { color: colors.textTertiary }]}>Cancel</Text>
                        </TouchableOpacity>
                    </Animated.View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'flex-end',
    },
    sheet: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 24,
        paddingBottom: 40,
        paddingTop: 12,
        alignItems: 'center',
        maxHeight: '88%',
    },
    handle: { width: 36, height: 4, borderRadius: 2, marginBottom: 18 },
    iconWrap: {
        width: 54,
        height: 54,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    title: {
        fontSize: 19,
        fontWeight: '700',
        textAlign: 'center',
        letterSpacing: letterSpacing(-0.3),
        marginBottom: 6,
    },
    subtitle: { fontSize: 13, textAlign: 'center', marginBottom: 18 },
    // Cap at 60% of screen height so content-overflow triggers actual
    // scrolling. Can't use flex:1 because the sheet's parent sizes to
    // content, which would shrink this to zero instead of filling the sheet.
    // Negative marginHorizontal makes the ScrollView bleed past the sheet's
    // 24px padding so drag gestures near the side edges are still captured.
    // Horizontal inset for actual content lives on scrollContent.
    scroll: { alignSelf: 'stretch', marginHorizontal: -24, maxHeight: SCROLL_MAX_H },
    scrollContent: { paddingHorizontal: 24, paddingBottom: 20 },
    sectionLabel: {
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 10,
        alignSelf: 'flex-start',
    },
    sectionLabelOptional: { fontSize: 12, fontWeight: '400' },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderWidth: 1,
        borderRadius: 12,
        marginBottom: 8,
    },
    statusLabel: { fontSize: 15, fontWeight: '600' },
    dateRow: { flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%' },
    dateBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderWidth: 1,
        borderRadius: 12,
        flex: 1,
    },
    dateText: { fontSize: 14, fontWeight: '600' },
    calendarWrap: {
        width: '100%',
        marginTop: 10,
        paddingHorizontal: 4,
        paddingVertical: 6,
        borderRadius: 12,
    },
    multiDayToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderWidth: 1,
        borderRadius: 10,
        marginBottom: 10,
    },
    multiDayLabel: { fontSize: 13, fontWeight: '600' },
    timeDivider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: 'rgba(127,127,127,0.25)',
        marginTop: 14,
        marginBottom: 6,
    },
    timeLabel: {
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        alignSelf: 'center',
        marginTop: 2,
        marginBottom: 2,
    },
    textInput: {
        width: '100%',
        borderRadius: 12,
        padding: 12,
        fontSize: 14,
        minHeight: 44,
        lineHeight: 20,
    },
    hint: { fontSize: 12, marginTop: 6, alignSelf: 'flex-start' },
    noteInput: {
        width: '100%',
        borderRadius: 12,
        padding: 12,
        fontSize: 14,
        minHeight: 68,
        lineHeight: 20,
    },
    errorText: { fontSize: 13, marginTop: 8, marginBottom: 4, textAlign: 'center' },
    primaryBtn: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 15,
        borderRadius: 14,
        marginTop: 10,
        minHeight: 52,
    },
    primaryBtnText: { fontSize: 16, fontWeight: '700' },
    skipRow: { paddingVertical: 8, marginTop: 4 },
    skipText: { fontSize: 14, fontWeight: '500' },
});
