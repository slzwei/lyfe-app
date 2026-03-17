import { useTheme } from '@/contexts/ThemeContext';
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

            const { sound } = await Audio.Sound.createAsync({ uri: recordingUrl }, { shouldPlay: true }, (status) => {
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
        <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                {recordingUrl ? 'Call Recording' : 'Call Transcript'}
            </Text>

            {/* Audio Player */}
            {recordingUrl && (
                <View style={styles.playerRow}>
                    <TouchableOpacity
                        onPress={togglePlay}
                        disabled={isLoading}
                        style={[styles.playBtn, { backgroundColor: colors.accent }]}
                    >
                        <Ionicons
                            name={isLoading ? 'hourglass-outline' : isPlaying ? 'pause' : 'play'}
                            size={20}
                            color="#fff"
                        />
                    </TouchableOpacity>
                    <View style={styles.progressContainer}>
                        <View style={[styles.progressTrack, { backgroundColor: colors.borderLight }]}>
                            <View
                                style={[
                                    styles.progressFill,
                                    { backgroundColor: colors.accent, width: `${progress * 100}%` },
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
                        style={[styles.transcriptToggle, { borderTopColor: colors.borderLight }]}
                    >
                        <View style={styles.transcriptToggleInner}>
                            <Ionicons name="document-text-outline" size={16} color={colors.textTertiary} />
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
                        <View style={[styles.transcriptBody, { backgroundColor: colors.surfacePrimary }]}>
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
        borderRadius: 14,
        borderWidth: 0.5,
        padding: 16,
        marginBottom: 12,
    },
    sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 12 },
    playerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    playBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    progressContainer: { flex: 1 },
    progressTrack: {
        height: 4,
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 2,
    },
    timeRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 4,
    },
    timeText: { fontSize: 11 },
    transcriptToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 14,
        paddingTop: 14,
        borderTopWidth: 0.5,
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
        borderRadius: 8,
    },
    transcriptText: { fontSize: 13, lineHeight: 20 },
});
