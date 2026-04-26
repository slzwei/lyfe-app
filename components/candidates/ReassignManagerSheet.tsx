import { useSheetAnimation } from '@/hooks/useSheetAnimation';
import type { ThemeColors } from '@/types/theme';
import type { AssignableManager } from '@/lib/recruitment';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

interface Props {
    visible: boolean;
    candidateName: string;
    currentManagerName: string | null;
    managers: AssignableManager[];
    loading: boolean;
    submitting: boolean;
    error: string | null;
    colors: ThemeColors;
    onSelect: (manager: AssignableManager) => void;
    onClose: () => void;
}

function ReassignManagerSheet({
    visible,
    candidateName,
    currentManagerName,
    managers,
    loading,
    submitting,
    error,
    colors,
    onSelect,
    onClose,
}: Props) {
    const sheetY = useSharedValue(Dimensions.get('window').height);
    const modalVisible = useSheetAnimation(visible, sheetY);
    const animatedStyle = useAnimatedStyle(() => ({ transform: [{ translateY: sheetY.value }] }));

    return (
        <Modal visible={modalVisible} transparent animationType="none" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <Pressable
                    style={StyleSheet.absoluteFill}
                    onPress={submitting ? undefined : onClose}
                    accessibilityRole="button"
                    accessibilityLabel="Close reassign sheet"
                />
                <Animated.View style={[styles.sheet, { backgroundColor: colors.cardBackground }, animatedStyle]}>
                    <Text style={[styles.title, { color: colors.textPrimary }]}>Reassign Candidate</Text>
                    <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                        {currentManagerName
                            ? `${candidateName} is currently with ${currentManagerName}. Pick a new owner.`
                            : `${candidateName} has no owner. Pick a manager or director.`}
                    </Text>

                    {error ? <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text> : null}

                    {loading ? (
                        <View style={styles.centered}>
                            <ActivityIndicator color={colors.accent} />
                        </View>
                    ) : managers.length === 0 ? (
                        <Text style={[styles.empty, { color: colors.textTertiary }]}>
                            No active managers or directors available
                        </Text>
                    ) : (
                        <ScrollView style={styles.list} bounces={false}>
                            {managers.map((m) => (
                                <TouchableOpacity
                                    key={m.id}
                                    style={[styles.row, { borderColor: colors.borderLight }]}
                                    onPress={() => onSelect(m)}
                                    disabled={submitting}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Reassign to ${m.full_name}`}
                                >
                                    <View style={[styles.avatar, { backgroundColor: colors.accentLight }]}>
                                        <Text style={[styles.avatarText, { color: colors.accent }]}>
                                            {m.full_name.charAt(0).toUpperCase()}
                                        </Text>
                                    </View>
                                    <View style={styles.rowBody}>
                                        <Text style={[styles.rowName, { color: colors.textPrimary }]}>
                                            {m.full_name}
                                        </Text>
                                        <Text style={[styles.rowMeta, { color: colors.textTertiary }]}>
                                            {m.role === 'director' ? 'Director' : 'Manager'}
                                        </Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    )}

                    <TouchableOpacity
                        style={[styles.cancel, { borderColor: colors.borderLight }]}
                        onPress={onClose}
                        disabled={submitting}
                        accessibilityRole="button"
                        accessibilityLabel="Cancel"
                    >
                        <Text style={[styles.cancelText, { color: colors.textSecondary }]}>
                            {submitting ? 'Saving…' : 'Cancel'}
                        </Text>
                    </TouchableOpacity>
                </Animated.View>
            </View>
        </Modal>
    );
}

export default React.memo(ReassignManagerSheet);

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'flex-end',
    },
    sheet: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 24,
        paddingBottom: 40,
    },
    title: { fontSize: 17, fontWeight: '700', marginBottom: 4 },
    subtitle: { fontSize: 13, marginBottom: 16 },
    errorText: { fontSize: 13, marginBottom: 12 },
    centered: { paddingVertical: 36, alignItems: 'center' },
    empty: { fontSize: 14, textAlign: 'center', paddingVertical: 12 },
    list: { maxHeight: 360 },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        borderBottomWidth: 0.5,
    },
    avatar: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: { fontSize: 15, fontWeight: '700' },
    rowBody: { flex: 1, gap: 2 },
    rowName: { fontSize: 15, fontWeight: '600' },
    rowMeta: { fontSize: 12 },
    cancel: {
        marginTop: 16,
        paddingVertical: 12,
        borderRadius: 10,
        borderWidth: 0.5,
        alignItems: 'center',
    },
    cancelText: { fontSize: 15, fontWeight: '600' },
});
