import { useTheme } from '@/contexts/ThemeContext';
import { shadow } from '@/constants/platform';
import { Ionicons } from '@expo/vector-icons';
// TODO: Migrate from expo-av to expo-audio when expo-audio is installed.
// expo-audio is the replacement API in SDK 52+ but is not yet in this project's
// dependencies. Install with `npx expo install expo-audio`, then replace
// Audio.Sound with useAudioPlayer() hook and update playback code accordingly.
import { Audio } from 'expo-av';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface RecordingCardProps {
    recordingUrl: string | null;
    transcript: string | null;
}

function formatTime(ms: number): string {
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
}

export default function RecordingCard({ recordingUrl, transcript }: RecordingCardProps) {
    const { colors } = useTheme();
    const soundRef = useRef<Audio.Sound | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [positionMs, setPositionMs] = useState(0);
    const [durationMs, setDurationMs] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [showTranscript, setShowTranscript] = useState(false);

    const progress = durationMs > 0 ? positionMs / durationMs : 0;

    const loadAndPlay = useCallback(async () => {
        try {
            setIsLoading(true);
            await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });

            if (soundRef.current) {
                const status = await soundRef.current.getStatusAsync();
                if (status.isLoaded) {
                    await soundRef.current.playAsync();
                    setIsPlaying(true);
                    setIsLoading(false);
                    return;
                }
            }

            const { sound } = await Audio.Sound.createAsync({ uri: recordingUrl! }, { shouldPlay: true }, (status) => {
                if (status.isLoaded) {
                    setPositionMs(status.positionMillis);
                    setDurationMs(status.durationMillis || 0);
                    if (status.didJustFinish) {
                        setIsPlaying(false);
                        setPositionMs(0);
                    }
                }
            });
            soundRef.current = sound;
            setIsPlaying(true);
        } catch (err) {
            if (__DEV__) console.error('Audio load error:', err);
        }
        setIsLoading(false);
    }, [recordingUrl]);

    const togglePlay = useCallback(async () => {
        if (!soundRef.current) {
            await loadAndPlay();
            return;
        }
        if (isPlaying) {
            await soundRef.current.pauseAsync();
            setIsPlaying(false);
        } else {
            await soundRef.current.playAsync();
            setIsPlaying(true);
        }
    }, [isPlaying, loadAndPlay]);

    useEffect(() => {
        return () => {
            soundRef.current?.unloadAsync();
        };
    }, []);

    return (
        <View style={[styles.card, { backgroundColor: colors.cardBackground }, shadow('sm')]}>
            {/* Header */}
            <View style={styles.cardHeader}>
                <View style={[styles.headerIcon, { backgroundColor: colors.accentLight }]}>
                    <Ionicons name="mic-outline" size={16} color={colors.accent} />
                </View>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                    {recordingUrl ? 'Call Recording' : 'Call Transcript'}
                </Text>
            </View>

            {/* Audio Player */}
            {recordingUrl && (
                <View style={[styles.playerContainer, { backgroundColor: colors.surfaceSecondary }]}>
                    <TouchableOpacity
                        onPress={togglePlay}
                        disabled={isLoading}
                        style={[styles.playBtn, { backgroundColor: colors.accent }]}
                        activeOpacity={0.8}
                        accessibilityRole="button"
                        accessibilityLabel={
                            isLoading ? 'Loading audio' : isPlaying ? 'Pause recording' : 'Play recording'
                        }
                    >
                        <Ionicons
                            name={isLoading ? 'hourglass-outline' : isPlaying ? 'pause' : 'play'}
                            size={18}
                            color="#fff"
                        />
                    </TouchableOpacity>
                    <View style={styles.progressSection}>
                        {/* Progress bar */}
                        <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
                            <View
                                style={[
                                    styles.progressFill,
                                    { backgroundColor: colors.accent, width: `${progress * 100}%` },
                                ]}
                            />
                            {/* Scrubber dot */}
                            <View
                                style={[
                                    styles.scrubberDot,
                                    { backgroundColor: colors.accent, left: `${progress * 100}%` },
                                ]}
                            />
                        </View>
                        <View style={styles.timeRow}>
                            <Text style={[styles.timeText, { color: colors.textTertiary }]}>
                                {formatTime(positionMs)}
                            </Text>
                            <Text style={[styles.timeText, { color: colors.textTertiary }]}>
                                {formatTime(durationMs)}
                            </Text>
                        </View>
                    </View>
                </View>
            )}

            {/* Transcript Toggle */}
            {transcript && (
                <>
                    <TouchableOpacity
                        onPress={() => setShowTranscript(!showTranscript)}
                        style={[styles.transcriptToggle, { borderTopColor: colors.border }]}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={showTranscript ? 'Hide transcript' : 'Show transcript'}
                    >
                        <View style={styles.transcriptToggleInner}>
                            <Ionicons name="document-text-outline" size={15} color={colors.textTertiary} />
                            <Text style={[styles.transcriptToggleText, { color: colors.textSecondary }]}>
                                Transcript
                            </Text>
                        </View>
                        <Ionicons
                            name={showTranscript ? 'chevron-up' : 'chevron-down'}
                            size={16}
                            color={colors.textTertiary}
                        />
                    </TouchableOpacity>
                    {showTranscript && (
                        <View style={[styles.transcriptBody, { backgroundColor: colors.surfaceSecondary }]}>
                            <Text style={[styles.transcriptText, { color: colors.textSecondary }]}>{transcript}</Text>
                        </View>
                    )}
                </>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        borderRadius: 16,
        padding: 16,
        overflow: 'hidden',
    },

    // ── Header ──
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 14,
    },
    headerIcon: {
        width: 30,
        height: 30,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sectionTitle: {
        fontSize: 15,
        fontWeight: '700',
    },

    // ── Player ──
    playerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderRadius: 12,
        padding: 12,
    },
    playBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
    },
    progressSection: { flex: 1 },
    progressTrack: {
        height: 5,
        borderRadius: 2.5,
        overflow: 'visible',
        position: 'relative',
    },
    progressFill: {
        height: '100%',
        borderRadius: 2.5,
    },
    scrubberDot: {
        position: 'absolute',
        top: -3.5,
        width: 12,
        height: 12,
        borderRadius: 6,
        marginLeft: -6,
    },
    timeRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 5,
    },
    timeText: { fontSize: 11, fontWeight: '500' },

    // ── Transcript ──
    transcriptToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 14,
        paddingTop: 14,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    transcriptToggleInner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    transcriptToggleText: { fontSize: 14, fontWeight: '500' },
    transcriptBody: {
        marginTop: 10,
        padding: 12,
        borderRadius: 10,
    },
    transcriptText: { fontSize: 13, lineHeight: 20 },
});
