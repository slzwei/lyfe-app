/**
 * Paper attempts — full screen for one requirement.
 *
 * Pushed from `(tabs)/candidates/[candidateId]` when the user taps a row in
 * the Papers section. Reads the requirement code from a search param
 * (`?code=life_1`) so this single file handles all 4 requirements.
 *
 * Tapping "Add attempt" or an existing attempt card opens the single
 * PaperAttemptEditSheet Modal that slides up over this page.
 */
import LoadingState from '@/components/LoadingState';
import PaperAttemptEditSheet from '@/components/candidates/PaperAttemptEditSheet';
import ScreenHeader from '@/components/ScreenHeader';
import { useCandidateProgressionContext } from '@/contexts/CandidateProgressionContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useSheetAnimation } from '@/hooks/useSheetAnimation';
import { useTypedRouter } from '@/hooks/useTypedRouter';
import { deletePaperAttempt, upsertPaperAttempt } from '@/lib/recruitment';
import type { CandidatePaperAttempt, PaperCode, PaperRequirement, PaperRequirementCode } from '@/types/recruitment';
import type { ThemeColors } from '@/types/theme';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

function formatDateTime(iso: string | null): string {
    if (!iso) return '—';
    try {
        const d = new Date(iso);
        return d.toLocaleString('en-SG', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        });
    } catch {
        return iso;
    }
}

function formatCost(cost: number | null): string {
    if (cost === null || cost === undefined) return '';
    return `S$${Number(cost).toFixed(2)}`;
}

function resultMeta(result: CandidatePaperAttempt['result'], colors: ThemeColors) {
    switch (result) {
        case 'passed':
            return {
                label: 'Passed',
                color: colors.success,
                bg: colors.successLight,
                icon: 'checkmark-circle' as const,
            };
        case 'failed':
            return { label: 'Failed', color: colors.danger, bg: colors.dangerLight, icon: 'close-circle' as const };
        default:
            return {
                label: 'Scheduled',
                color: colors.warning,
                bg: colors.warningLight,
                icon: 'calendar-outline' as const,
            };
    }
}

function statusSummary(req: PaperRequirement): string {
    const n = req.attempts.length;
    const plural = n === 1 ? '' : 's';
    switch (req.status) {
        case 'passed':
            return `${n} attempt${plural} · Passed`;
        case 'failed':
            return `${n} attempt${plural} · Retake needed`;
        case 'scheduled':
            return `${n} attempt${plural} · Scheduled`;
        default:
            return 'No attempts yet';
    }
}

export default function PaperAttemptsScreen() {
    const { candidateId, code } = useLocalSearchParams<{ candidateId: string; code: string }>();
    const { colors } = useTheme();
    const { user } = useAuth();
    const router = useTypedRouter();

    const progression = useCandidateProgressionContext();
    const requirement = progression.paperRequirements.find((r) => r.code === (code as PaperRequirementCode));

    const [editing, setEditing] = useState<CandidatePaperAttempt | null>(null);
    const [isEditingNew, setIsEditingNew] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Sheet slide animation for the add/edit modal.
    const screenH = Dimensions.get('window').height;
    const sheetY = useSharedValue(screenH);
    const sheetVisible = useSheetAnimation(editing !== null || isEditingNew, sheetY);
    const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: sheetY.value }] }));

    const handleAdd = useCallback(() => {
        setEditing(null);
        setIsEditingNew(true);
        setError(null);
    }, []);

    const handleEdit = useCallback((a: CandidatePaperAttempt) => {
        setEditing(a);
        setIsEditingNew(false);
        setError(null);
    }, []);

    const handleDismiss = useCallback(() => {
        if (isSaving) return;
        setEditing(null);
        setIsEditingNew(false);
        setError(null);
    }, [isSaving]);

    const handleSave = useCallback(
        async (payload: {
            paperCode: PaperCode;
            examAt: Date | null;
            cost: number | null;
            result: 'passed' | 'failed' | null;
        }) => {
            if (!candidateId) return;
            setIsSaving(true);
            setError(null);
            const { error: writeErr } = await upsertPaperAttempt(
                candidateId,
                {
                    id: editing?.id,
                    paperCode: payload.paperCode,
                    examAt: payload.examAt ? payload.examAt.toISOString() : null,
                    cost: payload.cost,
                    result: payload.result,
                },
                user?.id,
            );
            if (writeErr) {
                setIsSaving(false);
                setError(writeErr);
                return;
            }
            await progression.refresh();
            setIsSaving(false);
            setEditing(null);
            setIsEditingNew(false);
        },
        [candidateId, editing, user?.id, progression],
    );

    const handleDelete = useCallback(async () => {
        if (!editing) return;
        setIsSaving(true);
        setError(null);
        const { error: delErr } = await deletePaperAttempt(editing.id);
        if (delErr) {
            setIsSaving(false);
            setError(delErr);
            return;
        }
        await progression.refresh();
        setIsSaving(false);
        setEditing(null);
        setIsEditingNew(false);
    }, [editing, progression]);

    if (!candidateId || !code) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
                <ScreenHeader showBack backLabel="Back" title="Paper" />
                <View style={styles.notFound}>
                    <Ionicons name="alert-circle-outline" size={48} color={colors.textTertiary} />
                    <Text style={[styles.notFoundText, { color: colors.textSecondary }]}>Missing parameters</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (progression.isLoading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
                <ScreenHeader showBack backLabel="Back" title="Loading…" />
                <LoadingState />
            </SafeAreaView>
        );
    }

    if (!requirement) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
                <ScreenHeader showBack backLabel="Back" title="Paper" />
                <View style={styles.notFound}>
                    <Ionicons name="alert-circle-outline" size={48} color={colors.textTertiary} />
                    <Text style={[styles.notFoundText, { color: colors.textSecondary }]}>Unknown paper code</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            <ScreenHeader showBack backLabel="Back" title={requirement.label} />

            <View style={styles.summaryRow}>
                <View style={[styles.iconWrap, { backgroundColor: colors.surfaceSecondary }]}>
                    <Ionicons name="book-outline" size={26} color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.summaryTitle, { color: colors.textPrimary }]}>{requirement.label}</Text>
                    <Text style={[styles.summarySub, { color: colors.textSecondary }]}>
                        {statusSummary(requirement)}
                    </Text>
                </View>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator>
                {requirement.attempts.length === 0 && (
                    <View style={styles.empty}>
                        <Ionicons name="document-text-outline" size={28} color={colors.textTertiary} />
                        <Text style={[styles.emptyText, { color: colors.textTertiary }]}>No attempts yet</Text>
                    </View>
                )}

                {requirement.attempts.map((a, idx) => {
                    const meta = resultMeta(a.result, colors);
                    const attemptNumber = requirement.attempts.length - idx;
                    const isPassed = a.result === 'passed';
                    return (
                        <TouchableOpacity
                            key={a.id}
                            style={[
                                styles.card,
                                {
                                    borderColor: isPassed ? colors.success + '4D' : colors.border,
                                    backgroundColor: colors.cardBackground,
                                },
                            ]}
                            onPress={() => handleEdit(a)}
                            activeOpacity={0.75}
                            testID={`paper-attempt-card-${a.id}`}
                        >
                            <View style={styles.cardHeader}>
                                <Ionicons name={meta.icon} size={18} color={meta.color} />
                                <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
                                    Attempt {attemptNumber} · {a.paper_code}
                                </Text>
                                <View style={[styles.pill, { backgroundColor: meta.bg }]}>
                                    <Text style={[styles.pillText, { color: meta.color }]}>{meta.label}</Text>
                                </View>
                            </View>
                            <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
                                {formatDateTime(a.exam_at)}
                                {a.cost != null ? `  ·  ${formatCost(a.cost)}` : ''}
                            </Text>
                        </TouchableOpacity>
                    );
                })}

                <TouchableOpacity
                    style={[styles.addBtn, { borderColor: colors.border }]}
                    onPress={handleAdd}
                    activeOpacity={0.8}
                    testID="paper-attempts-add"
                >
                    <Ionicons name="add" size={18} color={colors.accent} />
                    <Text style={[styles.addBtnText, { color: colors.accent }]}>Add attempt</Text>
                </TouchableOpacity>
            </ScrollView>

            <PaperAttemptEditSheet
                visible={sheetVisible}
                colors={colors}
                animatedStyle={sheetStyle}
                requirementLabel={requirement.label}
                acceptedPaperCodes={requirement.acceptedPaperCodes}
                editing={editing}
                isSaving={isSaving}
                error={error}
                onSave={handleSave}
                onDelete={editing ? handleDelete : undefined}
                onDismiss={handleDismiss}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    notFoundText: { fontSize: 16, fontWeight: '600' },

    summaryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 16,
    },
    iconWrap: {
        width: 48,
        height: 48,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    summaryTitle: { fontSize: 18, fontWeight: '700' },
    summarySub: { fontSize: 13, fontWeight: '500', marginTop: 2 },

    scrollContent: { paddingHorizontal: 16, paddingBottom: 40, gap: 10 },
    empty: { alignItems: 'center', paddingVertical: 48, gap: 8 },
    emptyText: { fontSize: 13, fontWeight: '500' },

    card: {
        borderWidth: 1,
        borderRadius: 14,
        padding: 14,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 6,
    },
    cardTitle: { flex: 1, fontSize: 14, fontWeight: '700' },
    cardMeta: { fontSize: 13, fontWeight: '500' },
    pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
    pillText: { fontSize: 11, fontWeight: '700' },

    addBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 14,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderRadius: 12,
        marginTop: 4,
    },
    addBtnText: { fontSize: 14, fontWeight: '700' },
});
