import type { ThemeColors } from '@/types/theme';
import type { CandidateOutcome } from '@/types/recruitment';
import { useBottomSheetSafeBottom } from '@/hooks/useBottomSheetSafeBottom';
import { formatSgPhone } from '@/lib/phone';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { KeyboardAvoidingView, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { KAV_BEHAVIOR, letterSpacing } from '@/constants/platform';
import type { AnimatedStyle } from 'react-native-reanimated';
import type { ViewStyle } from 'react-native';

interface ContactOutcomeSheetProps {
    visible: boolean;
    colors: ThemeColors;
    animatedStyle: AnimatedStyle<ViewStyle>;
    pendingType: 'call' | 'whatsapp' | null;
    confirmStep: 'outcome' | 'note';
    selectedOutcome: CandidateOutcome | null;
    noteText: string;
    candidateName: string;
    candidatePhone: string;
    onNoteTextChange: (text: string) => void;
    onOutcomeSelect: (outcome: CandidateOutcome) => void;
    onSaveActivity: (skipNote: boolean) => void;
    onDismiss: () => void;
}

export default function ContactOutcomeSheet({
    visible,
    colors,
    animatedStyle,
    pendingType,
    confirmStep,
    selectedOutcome,
    noteText,
    candidateName,
    candidatePhone,
    onNoteTextChange,
    onOutcomeSelect,
    onSaveActivity,
    onDismiss,
}: ContactOutcomeSheetProps) {
    const paddingBottom = useBottomSheetSafeBottom(40);
    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            onRequestClose={confirmStep === 'outcome' ? onDismiss : () => onSaveActivity(true)}
        >
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={KAV_BEHAVIOR}>
                <TouchableOpacity
                    style={sheetStyles.overlay}
                    activeOpacity={1}
                    onPress={confirmStep === 'outcome' ? onDismiss : () => onSaveActivity(true)}
                >
                    <Animated.View
                        style={[
                            sheetStyles.sheet,
                            { backgroundColor: colors.cardBackground, paddingBottom },
                            animatedStyle,
                        ]}
                        onStartShouldSetResponder={() => true}
                    >
                        {/* Drag handle */}
                        <View style={[sheetStyles.handle, { backgroundColor: colors.border }]} />

                        {confirmStep === 'outcome' ? (
                            /* Step 1: Outcome selection */
                            <>
                                <View
                                    style={[
                                        sheetStyles.iconWrap,
                                        {
                                            backgroundColor: colors.successLight,
                                        },
                                    ]}
                                >
                                    <Ionicons
                                        name={pendingType === 'whatsapp' ? 'logo-whatsapp' : 'call'}
                                        size={30}
                                        color={pendingType === 'whatsapp' ? '#25D366' : colors.success}
                                    />
                                </View>

                                <Text style={[sheetStyles.title, { color: colors.textPrimary }]}>
                                    {pendingType === 'whatsapp' ? 'Did you message them?' : 'How did the call go?'}
                                </Text>
                                <Text style={[sheetStyles.subtitle, { color: colors.textSecondary }]}>
                                    {candidateName} · {formatSgPhone(candidatePhone)}
                                </Text>

                                {pendingType === 'call' ? (
                                    <>
                                        <TouchableOpacity
                                            style={[sheetStyles.primaryBtn, { backgroundColor: colors.accent }]}
                                            onPress={() => onOutcomeSelect('reached')}
                                            activeOpacity={0.85}
                                        >
                                            <Ionicons
                                                name="checkmark-circle-outline"
                                                size={20}
                                                color={colors.textInverse}
                                            />
                                            <Text style={[sheetStyles.primaryBtnText, { color: colors.textInverse }]}>
                                                Connected
                                            </Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[
                                                sheetStyles.secondaryBtn,
                                                {
                                                    borderColor: colors.border,
                                                    backgroundColor: colors.surfacePrimary,
                                                },
                                            ]}
                                            onPress={() => onOutcomeSelect('no_answer')}
                                            activeOpacity={0.85}
                                        >
                                            <Ionicons
                                                name="close-circle-outline"
                                                size={20}
                                                color={colors.textSecondary}
                                            />
                                            <Text
                                                style={[sheetStyles.secondaryBtnText, { color: colors.textSecondary }]}
                                            >
                                                No answer
                                            </Text>
                                        </TouchableOpacity>
                                    </>
                                ) : (
                                    <TouchableOpacity
                                        style={[sheetStyles.primaryBtn, { backgroundColor: '#25D366' }]}
                                        onPress={() => onOutcomeSelect('sent')}
                                        activeOpacity={0.85}
                                    >
                                        <Ionicons
                                            name="checkmark-circle-outline"
                                            size={20}
                                            color={colors.textInverse}
                                        />
                                        <Text style={[sheetStyles.primaryBtnText, { color: colors.textInverse }]}>
                                            Yes, sent
                                        </Text>
                                    </TouchableOpacity>
                                )}

                                <TouchableOpacity
                                    onPress={onDismiss}
                                    style={sheetStyles.skipRow}
                                    hitSlop={{ top: 12, bottom: 12, left: 24, right: 24 }}
                                >
                                    <Text style={[sheetStyles.skipText, { color: colors.textTertiary }]}>
                                        Don't log this
                                    </Text>
                                </TouchableOpacity>
                            </>
                        ) : (
                            /* Step 2: Optional note */
                            <>
                                {/* Outcome recap pill */}
                                <View
                                    style={[
                                        sheetStyles.outcomePill,
                                        {
                                            backgroundColor:
                                                selectedOutcome === 'no_answer'
                                                    ? colors.surfacePrimary
                                                    : colors.successLight,
                                        },
                                    ]}
                                >
                                    <Ionicons
                                        name={selectedOutcome === 'no_answer' ? 'close-circle' : 'checkmark-circle'}
                                        size={14}
                                        color={selectedOutcome === 'no_answer' ? colors.textTertiary : colors.success}
                                    />
                                    <Text
                                        style={[
                                            sheetStyles.outcomePillText,
                                            {
                                                color:
                                                    selectedOutcome === 'no_answer'
                                                        ? colors.textSecondary
                                                        : colors.success,
                                            },
                                        ]}
                                    >
                                        {selectedOutcome === 'reached'
                                            ? 'Connected'
                                            : selectedOutcome === 'no_answer'
                                              ? 'No answer'
                                              : 'Sent'}
                                    </Text>
                                </View>

                                <Text style={[sheetStyles.noteLabel, { color: colors.textPrimary }]}>
                                    Add a note{'  '}
                                    <Text style={[sheetStyles.noteLabelOptional, { color: colors.textTertiary }]}>
                                        optional
                                    </Text>
                                </Text>

                                <TextInput
                                    style={[
                                        sheetStyles.noteInput,
                                        {
                                            color: colors.textPrimary,
                                            backgroundColor: colors.surfacePrimary,
                                        },
                                    ]}
                                    placeholder="e.g. Very interested, wants to start soon..."
                                    placeholderTextColor={colors.textTertiary}
                                    value={noteText}
                                    onChangeText={onNoteTextChange}
                                    multiline
                                    numberOfLines={3}
                                    textAlignVertical="top"
                                    autoFocus
                                />

                                <TouchableOpacity
                                    style={[sheetStyles.primaryBtn, { backgroundColor: colors.accent }]}
                                    onPress={() => onSaveActivity(false)}
                                    activeOpacity={0.85}
                                >
                                    <Ionicons name="checkmark" size={18} color={colors.textInverse} />
                                    <Text style={[sheetStyles.primaryBtnText, { color: colors.textInverse }]}>
                                        Save & Log
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={() => onSaveActivity(true)}
                                    style={sheetStyles.skipRow}
                                    hitSlop={{ top: 12, bottom: 12, left: 24, right: 24 }}
                                >
                                    <Text style={[sheetStyles.skipText, { color: colors.textTertiary }]}>
                                        Skip note
                                    </Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </Animated.View>
                </TouchableOpacity>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const sheetStyles = StyleSheet.create({
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
    },
    handle: {
        width: 36,
        height: 4,
        borderRadius: 2,
        marginBottom: 24,
    },
    iconWrap: {
        width: 60,
        height: 60,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 19,
        fontWeight: '700',
        textAlign: 'center',
        letterSpacing: letterSpacing(-0.3),
        marginBottom: 6,
    },
    subtitle: {
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 28,
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
    secondaryBtn: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 15,
        borderRadius: 14,
        borderWidth: 1,
        marginBottom: 10,
        minHeight: 52,
    },
    secondaryBtnText: { fontSize: 16, fontWeight: '600' },
    skipRow: { paddingVertical: 8, marginTop: 4 },
    skipText: { fontSize: 14, fontWeight: '500' },
    outcomePill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        alignSelf: 'flex-start',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 20,
        marginBottom: 20,
    },
    outcomePillText: { fontSize: 13, fontWeight: '600' },
    noteLabel: {
        alignSelf: 'flex-start',
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 10,
    },
    noteLabelOptional: { fontSize: 13, fontWeight: '400' },
    noteInput: {
        width: '100%',
        borderRadius: 12,
        padding: 14,
        fontSize: 15,
        minHeight: 90,
        marginBottom: 16,
        lineHeight: 22,
    },
});
