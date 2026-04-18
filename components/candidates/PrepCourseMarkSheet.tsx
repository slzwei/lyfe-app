import InlineCalendar from '@/components/InlineCalendar';
import InlineTimePicker from '@/components/InlineTimePicker';
import { KAV_BEHAVIOR, letterSpacing } from '@/constants/platform';
import { formatDateLabel, toDateStr } from '@/lib/dateTime';
import type { PrepCourseCode } from '@/types/recruitment';
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
    courseCode: PrepCourseCode | null;
    courseLabel: string;
    /** Start of the booking window. */
    bookedAt: Date | null;
    /** End of a multi-day booking (null for single-day). */
    bookedEndAt: Date | null;
    attended: boolean;
    noteText: string;
    isSaving: boolean;
    error: string | null;
    onBookedAtChange: (at: Date | null) => void;
    onBookedEndAtChange: (at: Date | null) => void;
    onAttendedChange: (attended: boolean) => void;
    onNoteTextChange: (text: string) => void;
    onSave: () => void;
    onDismiss: () => void;
}

function splitSchedule(at: Date | null) {
    if (!at) return { dateStr: null as string | null, hour12: 9, minute: 0, amPm: 'AM' as const };
    const hour24 = at.getHours();
    const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
    const amPm: 'AM' | 'PM' = hour24 >= 12 ? 'PM' : 'AM';
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

export default function PrepCourseMarkSheet({
    visible,
    colors,
    animatedStyle,
    courseCode,
    courseLabel,
    bookedAt,
    bookedEndAt,
    attended,
    noteText,
    isSaving,
    error,
    onBookedAtChange,
    onBookedEndAtChange,
    onAttendedChange,
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

    const { dateStr, hour12, minute, amPm } = useMemo(() => splitSchedule(bookedAt), [bookedAt]);
    const { dateStr: endDateStr } = useMemo(() => splitSchedule(bookedEndAt), [bookedEndAt]);

    const isSameDay = bookedEndAt === null || (endDateStr && endDateStr === dateStr);
    const bookedLabel = !bookedAt
        ? 'Choose date & time'
        : !isSameDay && bookedEndAt
          ? `${formatDateLabel(toDateStr(bookedAt))} → ${formatDateLabel(toDateStr(bookedEndAt))} · ${formatTimeLabel(hour12, minute, amPm)}`
          : `${formatDateLabel(toDateStr(bookedAt))} · ${formatTimeLabel(hour12, minute, amPm)}`;

    const emitTimeChange = (h: number, m: number, a: 'AM' | 'PM') => {
        if (!dateStr) return;
        onBookedAtChange(composeSchedule(dateStr, h, m, a));
        if (bookedEndAt && endDateStr) {
            onBookedEndAtChange(composeSchedule(endDateStr, h, m, a));
        }
    };

    const emitRange = (startStr: string, endStr: string) => {
        onBookedAtChange(composeSchedule(startStr, hour12, minute, amPm));
        if (startStr === endStr) {
            onBookedEndAtChange(null);
        } else {
            onBookedEndAtChange(composeSchedule(endStr, hour12, minute, amPm));
        }
    };

    const canSave = !isSaving && !!courseCode;

    return (
        <Modal visible={visible} transparent animationType="none" onRequestClose={onDismiss}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={KAV_BEHAVIOR}>
                <View style={styles.overlay}>
                    <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
                    <Animated.View style={[styles.sheet, { backgroundColor: colors.cardBackground }, animatedStyle]}>
                        <View style={[styles.handle, { backgroundColor: colors.border }]} />

                        <View style={[styles.iconWrap, { backgroundColor: colors.surfaceSecondary }]}>
                            <Ionicons name="school-outline" size={26} color={colors.accent} />
                        </View>

                        <Text style={[styles.title, { color: colors.textPrimary }]}>
                            {courseLabel ? `Mark ${courseLabel}` : 'Mark Prep Course'}
                        </Text>
                        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                            Record the booking date and attendance
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
                            <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>Booked date & time</Text>
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
                                    testID="prep-course-mark-open-date-picker"
                                >
                                    <Ionicons name="calendar-outline" size={18} color={colors.accent} />
                                    <Text style={[styles.dateText, { color: colors.textPrimary }]}>{bookedLabel}</Text>
                                    <Ionicons
                                        name={calendarExpanded ? 'chevron-up' : 'chevron-down'}
                                        size={18}
                                        color={colors.textTertiary}
                                        style={{ marginLeft: 'auto' }}
                                    />
                                </TouchableOpacity>
                                {bookedAt && (
                                    <TouchableOpacity
                                        onPress={() => {
                                            onBookedAtChange(null);
                                            onAttendedChange(false);
                                        }}
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

                            <TouchableOpacity
                                style={[
                                    styles.toggleRow,
                                    {
                                        borderColor: attended ? colors.success : colors.border,
                                        backgroundColor: attended ? colors.successLight : 'transparent',
                                    },
                                ]}
                                onPress={() => onAttendedChange(!attended)}
                                activeOpacity={0.85}
                                testID="prep-course-mark-attended-toggle"
                            >
                                <Ionicons
                                    name={attended ? 'checkmark-circle' : 'ellipse-outline'}
                                    size={22}
                                    color={attended ? colors.success : colors.textTertiary}
                                />
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.toggleLabel, { color: colors.textPrimary }]}>Attended</Text>
                                    <Text style={[styles.toggleHint, { color: colors.textTertiary }]}>
                                        Mark on once the candidate has completed the course
                                    </Text>
                                </View>
                            </TouchableOpacity>

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
                                placeholder="e.g. Booked with Horizon Academy"
                                placeholderTextColor={colors.textTertiary}
                                value={noteText}
                                onChangeText={onNoteTextChange}
                                multiline
                                numberOfLines={2}
                                textAlignVertical="top"
                                testID="prep-course-mark-note-input"
                            />
                        </ScrollView>

                        {error && <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>}

                        <TouchableOpacity
                            style={[styles.primaryBtn, { backgroundColor: colors.accent, opacity: canSave ? 1 : 0.6 }]}
                            onPress={onSave}
                            disabled={!canSave}
                            activeOpacity={0.85}
                            testID="prep-course-mark-save"
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
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
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
    scroll: { alignSelf: 'stretch', marginHorizontal: -24, maxHeight: SCROLL_MAX_H },
    scrollContent: { paddingHorizontal: 24, paddingBottom: 20 },
    sectionLabel: { fontSize: 14, fontWeight: '700', marginBottom: 10, alignSelf: 'flex-start' },
    sectionLabelOptional: { fontSize: 12, fontWeight: '400' },
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
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 14,
        paddingHorizontal: 14,
        borderWidth: 1,
        borderRadius: 12,
        marginTop: 14,
    },
    toggleLabel: { fontSize: 15, fontWeight: '600' },
    toggleHint: { fontSize: 12, marginTop: 2 },
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
