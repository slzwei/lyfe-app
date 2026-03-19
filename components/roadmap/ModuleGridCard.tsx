import React from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import type { RoadmapModuleWithProgress, NodeState, ModuleItemType } from '@/types/roadmap';
import { MODULE_TYPE_CONFIG, MODULE_TYPE_COLOR_KEY, MODULE_ITEM_TYPE_CONFIG } from '@/types/roadmap';
import { displayWeight, letterSpacing } from '@/constants/platform';
import type { ThemeColors } from '@/types/theme';

const SCREEN_W = Dimensions.get('window').width;
const CARD_GAP = 12;
const HORIZONTAL_PAD = 16;
const CARD_W = (SCREEN_W - HORIZONTAL_PAD * 2 - CARD_GAP) / 2;

interface Props {
    module: RoadmapModuleWithProgress;
    state: NodeState;
    colors: ThemeColors;
    onPress: (moduleId: string) => void;
}

function ModuleGridCard({ module, state, colors, onPress }: Props) {
    const scale = useSharedValue(1);
    const typeConfig = MODULE_TYPE_CONFIG[module.module_type];
    const typeColor = colors[MODULE_TYPE_COLOR_KEY[module.module_type]];
    const isLocked = state === 'locked';
    const isCompleted = state === 'completed';
    const isCurrent = state === 'current';

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const handlePressIn = () => {
        if (!isLocked) scale.value = withSpring(0.97, { damping: 15, stiffness: 400 });
    };
    const handlePressOut = () => {
        scale.value = withSpring(1, { damping: 15, stiffness: 400 });
    };

    // Card background and border
    const cardBg = isCompleted ? colors.success + '08' : isCurrent ? colors.accent + '06' : colors.surfacePrimary;

    const leftBorderColor = isCompleted ? colors.success : isCurrent ? colors.accent : 'transparent';

    // Item summary
    const summary = module.itemSummary;
    const hasItems = summary && summary.total > 0;
    const progressFraction = hasItems ? summary.completed / summary.total : 0;

    return (
        <Animated.View style={[animatedStyle, { width: CARD_W }]}>
            <Pressable
                onPress={() => !isLocked && onPress(module.id)}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                disabled={isLocked}
                style={[
                    styles.card,
                    {
                        backgroundColor: cardBg,
                        borderColor: colors.border,
                        borderLeftColor: leftBorderColor,
                        borderLeftWidth: isCompleted || isCurrent ? 3 : StyleSheet.hairlineWidth,
                        opacity: isLocked ? 0.45 : 1,
                    },
                ]}
                accessibilityLabel={`${module.title}, ${state}`}
                accessibilityHint={isLocked ? 'Module is locked' : 'Opens module details'}
            >
                {/* Type badge row */}
                <View style={styles.typeRow}>
                    <View style={[styles.typeIconCircle, { backgroundColor: typeColor + '14' }]}>
                        <Ionicons name={typeConfig.icon} size={14} color={typeColor} />
                    </View>
                    <Text style={[styles.typeLabel, { color: typeColor }]} numberOfLines={1}>
                        {typeConfig.label}
                    </Text>

                    {/* State overlay icons */}
                    {isCompleted && (
                        <Ionicons name="checkmark-circle" size={16} color={colors.success} style={styles.stateIcon} />
                    )}
                    {isLocked && (
                        <Ionicons name="lock-closed" size={14} color={colors.textTertiary} style={styles.stateIcon} />
                    )}
                </View>

                {/* Module title */}
                <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={2}>
                    {module.title}
                </Text>

                {/* Item type icons row */}
                {hasItems && (
                    <View style={styles.itemTypesRow}>
                        {summary.itemTypes.map((type: ModuleItemType) => {
                            const cfg = MODULE_ITEM_TYPE_CONFIG[type];
                            return <Ionicons key={type} name={cfg.icon} size={13} color={cfg.color} />;
                        })}
                    </View>
                )}

                {/* Progress bar + count */}
                {hasItems && (
                    <View style={styles.progressRow}>
                        <View
                            style={[styles.progressTrack, { backgroundColor: colors.border + '40' }]}
                            accessibilityRole="progressbar"
                            accessibilityValue={{ min: 0, max: summary.total, now: summary.completed }}
                        >
                            <View
                                style={[
                                    styles.progressFill,
                                    {
                                        backgroundColor: colors.accent,
                                        width: `${Math.round(progressFraction * 100)}%`,
                                    },
                                ]}
                            />
                        </View>
                        <Text style={[styles.progressCount, { color: colors.textTertiary }]}>
                            {summary.completed}/{summary.total}
                        </Text>
                    </View>
                )}
            </Pressable>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    card: {
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 14,
        padding: 14,
        minHeight: 140,
        justifyContent: 'space-between',
        gap: 8,
    },
    typeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    typeIconCircle: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    typeLabel: {
        fontSize: 11,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.3,
        flex: 1,
    },
    stateIcon: {
        marginLeft: 'auto',
    },
    title: {
        fontSize: 15,
        fontWeight: displayWeight('700'),
        letterSpacing: letterSpacing(-0.2),
        lineHeight: 20,
    },
    itemTypesRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    progressRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    progressTrack: {
        flex: 1,
        height: 4,
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 2,
    },
    progressCount: {
        fontSize: 11,
        fontWeight: '500',
    },
});

export default React.memo(ModuleGridCard);
