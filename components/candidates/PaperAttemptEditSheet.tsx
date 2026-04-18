/**
 * Paper attempt — add/edit form.
 *
 * Single Modal that slides up over the paper-attempts screen. No nested
 * modals here; the parent screen stays as a pushed route.
 */
import InlineCalendar from '@/components/InlineCalendar';
import InlineTimePicker from '@/components/InlineTimePicker';
import { KAV_BEHAVIOR, letterSpacing } from '@/constants/platform';
import { formatDateLabel, toDateStr } from '@/lib/dateTime';
import type { CandidatePaperAttempt, PaperCode } from '@/types/recruitment';
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

type ResultValue = 'scheduled' | 'passed' | 'failed';

interface Props {
    visible: boolean;
    colors: ThemeColors;
    animatedStyle: AnimatedStyle<ViewStyle>;
    requirementLabel: string;
    acceptedPaperCodes: PaperCode[];
    editing: CandidatePaperAttempt | null;
    isSaving: boolean;
    error: string | null;
    onSave: (payload: {
        paperCode: PaperCode;
        examAt: Date | null;
        cost: number | null;
        result: 'passed' | 'failed' | null;
    }) => void;
    onDelete?: () => void;
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

function formatTimeLabel(h: number, m: number, a: 'AM' | 'PM'): string {
    return `${h}:${String(m).padStart(2, '0')} ${a}`;
}

export default function PaperAttemptEditSheet({
    visible,
    colors,
    animatedStyle,
    requirementLabel,
    acceptedPaperCodes,
    editing,
    isSaving,
    error,
    onSave,
    onDelete,
    onDismiss,
}: Props) {
    const [paperCode, setPaperCode] = useState<PaperCode>(acceptedPaperCodes[0] ?? 'M9');
    const [examAt, setExamAt] = useState<Date | null>(null);
    const [costText, setCostText] = useState<string>('');
    const [result, setResult] = useState<ResultValue>('scheduled');
    const [calendarExpanded, setCalendarExpanded] = useState(false);

    const scrollRef = useRef<ScrollView | null>(null);
    const calendarYRef = useRef(0);
    const timeYRef = useRef(0);

    useEffect(() => {
        if (!visible) return;
        if (editing) {
            setPaperCode(editing.paper_code);
            setExamAt(editing.exam_at ? new Date(editing.exam_at) : null);
            setCostText(editing.cost != null ? String(editing.cost) : '');
            setResult(editing.result === 'passed' ? 'passed' : editing.result === 'failed' ? 'failed' : 'scheduled');
        } else {
            setPaperCode(acceptedPaperCodes[0] ?? 'M9');
            setExamAt(null);
            setCostText('');
            setResult('scheduled');
        }
        setCalendarExpanded(false);
    }, [visible, editing, acceptedPaperCodes]);

    useEffect(() => {
        if (calendarExpanded) {
            const t = setTimeout(() => {
                scrollRef.current?.scrollTo({
                    y: Math.max(0, calendarYRef.current - 8),
                    animated: true,
                });
            }, 80);
            return () => clearTimeout(t);
        }
    }, [calendarExpanded]);

    const { dateStr, hour12, minute, amPm } = useMemo(() => splitSchedule(examAt), [examAt]);
    const dateButtonLabel = examAt
        ? `${formatDateLabel(toDateStr(examAt))} · ${formatTimeLabel(hour12, minute, amPm)}`
        : 'Choose date & time';

    const emitDate = (d: string | null) => {
        if (!d) return setExamAt(null);
        setExamAt(composeSchedule(d, hour12, minute, amPm));
    };
    const emitTime = (h: number, m: number, a: 'AM' | 'PM') => {
        const day = dateStr ?? toDateStr(new Date());
        setExamAt(composeSchedule(day, h, m, a));
    };

    const handleSave = () => {
        const cost = costText.trim() === '' ? null : Number(costText);
        onSave({
            paperCode,
            examAt,
            cost: Number.isFinite(cost) ? (cost as number) : null,
            result: result === 'scheduled' ? null : result,
        });
    };

    const showCmLipHint = acceptedPaperCodes.includes('CM_LIP') && paperCode !== 'CM_LIP';

    return (
        <Modal visible={visible} transparent animationType="none" onRequestClose={onDismiss}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={KAV_BEHAVIOR}>
                <View style={styles.overlay}>
                    <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
                    <Animated.View style={[styles.sheet, { backgroundColor: colors.cardBackground }, animatedStyle]}>
                        <View style={[styles.handle, { backgroundColor: colors.border }]} />
                        <View style={[styles.iconWrap, { backgroundColor: colors.surfaceSecondary }]}>
                            <Ionicons name="book-outline" size={26} color={colors.accent} />
                        </View>

                        <Text style={[styles.title, { color: colors.textPrimary }]}>
                            {editing ? 'Edit attempt' : `New ${requirementLabel} attempt`}
                        </Text>
                        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                            {editing ? 'Update this sitting' : 'Book the next sitting'}
                        </Text>

                        <ScrollView
                            ref={scrollRef}
                            style={styles.scroll}
                            contentContainerStyle={styles.scrollContent}
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator
                            alwaysBounceVertical
                            bounces
                        >
                            {acceptedPaperCodes.length > 1 && (
                                <>
                                    <Text style={[styles.sectionLabel, { color: colors.textPrimary }]}>Paper code</Text>
                                    <View style={styles.pillRow}>
                                        {acceptedPaperCodes.map((code) => {
                                            const selected = code === paperCode;
                                            return (
                                                <TouchableOpacity
                                                    key={code}
                                                    style={[
                                                        styles.pill,
                                                        {
                                                            borderColor: selected ? colors.accent : colors.border,
                                                            backgroundColor: selected
                                                                ? colors.accent
                                                                : colors.surfacePrimary,
                                                        },
                                                    ]}
                                                    onPress={() => setPaperCode(code)}
                                                    activeOpacity={0.8}
                                                    testID={`paper-attempt-code-${code}`}
                                                >
                                                    <Text
                                                        style={[
                                                            styles.pillText,
                                                            {
                                                                color: selected
                                                                    ? colors.textInverse
                                                                    : colors.textPrimary,
                                                            },
                                                        ]}
                                                    >
                                                        {code}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                    {showCmLipHint && (
                                        <Text style={[styles.hint, { color: colors.textTertiary }]}>
                                            Tip: CM_LIP satisfies both Life 1 + Life 2 in one sitting.
                                        </Text>
                                    )}
                                </>
                            )}

                            <Text style={[styles.sectionLabel, { color: colors.textPrimary, marginTop: 18 }]}>
                                Exam date & time
                            </Text>
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
                                testID="paper-attempt-open-date-picker"
                            >
                                <Ionicons name="calendar-outline" size={18} color={colors.accent} />
                                <Text style={[styles.dateText, { color: colors.textPrimary }]}>{dateButtonLabel}</Text>
                                <Ionicons
                                    name={calendarExpanded ? 'chevron-up' : 'chevron-down'}
                                    size={18}
                                    color={colors.textTertiary}
                                    style={{ marginLeft: 'auto' }}
                                />
                            </TouchableOpacity>

                            {calendarExpanded && (
                                <View
                                    style={styles.calendarWrap}
                                    onLayout={(e) => {
                                        calendarYRef.current = e.nativeEvent.layout.y;
                                    }}
                                >
                                    <InlineCalendar
                                        selectedDate={dateStr}
                                        onSelect={(d) => {
                                            emitDate(d);
                                            setTimeout(() => {
                                                scrollRef.current?.scrollTo({
                                                    y: Math.max(0, timeYRef.current - 8),
                                                    animated: true,
                                                });
                                            }, 120);
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
                                        onHourChange={(h) => emitTime(h, minute, amPm)}
                                        onMinuteChange={(m) => emitTime(hour12, m, amPm)}
                                        onAmPmChange={(a) => emitTime(hour12, minute, a)}
                                        colors={colors}
                                    />
                                </View>
                            )}

                            <Text style={[styles.sectionLabel, { color: colors.textPrimary, marginTop: 18 }]}>
                                Cost
                            </Text>
                            <View style={styles.costRow}>
                                <Text style={[styles.costPrefix, { color: colors.textSecondary }]}>S$</Text>
                                <TextInput
                                    style={[
                                        styles.costInput,
                                        { color: colors.textPrimary, backgroundColor: colors.surfacePrimary },
                                    ]}
                                    placeholder="120.00"
                                    placeholderTextColor={colors.textTertiary}
                                    value={costText}
                                    onChangeText={setCostText}
                                    keyboardType="decimal-pad"
                                    testID="paper-attempt-cost-input"
                                />
                            </View>

                            <Text style={[styles.sectionLabel, { color: colors.textPrimary, marginTop: 18 }]}>
                                Result
                            </Text>
                            <View style={[styles.seg, { borderColor: colors.border }]}>
                                <ResultCell
                                    label="Scheduled"
                                    active={result === 'scheduled'}
                                    color={colors.accent}
                                    colors={colors}
                                    onPress={() => setResult('scheduled')}
                                    testID="paper-attempt-result-scheduled"
                                />
                                <ResultCell
                                    label="Passed"
                                    active={result === 'passed'}
                                    color={colors.success}
                                    colors={colors}
                                    onPress={() => setResult('passed')}
                                    testID="paper-attempt-result-passed"
                                />
                                <ResultCell
                                    label="Failed"
                                    active={result === 'failed'}
                                    color={colors.danger}
                                    colors={colors}
                                    onPress={() => setResult('failed')}
                                    testID="paper-attempt-result-failed"
                                />
                            </View>
                        </ScrollView>

                        {error && <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>}

                        <TouchableOpacity
                            style={[styles.primaryBtn, { backgroundColor: colors.accent, opacity: isSaving ? 0.6 : 1 }]}
                            onPress={handleSave}
                            disabled={isSaving}
                            activeOpacity={0.85}
                            testID="paper-attempt-save"
                        >
                            <Ionicons name="checkmark" size={18} color={colors.textInverse} />
                            <Text style={[styles.primaryBtnText, { color: colors.textInverse }]}>
                                {isSaving ? 'Saving…' : 'Save'}
                            </Text>
                        </TouchableOpacity>

                        {editing && onDelete && (
                            <TouchableOpacity
                                style={[styles.dangerBtn, { borderColor: colors.danger }]}
                                onPress={onDelete}
                                activeOpacity={0.85}
                                testID="paper-attempt-delete"
                            >
                                <Text style={[styles.dangerBtnText, { color: colors.danger }]}>Delete attempt</Text>
                            </TouchableOpacity>
                        )}

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

function ResultCell({
    label,
    active,
    color,
    colors,
    onPress,
    testID,
}: {
    label: string;
    active: boolean;
    color: string;
    colors: ThemeColors;
    onPress: () => void;
    testID: string;
}) {
    return (
        <TouchableOpacity
            style={[styles.segCell, active && { backgroundColor: color }]}
            onPress={onPress}
            activeOpacity={0.85}
            testID={testID}
        >
            <Text style={[styles.segCellText, { color: active ? colors.textInverse : colors.textPrimary }]}>
                {label}
            </Text>
        </TouchableOpacity>
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
        marginBottom: 4,
    },
    subtitle: { fontSize: 13, textAlign: 'center', marginBottom: 18 },
    scroll: { alignSelf: 'stretch', marginHorizontal: -24, maxHeight: SCROLL_MAX_H },
    scrollContent: { paddingHorizontal: 24, paddingBottom: 20 },
    sectionLabel: {
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 10,
        alignSelf: 'flex-start',
    },
    pillRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
    pill: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1 },
    pillText: { fontSize: 14, fontWeight: '700' },
    hint: { fontSize: 12, marginTop: 8, alignSelf: 'flex-start' },
    dateBtn: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderWidth: 1,
        borderRadius: 12,
    },
    dateText: { fontSize: 14, fontWeight: '600' },
    calendarWrap: {
        width: '100%',
        marginTop: 10,
        paddingHorizontal: 4,
        paddingVertical: 6,
        borderRadius: 12,
    },
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
    costRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    costPrefix: { fontSize: 15, fontWeight: '700' },
    costInput: { flex: 1, borderRadius: 12, padding: 12, fontSize: 15, minHeight: 44 },
    seg: { flexDirection: 'row', borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
    segCell: { flex: 1, paddingVertical: 11, alignItems: 'center', justifyContent: 'center' },
    segCellText: { fontSize: 13, fontWeight: '700' },
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
    dangerBtn: {
        width: '100%',
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        marginTop: 10,
        alignItems: 'center',
    },
    dangerBtnText: { fontSize: 14, fontWeight: '700' },
    skipRow: { paddingVertical: 8, marginTop: 4 },
    skipText: { fontSize: 14, fontWeight: '500' },
});
