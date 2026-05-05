import type { ThemeColors } from '@/types/theme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Agent {
    id: string;
    full_name: string;
}

interface ReassignModalProps {
    visible: boolean;
    leadName: string;
    agents: Agent[];
    colors: ThemeColors;
    onSelect: (agent: Agent) => void;
    onClose: () => void;
}

function ReassignModal({ visible, leadName, agents, colors, onSelect, onClose }: ReassignModalProps) {
    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <TouchableOpacity
                style={styles.modalOverlay}
                activeOpacity={1}
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close reassign modal"
            >
                <View
                    style={[styles.reassignSheet, { backgroundColor: colors.cardBackground }]}
                    onStartShouldSetResponder={() => true}
                >
                    <Text style={[styles.reassignTitle, { color: colors.textPrimary }]}>Reassign Lead</Text>
                    <Text style={[styles.reassignSubtitle, { color: colors.textSecondary }]}>
                        Select an agent to reassign {leadName} to
                    </Text>
                    {agents.length === 0 ? (
                        <Text style={[styles.reassignEmpty, { color: colors.textTertiary }]}>No agents available</Text>
                    ) : (
                        <ScrollView style={styles.agentList} bounces={false}>
                            {agents.map((agent) => (
                                <TouchableOpacity
                                    key={agent.id}
                                    testID={`lead-reassign-option-${agent.id}`}
                                    style={[styles.agentRow, { borderColor: colors.borderLight }]}
                                    onPress={() => onSelect(agent)}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Reassign to ${agent.full_name}`}
                                >
                                    <View style={[styles.agentAvatar, { backgroundColor: colors.accentLight }]}>
                                        <Text style={[styles.agentAvatarText, { color: colors.accent }]}>
                                            {agent.full_name.charAt(0).toUpperCase()}
                                        </Text>
                                    </View>
                                    <Text style={[styles.agentName, { color: colors.textPrimary }]}>
                                        {agent.full_name}
                                    </Text>
                                    <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    )}
                    <TouchableOpacity
                        style={[styles.reassignCancel, { borderColor: colors.borderLight }]}
                        onPress={onClose}
                        accessibilityRole="button"
                        accessibilityLabel="Cancel"
                    >
                        <Text style={[styles.reassignCancelText, { color: colors.textSecondary }]}>Cancel</Text>
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        </Modal>
    );
}

export default React.memo(ReassignModal);

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'flex-end',
    },
    reassignSheet: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 24,
        paddingBottom: 40,
        gap: 0,
    },
    reassignTitle: { fontSize: 17, fontWeight: '700', marginBottom: 4 },
    reassignSubtitle: { fontSize: 13, marginBottom: 20 },
    reassignEmpty: { fontSize: 14, textAlign: 'center', paddingVertical: 12 },
    agentList: { maxHeight: 300 },
    agentRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        borderBottomWidth: 0.5,
    },
    agentAvatar: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    agentAvatarText: { fontSize: 15, fontWeight: '700' },
    agentName: { flex: 1, fontSize: 15, fontWeight: '600' },
    reassignCancel: {
        marginTop: 16,
        paddingVertical: 12,
        borderRadius: 10,
        borderWidth: 0.5,
        alignItems: 'center',
    },
    reassignCancelText: { fontSize: 15, fontWeight: '600' },
});
