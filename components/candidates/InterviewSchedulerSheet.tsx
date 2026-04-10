import type { ThemeColors } from '@/types/theme';
import type { Interview, InterviewRecommendation } from '@/types/recruitment';
import { RECOMMENDATION_CONFIG } from '@/types/recruitment';
import WheelPicker from '@/components/WheelPicker';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Animated from 'react-native-reanimated';
import { letterSpacing } from '@/constants/platform';
import { ERROR_BG, ERROR_TEXT } from '@/constants/ui';
import type { AnimatedStyle } from 'react-native-reanimated';
import type { ViewStyle } from 'react-native';

const HOURS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
const MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];
const AMPM = ['AM', 'PM'];

interface InterviewSchedulerSheetProps {
    visible: boolean;
    colors: ThemeColors;
    animatedStyle: AnimatedStyle<ViewStyle>;
    editingInterview: Interview | null;
    candidateInterviewCount: number;
    scheduleDate: Date;
    scheduleHour: number;
    scheduleMinute: number;
    scheduleAmPm: 'AM' | 'PM';
    scheduleType: 'zoom' | 'in_person';
    scheduleLink: string;
    scheduleLocation: string;
    scheduleNotes: string;
    scheduleStatus: Interview['status'];
    scheduleRecommendation: InterviewRecommendation | null;
    scheduleError: string | null;
    isScheduling: boolean;
    onDateChange: (d: Date | ((prev: Date) => Date)) => void;
    onHourChange: (h: number) => void;
    onMinuteChange: (m: number) => void;
    onAmPmChange: (v: 'AM' | 'PM') => void;
    onTypeChange: (t: 'zoom' | 'in_person') => void;
    onLinkChange: (v: string) => void;
    onLocationChange: (v: string) => void;
    onNotesChange: (v: string) => void;
    onStatusChange: (s: Interview['status']) => void;
    onRecommendationChange: (r: InterviewRecommendation | null) => void;
    onSubmit: () => void;
    onDismiss: () => void;
}

function addDays(date: Date, days: number) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

function formatScheduleDate(date: Date) {
    return date.toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function isToday(date: Date) {
    const now = new Date();
    return date.toDateString() === now.toDateString();
}

export default function InterviewSchedulerSheet({
    visible,
    colors,
    animatedStyle,
    editingInterview,
    candidateInterviewCount,
    scheduleDate,
    scheduleHour,
    scheduleMinute,
    scheduleAmPm,
    scheduleType,
    scheduleLink,
    scheduleLocation,
    scheduleNotes,
    scheduleStatus,
    scheduleRecommendation,
    scheduleError,
    isScheduling,
    onDateChange,
    onHourChange,
    onMinuteChange,
    onAmPmChange,
    onTypeChange,
    onLinkChange,
    onLocationChange,
    onNotesChange,
    onStatusChange,
    onRecommendationChange,
    onSubmit,
    onDismiss,
}: InterviewSchedulerSheetProps) {
    return (
        <Modal visible={visible} transparent animationType="none" onRequestClose={onDismiss}>
            <View style={sheetStyles.overlay}>
                {/* Backdrop */}
                <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />

                {/* Sheet content */}
                <Animated.View style={[schedStyles.sheet, { backgroundColor: colors.cardBackground }, animatedStyle]}>
                    <View style={[sheetStyles.handle, { backgroundColor: colors.border }]} />
                    <Text style={[sheetStyles.sheetTitle, { color: colors.textPrimary }]}>
                        {editingInterview
                            ? `Edit Interview · Round ${editingInterview.round_number}`
                            : `Schedule Interview · Round ${candidateInterviewCount + 1}`}
                    </Text>

                    <KeyboardAwareScrollView
                        style={{ width: '100%' }}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                    >
                        {scheduleError && (
                            <View style={[schedStyles.errorRow, { backgroundColor: ERROR_BG }]}>
                                <Ionicons name="alert-circle" size={14} color={ERROR_TEXT} />
                                <Text style={schedStyles.errorText}>{scheduleError}</Text>
                            </View>
                        )}

                        {/* Date row */}
                        <Text style={[schedStyles.fieldLabel, { color: colors.textTertiary }]}>Date</Text>
                        <View style={[schedStyles.row, { backgroundColor: colors.surfacePrimary }]}>
                            <TouchableOpacity
                                onPress={() => onDateChange((d) => addDays(d, -1))}
                                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                                accessibilityRole="button"
                                accessibilityLabel="Previous day"
                            >
                                <Ionicons name="chevron-back" size={22} color={colors.textSecondary} />
                            </TouchableOpacity>
                            <Text
                                style={[
                                    schedStyles.rowValue,
                                    { color: colors.textPrimary, flex: 1, textAlign: 'center' },
                                ]}
                            >
                                {formatScheduleDate(scheduleDate)}
                            </Text>
                            <TouchableOpacity
                                onPress={() => onDateChange((d) => addDays(d, 1))}
                                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                                accessibilityRole="button"
                                accessibilityLabel="Next day"
                            >
                                <Ionicons name="chevron-forward" size={22} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>
                        {!isToday(scheduleDate) && (
                            <TouchableOpacity
                                onPress={() => onDateChange(new Date())}
                                style={schedStyles.todayBtn}
                                accessibilityRole="button"
                                accessibilityLabel="Jump to today"
                            >
                                <Text style={[schedStyles.todayBtnText, { color: colors.accent }]}>Jump to today</Text>
                            </TouchableOpacity>
                        )}

                        {/* Time wheel picker */}
                        <Text style={[schedStyles.fieldLabel, { color: colors.textTertiary }]}>Time</Text>
                        <View style={[schedStyles.wheelContainer, { backgroundColor: colors.surfacePrimary }]}>
                            <WheelPicker
                                key={`hour-${editingInterview?.id ?? 'new'}`}
                                items={HOURS}
                                selectedIndex={Math.max(0, HOURS.indexOf(scheduleHour.toString()))}
                                onChange={(idx) => onHourChange(parseInt(HOURS[idx]))}
                                colors={colors}
                                width={80}
                            />
                            <Text style={[schedStyles.wheelColon, { color: colors.textPrimary }]}>:</Text>
                            <WheelPicker
                                key={`min-${editingInterview?.id ?? 'new'}`}
                                items={MINUTES}
                                selectedIndex={Math.max(0, MINUTES.indexOf(scheduleMinute.toString().padStart(2, '0')))}
                                onChange={(idx) => onMinuteChange(parseInt(MINUTES[idx]))}
                                colors={colors}
                                width={72}
                            />
                            <View style={[schedStyles.wheelVertDivider, { backgroundColor: colors.border }]} />
                            <WheelPicker
                                key={`ampm-${editingInterview?.id ?? 'new'}`}
                                items={AMPM}
                                selectedIndex={scheduleAmPm === 'AM' ? 0 : 1}
                                onChange={(idx) => onAmPmChange(AMPM[idx] as 'AM' | 'PM')}
                                colors={colors}
                                width={64}
                            />
                        </View>

                        {/* Type toggle */}
                        <Text style={[schedStyles.fieldLabel, { color: colors.textTertiary }]}>Format</Text>
                        <View style={schedStyles.typeToggle}>
                            <TouchableOpacity
                                style={[
                                    schedStyles.typeBtn,
                                    {
                                        backgroundColor:
                                            scheduleType === 'zoom' ? colors.accent : colors.surfacePrimary,
                                    },
                                ]}
                                onPress={() => onTypeChange('zoom')}
                                accessibilityRole="radio"
                                accessibilityState={{ checked: scheduleType === 'zoom' }}
                                accessibilityLabel="Zoom"
                            >
                                <Ionicons
                                    name="videocam-outline"
                                    size={16}
                                    color={scheduleType === 'zoom' ? colors.textInverse : colors.textSecondary}
                                />
                                <Text
                                    style={[
                                        schedStyles.typeBtnText,
                                        {
                                            color: scheduleType === 'zoom' ? colors.textInverse : colors.textSecondary,
                                        },
                                    ]}
                                >
                                    Zoom
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    schedStyles.typeBtn,
                                    {
                                        backgroundColor:
                                            scheduleType === 'in_person' ? colors.accent : colors.surfacePrimary,
                                    },
                                ]}
                                onPress={() => onTypeChange('in_person')}
                                accessibilityRole="radio"
                                accessibilityState={{ checked: scheduleType === 'in_person' }}
                                accessibilityLabel="In-person"
                            >
                                <Ionicons
                                    name="business-outline"
                                    size={16}
                                    color={scheduleType === 'in_person' ? colors.textInverse : colors.textSecondary}
                                />
                                <Text
                                    style={[
                                        schedStyles.typeBtnText,
                                        {
                                            color:
                                                scheduleType === 'in_person'
                                                    ? colors.textInverse
                                                    : colors.textSecondary,
                                        },
                                    ]}
                                >
                                    In-person
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* Link or location */}
                        {scheduleType === 'zoom' ? (
                            <TextInput
                                style={[
                                    schedStyles.input,
                                    {
                                        color: colors.textPrimary,
                                        backgroundColor: colors.surfacePrimary,
                                    },
                                ]}
                                placeholder="Zoom link (optional)"
                                placeholderTextColor={colors.textTertiary}
                                value={scheduleLink}
                                onChangeText={onLinkChange}
                                autoCapitalize="none"
                                keyboardType="url"
                            />
                        ) : (
                            <TextInput
                                style={[
                                    schedStyles.input,
                                    {
                                        color: colors.textPrimary,
                                        backgroundColor: colors.surfacePrimary,
                                    },
                                ]}
                                placeholder="Location (optional)"
                                placeholderTextColor={colors.textTertiary}
                                value={scheduleLocation}
                                onChangeText={onLocationChange}
                            />
                        )}

                        {/* Notes */}
                        <TextInput
                            style={[
                                schedStyles.input,
                                {
                                    color: colors.textPrimary,
                                    backgroundColor: colors.surfacePrimary,
                                    minHeight: 56,
                                },
                            ]}
                            placeholder="Notes (optional)"
                            placeholderTextColor={colors.textTertiary}
                            value={scheduleNotes}
                            onChangeText={onNotesChange}
                            multiline
                            textAlignVertical="top"
                        />

                        {/* Status — edit mode only */}
                        {editingInterview && (
                            <>
                                <Text style={[schedStyles.fieldLabel, { color: colors.textTertiary }]}>Status</Text>
                                <View style={[schedStyles.typeToggle, { flexWrap: 'wrap' }]}>
                                    {(['scheduled', 'completed', 'rescheduled', 'cancelled'] as const).map((s) => (
                                        <TouchableOpacity
                                            key={s}
                                            style={[
                                                schedStyles.typeBtn,
                                                {
                                                    backgroundColor:
                                                        scheduleStatus === s ? colors.accent : colors.surfacePrimary,
                                                    flex: undefined,
                                                    paddingHorizontal: 14,
                                                },
                                            ]}
                                            onPress={() => onStatusChange(s)}
                                            accessibilityRole="radio"
                                            accessibilityState={{ checked: scheduleStatus === s }}
                                            accessibilityLabel={s.charAt(0).toUpperCase() + s.slice(1)}
                                        >
                                            <Text
                                                style={[
                                                    schedStyles.typeBtnText,
                                                    {
                                                        color:
                                                            scheduleStatus === s
                                                                ? colors.textInverse
                                                                : colors.textSecondary,
                                                        fontSize: 13,
                                                    },
                                                ]}
                                            >
                                                {s.charAt(0).toUpperCase() + s.slice(1)}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                <Text style={[schedStyles.fieldLabel, { color: colors.textTertiary }]}>
                                    Recommendation
                                </Text>
                                <View style={[schedStyles.typeToggle, { flexWrap: 'wrap' }]}>
                                    {(['second_interview', 'on_hold', 'pass'] as InterviewRecommendation[]).map((r) => {
                                        const cfg = RECOMMENDATION_CONFIG[r];
                                        const isSelected = scheduleRecommendation === r;
                                        return (
                                            <TouchableOpacity
                                                key={r}
                                                style={[
                                                    schedStyles.typeBtn,
                                                    {
                                                        backgroundColor: isSelected
                                                            ? cfg.color + '20'
                                                            : colors.surfacePrimary,
                                                        borderWidth: isSelected ? 1.5 : 0,
                                                        borderColor: isSelected ? cfg.color : 'transparent',
                                                        flex: undefined,
                                                        paddingHorizontal: 14,
                                                    },
                                                ]}
                                                onPress={() => onRecommendationChange(isSelected ? null : r)}
                                                accessibilityRole="radio"
                                                accessibilityState={{ checked: isSelected }}
                                                accessibilityLabel={cfg.label}
                                            >
                                                <Ionicons
                                                    name={cfg.icon as 'refresh-outline'}
                                                    size={14}
                                                    color={isSelected ? cfg.color : colors.textSecondary}
                                                />
                                                <Text
                                                    style={[
                                                        schedStyles.typeBtnText,
                                                        {
                                                            color: isSelected ? cfg.color : colors.textSecondary,
                                                            fontSize: 13,
                                                        },
                                                    ]}
                                                >
                                                    {cfg.label}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </>
                        )}

                        <TouchableOpacity
                            style={[
                                sheetStyles.primaryBtn,
                                { backgroundColor: colors.warning, opacity: isScheduling ? 0.5 : 1 },
                            ]}
                            onPress={onSubmit}
                            activeOpacity={0.85}
                            disabled={isScheduling}
                            accessibilityRole="button"
                            accessibilityLabel={
                                isScheduling ? 'Saving' : editingInterview ? 'Save changes' : 'Confirm schedule'
                            }
                        >
                            <Ionicons name="calendar-outline" size={18} color={colors.textInverse} />
                            <Text style={[sheetStyles.primaryBtnText, { color: colors.textInverse }]}>
                                {isScheduling ? 'Saving...' : editingInterview ? 'Save Changes' : 'Confirm Schedule'}
                            </Text>
                        </TouchableOpacity>

                        <View style={{ height: 8 }} />
                    </KeyboardAwareScrollView>
                </Animated.View>
            </View>
        </Modal>
    );
}

const sheetStyles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'flex-end',
    },
    handle: {
        width: 36,
        height: 4,
        borderRadius: 2,
        marginBottom: 24,
    },
    sheetTitle: {
        fontSize: 18,
        fontWeight: '700',
        textAlign: 'center',
        letterSpacing: letterSpacing(-0.3),
        marginBottom: 20,
    },
    primaryBtn: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 15,
        borderRadius: 14,
        marginBottom: 10,
        minHeight: 52,
    },
    primaryBtnText: {
        fontSize: 16,
        fontWeight: '700',
    },
});

const schedStyles = StyleSheet.create({
    sheet: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 20,
        paddingTop: 12,
        maxHeight: '92%',
        alignItems: 'center',
    },
    fieldLabel: {
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 6,
        alignSelf: 'flex-start',
    },
    row: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 14,
        marginBottom: 16,
    },
    rowValue: { fontSize: 15, fontWeight: '600' },
    wheelContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 16,
        marginBottom: 16,
        width: '100%',
        paddingVertical: 4,
        overflow: 'hidden',
    },
    wheelColon: {
        fontSize: 26,
        fontWeight: '300',
        marginHorizontal: 2,
        marginBottom: 2,
    },
    wheelVertDivider: {
        width: StyleSheet.hairlineWidth,
        height: 40,
        marginHorizontal: 8,
    },
    typeToggle: {
        width: '100%',
        flexDirection: 'row',
        gap: 10,
        marginBottom: 16,
    },
    typeBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 12,
        borderRadius: 12,
    },
    typeBtnText: { fontSize: 14, fontWeight: '600' },
    input: {
        width: '100%',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 15,
        marginBottom: 16,
    },
    todayBtn: { alignSelf: 'flex-start', marginBottom: 10, marginTop: -10, paddingLeft: 2 },
    todayBtnText: { fontSize: 13, fontWeight: '600' },
    errorRow: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        padding: 10,
        borderRadius: 10,
        marginBottom: 12,
    },
    errorText: { fontSize: 13, color: ERROR_TEXT, flex: 1 },
});
