import LoadingState from '@/components/LoadingState';
import CandidateProgressView from '@/components/roadmap/CandidateProgressView';
import ScreenHeader from '@/components/ScreenHeader';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { fetchCandidate } from '@/lib/recruitment';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function CandidateProgressScreen() {
    const { candidateId } = useLocalSearchParams<{ candidateId: string }>();
    const { colors } = useTheme();
    const { user } = useAuth();
    const router = useRouter();

    const [candidateName, setCandidateName] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

    const role = user?.role ?? '';
    const canMarkComplete =
        role === 'admin' || role === 'pa' || role === 'ro' || role === 'manager' || role === 'director';

    const loadName = useCallback(async () => {
        if (!candidateId) return;
        const { data } = await fetchCandidate(candidateId);
        if (!data) {
            setNotFound(true);
        } else {
            setCandidateName(data.name);
        }
        setIsLoading(false);
    }, [candidateId]);

    useEffect(() => {
        loadName();
    }, [loadName]);

    if (isLoading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
                <ScreenHeader showBack backLabel="Profile" title="Development Roadmap" />
                <LoadingState />
            </SafeAreaView>
        );
    }

    if (notFound || !candidateId) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
                <ScreenHeader showBack backLabel="Profile" title="Development Roadmap" />
                <View style={styles.notFound}>
                    <Ionicons name="alert-circle-outline" size={48} color={colors.textTertiary} />
                    <Text style={[styles.notFoundText, { color: colors.textSecondary }]}>Candidate not found</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            <ScreenHeader showBack backLabel="Profile" title={`${candidateName}'s Roadmap`} />

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                <CandidateProgressView
                    candidateId={candidateId}
                    candidateName={candidateName}
                    reviewerId={user?.id ?? ''}
                    canMarkComplete={canMarkComplete}
                    colors={colors}
                    expanded
                    hideHeader
                />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollView: { flex: 1 },
    scrollContent: {
        padding: 16,
        paddingBottom: 40,
    },
    notFound: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: 32,
    },
    notFoundText: {
        fontSize: 15,
        textAlign: 'center',
    },
});
