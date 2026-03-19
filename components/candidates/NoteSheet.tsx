import { letterSpacing } from '@/constants/platform';
import { KAV_BEHAVIOR } from '@/constants/platform';
import type { ThemeColors } from '@/types/theme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
    KeyboardAvoidingView,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    type ViewStyle,
} from 'react-native';
import Animated, { type AnimatedStyle } from 'react-native-reanimated';

interface Props {
    visible: boolean;
    noteText: string;
    colors: ThemeColors;
    animatedStyle: AnimatedStyle;
    onNoteTextChange: (text: string) => void;
    onSave: () => void;
    onClose: () => void;
}

function NoteSheet({ visible, noteText, colors, animatedStyle, onNoteTextChange, onSave, onClose }: Props) {
    return (
        <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={KAV_BEHAVIOR}>
                <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
                    <Animated.View
                        style={[
                            styles.sheet,
                            { backgroundColor: colors.cardBackground },
                            animatedStyle as unknown as ViewStyle,
                        ]}
                        onStartShouldSetResponder={() => true}
                    >
                        <View style={[styles.handle, { backgroundColor: colors.border }]} />
                        <View style={[styles.iconWrap, { backgroundColor: colors.surfacePrimary }]}>
                            <Ionicons name="create-outline" size={28} color={colors.textSecondary} />
                        </View>
                        <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>Add Note</Text>
                        <TextInput
                            style={[
                                styles.noteInput,
                                { color: colors.textPrimary, backgroundColor: colors.surfacePrimary },
                            ]}
                            placeholder="What happened? Any follow-up actions?"
                            placeholderTextColor={colors.textTertiary}
                            value={noteText}
                            onChangeText={onNoteTextChange}
                            multiline
                            numberOfLines={4}
                            textAlignVertical="top"
                            autoFocus
                        />
                        <TouchableOpacity
                            style={[
                                styles.primaryBtn,
                                { backgroundColor: colors.accent, opacity: noteText.trim() ? 1 : 0.4 },
                            ]}
                            onPress={onSave}
                            activeOpacity={0.85}
                            disabled={!noteText.trim()}
                        >
                            <Ionicons name="checkmark" size={18} color={colors.textInverse} />
                            <Text style={[styles.primaryBtnText, { color: colors.textInverse }]}>Save Note</Text>
                        </TouchableOpacity>
                    </Animated.View>
                </TouchableOpacity>
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
    },
    handle: {
        width: 36,
        height: 4,
        borderRadius: 2,
        marginBottom: 24,
    },
    iconWrap: {
        width: 52,
        height: 52,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    sheetTitle: {
        fontSize: 18,
        fontWeight: '700',
        textAlign: 'center',
        letterSpacing: letterSpacing(-0.3),
        marginBottom: 20,
    },
    noteInput: {
        width: '100%',
        borderRadius: 12,
        padding: 14,
        fontSize: 15,
        minHeight: 90,
        marginBottom: 16,
        lineHeight: 22,
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

export default React.memo(NoteSheet);
