import WheelPicker, { WHEEL_ITEM_H } from '@/components/WheelPicker';
import { MODAL_ANIM_SHEET, MODAL_STATUS_BAR_TRANSLUCENT } from '@/constants/platform';
import { PICKER_AMPM, PICKER_HOURS, PICKER_MINUTES, TIME_PICKER_VISIBLE } from '@/constants/ui';
import { useTheme } from '@/contexts/ThemeContext';
import { useBottomSheetSafeBottom } from '@/hooks/useBottomSheetSafeBottom';
import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export interface TimePickerModalProps {
    visible: boolean;
    mode: 'start' | 'end' | null;
    hasEndTime: boolean;
    startHour: number;
    startMinIdx: number;
    startAmPm: number;
    endHour: number;
    endMinIdx: number;
    endAmPm: number;
    onStartHourChange: (v: number) => void;
    onStartMinIdxChange: (v: number) => void;
    onStartAmPmChange: (v: number) => void;
    onEndHourChange: (v: number) => void;
    onEndMinIdxChange: (v: number) => void;
    onEndAmPmChange: (v: number) => void;
    onRemoveEndTime: () => void;
    onClose: () => void;
}

export default function TimePickerModal({
    visible,
    mode,
    hasEndTime,
    startHour,
    startMinIdx,
    startAmPm,
    endHour,
    endMinIdx,
    endAmPm,
    onStartHourChange,
    onStartMinIdxChange,
    onStartAmPmChange,
    onEndHourChange,
    onEndMinIdxChange,
    onEndAmPmChange,
    onRemoveEndTime,
    onClose,
}: TimePickerModalProps) {
    const { colors } = useTheme();
    const paddingBottom = useBottomSheetSafeBottom(32);

    const isStart = mode === 'start';
    const hourIdx = isStart ? startHour : endHour;
    const minIdx = isStart ? startMinIdx : endMinIdx;
    const ampmIdx = isStart ? startAmPm : endAmPm;
    const onHour = isStart ? onStartHourChange : onEndHourChange;
    const onMin = isStart ? onStartMinIdxChange : onEndMinIdxChange;
    const onAmPm = isStart ? onStartAmPmChange : onEndAmPmChange;

    return (
        <Modal
            visible={visible}
            transparent
            animationType={MODAL_ANIM_SHEET}
            statusBarTranslucent={MODAL_STATUS_BAR_TRANSLUCENT}
            onRequestClose={onClose}
        >
            <View style={styles.timeModalOverlay}>
                <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onClose} />
                <View style={[styles.timeModalSheet, { backgroundColor: colors.cardBackground, paddingBottom }]}>
                    <View style={[styles.timeModalHandle, { backgroundColor: colors.border }]} />
                    <View style={styles.timeModalHeader}>
                        <Text style={[styles.timeModalTitle, { color: colors.textPrimary }]}>
                            {isStart ? 'Start Time' : 'End Time'}
                        </Text>
                        <View style={styles.timeModalActions}>
                            {mode === 'end' && hasEndTime && (
                                <TouchableOpacity
                                    onPress={onRemoveEndTime}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                    <Text style={{ fontSize: 15, color: colors.danger }}>Remove</Text>
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                                <Text style={{ fontSize: 15, fontWeight: '600', color: colors.accent }}>Done</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                    <View
                        style={[
                            styles.timePickerContainer,
                            {
                                backgroundColor: colors.inputBackground,
                                borderColor: colors.inputBorder,
                                marginHorizontal: 16,
                                marginBottom: 16,
                            },
                        ]}
                    >
                        <View pointerEvents="none" style={[styles.timePickerBand, { borderColor: colors.border }]} />
                        <View key={mode} style={styles.timePickerWheels}>
                            <WheelPicker
                                items={PICKER_HOURS}
                                selectedIndex={hourIdx}
                                onChange={onHour}
                                colors={colors}
                                width={60}
                                showIndicator={false}
                                visibleItems={TIME_PICKER_VISIBLE}
                            />
                            <View style={styles.timePickerColon}>
                                <Text style={[styles.timeColonText, { color: colors.textPrimary }]}>:</Text>
                            </View>
                            <WheelPicker
                                items={PICKER_MINUTES}
                                selectedIndex={minIdx}
                                onChange={onMin}
                                colors={colors}
                                width={60}
                                showIndicator={false}
                                visibleItems={TIME_PICKER_VISIBLE}
                            />
                            <View style={{ flex: 1 }} />
                            <WheelPicker
                                items={PICKER_AMPM}
                                selectedIndex={ampmIdx}
                                onChange={onAmPm}
                                colors={colors}
                                width={70}
                                showIndicator={false}
                                visibleItems={TIME_PICKER_VISIBLE}
                            />
                        </View>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    timeModalOverlay: { flex: 1, justifyContent: 'flex-end' },
    timeModalSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 12, paddingBottom: 32 },
    timeModalHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
    timeModalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        marginBottom: 16,
    },
    timeModalTitle: { fontSize: 17, fontWeight: '600' },
    timeModalActions: { flexDirection: 'row', alignItems: 'center', gap: 20 },
    timePickerContainer: { borderWidth: 1, borderRadius: 12, overflow: 'hidden', position: 'relative' },
    timePickerBand: {
        position: 'absolute',
        top: WHEEL_ITEM_H,
        left: 0,
        right: 0,
        height: WHEEL_ITEM_H,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    timePickerWheels: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
    timePickerColon: { height: WHEEL_ITEM_H * TIME_PICKER_VISIBLE, justifyContent: 'center', paddingHorizontal: 2 },
    timeColonText: { fontSize: 20, fontWeight: '700' },
});
