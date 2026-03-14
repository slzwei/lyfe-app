import { CASE_CLOSED_COLOR } from '@/components/events/roadshowShared';
import WheelPicker from '@/components/WheelPicker';
import { PICKER_HOURS, PICKER_MINUTES, PICKER_AMPM } from '@/constants/ui';
import { KAV_BEHAVIOR } from '@/constants/platform';
import type { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export interface AfycSheetProps {
    colors: typeof Colors.light;
    showAfycSheet: boolean;
    setShowAfycSheet: (v: boolean) => void;
    afycInput: string;
    setAfycInput: (v: string) => void;
    logHour: number;
    setLogHour: (v: number) => void;
    logMinuteIdx: number;
    setLogMinuteIdx: (v: number) => void;
    logAmPm: number;
    setLogAmPm: (v: number) => void;
    loggingActivity: boolean;
    handleLogCaseClosed: () => void;
}

function AfycSheetInner({
    colors,
    showAfycSheet,
    setShowAfycSheet,
    afycInput,
    setAfycInput,
    logHour,
    setLogHour,
    logMinuteIdx,
    setLogMinuteIdx,
    logAmPm,
    setLogAmPm,
    loggingActivity,
    handleLogCaseClosed,
}: AfycSheetProps) {
    return (
        <Modal
            visible={showAfycSheet}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={() => setShowAfycSheet(false)}
        >
            <SafeAreaView style={[styles.sheetContainer, { backgroundColor: colors.background }]}>
                <KeyboardAvoidingView style={{ flex: 1 }} behavior={KAV_BEHAVIOR}>
                    <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
                        <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>Log Case Closed</Text>
                        <TouchableOpacity
                            onPress={() => setShowAfycSheet(false)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <Ionicons name="close" size={24} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>
                    <View style={styles.sheetContent}>
                        <Text style={[styles.pledgeLabel, { color: colors.textSecondary, marginBottom: 6 }]}>
                            AFYC Amount ($)
                        </Text>
                        <TextInput
                            style={[
                                styles.inputSm,
                                {
                                    backgroundColor: colors.inputBackground,
                                    borderColor: colors.inputBorder,
                                    color: colors.textPrimary,
                                    fontSize: 22,
                                    fontWeight: '700',
                                },
                            ]}
                            placeholder="0"
                            placeholderTextColor={colors.textTertiary}
                            value={afycInput}
                            onChangeText={(v) => setAfycInput(v.replace(/[^0-9]/g, ''))}
                            keyboardType="number-pad"
                            autoFocus
                        />
                        <Text
                            style={[
                                styles.pledgeLabel,
                                { color: colors.textSecondary, marginTop: 20, marginBottom: 4 },
                            ]}
                        >
                            Time
                        </Text>
                        <View style={[styles.wheelRow, { marginBottom: 8 }]}>
                            <WheelPicker
                                items={PICKER_HOURS}
                                selectedIndex={logHour}
                                onChange={setLogHour}
                                colors={colors}
                                width={52}
                            />
                            <WheelPicker
                                items={PICKER_MINUTES}
                                selectedIndex={logMinuteIdx}
                                onChange={setLogMinuteIdx}
                                colors={colors}
                                width={52}
                            />
                            <WheelPicker
                                items={PICKER_AMPM}
                                selectedIndex={logAmPm}
                                onChange={setLogAmPm}
                                colors={colors}
                                width={60}
                            />
                        </View>
                        <TouchableOpacity
                            style={[
                                styles.checkinBtn,
                                {
                                    backgroundColor: CASE_CLOSED_COLOR,
                                    marginTop: 12,
                                    opacity: loggingActivity ? 0.6 : 1,
                                },
                            ]}
                            onPress={handleLogCaseClosed}
                            disabled={loggingActivity}
                        >
                            {loggingActivity ? (
                                <ActivityIndicator size="small" color={colors.textInverse} />
                            ) : (
                                <>
                                    <Ionicons name="checkmark" size={20} color={colors.textInverse} />
                                    <Text style={styles.checkinBtnText}>Log Case Closed</Text>
                                </>
                            )}
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={{ marginTop: 16, alignItems: 'center' }}
                            onPress={() => {
                                setAfycInput('0');
                                handleLogCaseClosed();
                            }}
                        >
                            <Text style={{ color: colors.textTertiary, fontSize: 14 }}>
                                Skip AFYC — log without amount
                            </Text>
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </Modal>
    );
}

export const AfycSheet = React.memo(AfycSheetInner);

const styles = StyleSheet.create({
    sheetContainer: { flex: 1 },
    sheetHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    sheetTitle: { fontSize: 17, fontWeight: '700' },
    sheetContent: { padding: 16, gap: 12 },
    inputSm: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
    pledgeLabel: { fontSize: 15, fontWeight: '500' },
    checkinBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderRadius: 14,
        paddingVertical: 15,
        minHeight: 52,
    },
    checkinBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
    wheelRow: { flexDirection: 'row', gap: 0, alignItems: 'center', justifyContent: 'center' },
});
