import { Fonts } from '@/constants/type';
import type { ProgrammeWithModules } from '@/types/roadmap';
import type { ThemeColors } from '@/types/theme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Props {
    programme: ProgrammeWithModules;
    colors: ThemeColors;
    onPress: () => void;
}

function RoadmapProgressCard({ programme, colors, onPress }: Props) {
    return (
        <TouchableOpacity
            style={[styles.card, { backgroundColor: colors.cardBackground, shadowColor: colors.textPrimary }]}
            onPress={onPress}
            activeOpacity={0.7}
        >
            <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Roadmap Progress</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
            </View>
            <Text style={[styles.progName, { color: colors.textSecondary }]}>{programme.title}</Text>
            <View style={styles.progressBarTrack}>
                <View
                    style={[
                        styles.progressBarFill,
                        {
                            backgroundColor: colors.accent,
                            width: `${Math.max(programme.percentage, 2)}%`,
                        },
                    ]}
                />
            </View>
            <Text style={[styles.progressLabel, { color: colors.textTertiary }]}>
                {programme.completedCount} of {programme.totalCount} modules completed
            </Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    card: {
        marginHorizontal: 16,
        marginBottom: 20,
        borderRadius: 20,
        padding: 20,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 12,
        elevation: 2,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    sectionTitle: { fontFamily: Fonts.serif, fontSize: 18, fontWeight: '500', marginBottom: 0 },
    progName: {
        fontFamily: Fonts.serif,
        fontSize: 14,
        fontWeight: '500',
        marginBottom: 10,
    },
    progressBarTrack: {
        height: 8,
        borderRadius: 4,
        backgroundColor: 'rgba(0,0,0,0.06)',
        overflow: 'hidden',
        marginBottom: 8,
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 4,
    },
    progressLabel: {
        fontFamily: Fonts.sans,
        fontSize: 13,
    },
});

export default React.memo(RoadmapProgressCard);
