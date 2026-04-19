import type { ThemeColors } from '@/types/theme';
import type { ReassignableManager } from '@/lib/team';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface ReassignAgentSheetProps {
    visible: boolean;
    agentName: string;
    currentManagerName: string | null;
    managers: ReassignableManager[];
    loading: boolean;
    submitting: boolean;
    colors: ThemeColors;
    onSelect: (manager: ReassignableManager | null) => void;
    onClose: () => void;
}

function ReassignAgentSheet({
    visible,
    agentName,
    currentManagerName,
    managers,
    loading,
    submitting,
    colors,
    onSelect,
    onClose,
}: ReassignAgentSheetProps) {
    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <Pressable
                    style={StyleSheet.absoluteFill}
                    onPress={submitting ? undefined : onClose}
                    accessibilityRole="button"
                    accessibilityLabel="Close reassign sheet"
                />
                <View style={[styles.sheet, { backgroundColor: colors.cardBackground }]}>
                    <Text style={[styles.title, { color: colors.textPrimary }]}>Reassign Agent</Text>
                    <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                        {currentManagerName
                            ? `${agentName} is currently under ${currentManagerName}. Pick a new upline.`
                            : `${agentName} is unassigned. Pick an upline.`}
                    </Text>

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
                            <TouchableOpacity
                                style={[styles.row, { borderColor: colors.borderLight }]}
                                onPress={() => onSelect(null)}
                                disabled={submitting}
                                accessibilityRole="button"
                                accessibilityLabel="Leave unassigned"
                            >
                                <View style={[styles.avatar, { backgroundColor: colors.surfaceSecondary }]}>
                                    <Ionicons name="remove-circle-outline" size={20} color={colors.textTertiary} />
                                </View>
                                <View style={styles.rowBody}>
                                    <Text style={[styles.rowName, { color: colors.textPrimary }]}>Unassigned</Text>
                                    <Text style={[styles.rowMeta, { color: colors.textTertiary }]}>No upline</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                            </TouchableOpacity>
                            {managers.map((m) => (
                                <TouchableOpacity
                                    key={m.id}
                                    style={[styles.row, { borderColor: colors.borderLight }]}
                                    onPress={() => onSelect(m)}
                                    disabled={submitting}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Reassign to ${m.fullName}`}
                                >
                                    <View style={[styles.avatar, { backgroundColor: colors.accentLight }]}>
                                        <Text style={[styles.avatarText, { color: colors.accent }]}>
                                            {m.fullName.charAt(0).toUpperCase()}
                                        </Text>
                                    </View>
                                    <View style={styles.rowBody}>
                                        <Text style={[styles.rowName, { color: colors.textPrimary }]}>
                                            {m.fullName}
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
                </View>
            </View>
        </Modal>
    );
}

export default React.memo(ReassignAgentSheet);

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
    subtitle: { fontSize: 13, marginBottom: 20 },
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
