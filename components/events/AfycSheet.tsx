import type { Colors } from '@/constants/Colors';
import { RoadshowBounds, RoadshowRadii, getRoadshowColors } from '@/constants/roadshow/tokens';
import { useTheme } from '@/contexts/ThemeContext';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface AfycSheetProps {
    colors: typeof Colors.light;
    showAfycSheet: boolean;
    setShowAfycSheet: (v: boolean) => void;
    afycInput: string;
    setAfycInput: (v: string) => void;
    // Time state preserved for handleLogCaseClosed, but picker UI is omitted per prototype
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
    loggingActivity,
    handleLogCaseClosed,
}: AfycSheetProps) {
    const { resolved } = useTheme();
    const stage = getRoadshowColors(resolved);
    const insets = useSafeAreaInsets();

    const [editing, setEditing] = useState(false);
    const inputRef = useRef<TextInput>(null);

    const amt = Number(afycInput) || 0;
    const isCustom = !RoadshowBounds.afycQuickPicks.includes(amt as (typeof RoadshowBounds.afycQuickPicks)[number]);

    useEffect(() => {
        if (editing) {
            const t = setTimeout(() => inputRef.current?.focus(), 50);
            return () => clearTimeout(t);
        }
    }, [editing]);

    const beginEdit = () => setEditing(true);
    const commitEdit = () => setEditing(false);

    return (
        <Modal
            visible={showAfycSheet}
            transparent
            animationType="fade"
            onRequestClose={() => {
                setEditing(false);
                setShowAfycSheet(false);
            }}
            statusBarTranslucent
        >
            <View style={styles.overlay}>
                <Pressable
                    style={StyleSheet.absoluteFillObject}
                    onPress={() => {
                        setEditing(false);
                        setShowAfycSheet(false);
                    }}
                    accessibilityLabel="Dismiss"
                />
                <View
                    style={[
                        styles.sheet,
                        {
                            backgroundColor: colors.cardBackground,
                            paddingBottom: insets.bottom + 24,
                            borderTopLeftRadius: RoadshowRadii.sheet,
                            borderTopRightRadius: RoadshowRadii.sheet,
                        },
                    ]}
                >
                    <View style={[styles.handle, { backgroundColor: colors.border }]} />

                    {/* Editorial title */}
                    <Text style={[styles.title, { color: colors.textPrimary }]}>
                        A <Text style={[styles.titleItalic, { color: stage.closes }]}>close</Text>. Nicely done.
                    </Text>
                    <Text style={[styles.subtitle, { color: colors.textTertiary }]}>
                        Capture AFYC. No validation — honour system. Tap the amount to key in your own.
                    </Text>

                    {/* Big tappable AFYC pill */}
                    <Pressable
                        onPress={() => !editing && beginEdit()}
                        style={[
                            styles.afycPill,
                            {
                                backgroundColor: colors.tintSage,
                                borderColor: editing ? stage.closes : 'transparent',
                            },
                        ]}
                        accessibilityLabel="Edit AFYC amount"
                    >
                        <View style={styles.afycHead}>
                            <Text style={[styles.eyebrow, { color: stage.closes }]}>AFYC</Text>
                            <Text style={[styles.afycHint, { color: stage.closes }]}>
                                · {editing ? 'editing' : 'tap to edit'}
                            </Text>
                        </View>

                        {editing ? (
                            <View style={styles.afycInputRow}>
                                <Text style={[styles.afycBig, { color: colors.textPrimary }]}>$</Text>
                                <TextInput
                                    ref={inputRef}
                                    value={afycInput}
                                    onChangeText={(v) => {
                                        const cleaned = v.replace(/[^0-9]/g, '');
                                        if (cleaned === '' || Number(cleaned) <= RoadshowBounds.afycMax) {
                                            setAfycInput(cleaned);
                                        }
                                    }}
                                    onBlur={commitEdit}
                                    onSubmitEditing={commitEdit}
                                    keyboardType="number-pad"
                                    inputMode="numeric"
                                    maxLength={7}
                                    placeholder="0"
                                    placeholderTextColor={colors.textTertiary}
                                    style={[styles.afycBig, styles.afycInput, { color: colors.textPrimary }]}
                                    selectionColor={stage.closes}
                                />
                            </View>
                        ) : (
                            <Text style={[styles.afycBig, { color: colors.textPrimary }]}>
                                $<Text style={styles.tabular}>{amt.toLocaleString()}</Text>
                            </Text>
                        )}

                        {!editing ? (
                            <Text style={[styles.afycFoot, { color: colors.textTertiary }]}>
                                {isCustom && amt > 0 ? 'custom amount' : ' '}
                            </Text>
                        ) : null}
                    </Pressable>

                    {/* Quick picks */}
                    <View style={styles.quickRow}>
                        {RoadshowBounds.afycQuickPicks.map((q) => {
                            const active = !editing && amt === q;
                            return (
                                <Pressable
                                    key={q}
                                    onPress={() => {
                                        setAfycInput(String(q));
                                        setEditing(false);
                                    }}
                                    style={[
                                        styles.quickPick,
                                        {
                                            backgroundColor: active ? colors.textPrimary : colors.surfaceElevated,
                                            borderColor: active ? colors.textPrimary : colors.border,
                                        },
                                    ]}
                                    accessibilityLabel={`Set AFYC to ${q}`}
                                >
                                    <Text
                                        style={[
                                            styles.quickPickText,
                                            {
                                                color: active ? colors.background : colors.textPrimary,
                                            },
                                        ]}
                                    >
                                        ${q.toLocaleString()}
                                    </Text>
                                </Pressable>
                            );
                        })}
                        <Pressable
                            onPress={beginEdit}
                            style={[
                                styles.customChip,
                                {
                                    backgroundColor: editing ? stage.closes : 'transparent',
                                    borderColor: stage.closes,
                                },
                            ]}
                            accessibilityLabel="Custom amount"
                        >
                            <Text style={[styles.customGlyph, { color: editing ? colors.background : stage.closes }]}>
                                ⌨
                            </Text>
                            <Text style={[styles.customLabel, { color: editing ? colors.background : stage.closes }]}>
                                custom…
                            </Text>
                        </Pressable>
                    </View>

                    {/* CTA */}
                    <Pressable
                        onPress={() => {
                            setEditing(false);
                            handleLogCaseClosed();
                        }}
                        disabled={loggingActivity}
                        style={({ pressed }) => [
                            styles.primaryBtn,
                            {
                                backgroundColor: pressed ? colors.success : stage.closes,
                                opacity: loggingActivity ? 0.6 : 1,
                                borderRadius: RoadshowRadii.card,
                            },
                        ]}
                        accessibilityLabel="Log case closed"
                    >
                        {loggingActivity ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                            <>
                                <Text style={styles.primaryBtnText}>Log the close</Text>
                                <Text style={styles.primaryBtnGlyph}>✦</Text>
                            </>
                        )}
                    </Pressable>
                </View>
            </View>
        </Modal>
    );
}

export const AfycSheet = React.memo(AfycSheetInner);

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'flex-end',
    },
    sheet: {
        paddingHorizontal: 20,
        paddingTop: 14,
        gap: 14,
        shadowColor: '#000',
        shadowOpacity: 0.25,
        shadowRadius: 40,
        shadowOffset: { width: 0, height: -10 },
        elevation: 24,
    },
    handle: {
        width: 40,
        height: 4,
        borderRadius: 3,
        alignSelf: 'center',
    },

    title: {
        fontSize: 22,
        fontFamily: 'Fraunces',
        fontWeight: '500',
        letterSpacing: -0.4,
        lineHeight: 26,
    },
    titleItalic: { fontFamily: 'Fraunces-Italic', fontWeight: '500' },
    subtitle: {
        fontSize: 12.5,
        fontFamily: 'Inter',
        lineHeight: 18,
    },

    afycPill: {
        borderRadius: 14,
        paddingVertical: 18,
        paddingHorizontal: 14,
        alignItems: 'center',
        borderWidth: 2,
        gap: 4,
    },
    afycHead: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 6,
    },
    eyebrow: {
        fontSize: 10.5,
        fontFamily: 'Inter-SemiBold',
        letterSpacing: 1.2,
        textTransform: 'uppercase',
    },
    afycHint: {
        fontSize: 10.5,
        fontFamily: 'Fraunces-Italic',
        opacity: 0.75,
    },
    afycInputRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'center',
    },
    afycBig: {
        fontSize: 44,
        fontFamily: 'Fraunces',
        fontWeight: '500',
        letterSpacing: -1.4,
        lineHeight: 46,
    },
    afycInput: {
        minWidth: 40,
        textAlign: 'center',
        padding: 0,
        margin: 0,
    },
    afycFoot: {
        fontSize: 10.5,
        fontFamily: 'Inter',
    },
    tabular: { fontVariant: ['tabular-nums'] },

    quickRow: {
        flexDirection: 'row',
        gap: 6,
        flexWrap: 'wrap',
        alignItems: 'center',
    },
    quickPick: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 16,
        borderWidth: 1,
    },
    quickPickText: {
        fontSize: 12,
        fontFamily: 'Inter-SemiBold',
    },
    customChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 16,
        borderWidth: 1,
        borderStyle: 'dashed',
    },
    customGlyph: { fontSize: 14, lineHeight: 14 },
    customLabel: { fontSize: 12, fontFamily: 'Fraunces-Italic' },

    primaryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        minHeight: 52,
    },
    primaryBtnText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontFamily: 'Fraunces',
        fontWeight: '500',
        letterSpacing: -0.2,
    },
    primaryBtnGlyph: {
        color: '#FFFFFF',
        fontSize: 16,
        fontFamily: 'Fraunces-Italic',
        opacity: 0.85,
    },
});
