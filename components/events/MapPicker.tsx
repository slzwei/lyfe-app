/**
 * MapPicker — reusable modal for pinning a precise location on a map.
 *
 * Used by the event create and detail screens to capture a venue's lat/lng.
 * The pin stays centred on the visible map region; users pan the map so
 * their desired location lines up under the pin. Tap "Confirm" and the
 * parent receives { latitude, longitude } via `onConfirm`.
 *
 * On mount, tries to jump to the user's current GPS position (with a
 * fallback to Singapore centre if no initial coords were provided and
 * location permission is denied / unavailable). The "Use Current Location"
 * button re-triggers the jump on demand.
 *
 * Renders via the Modal component so it can overlay any parent screen
 * without routing. Parent controls visibility via `visible`.
 */
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { type Region } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

// Singapore centre — used as a last-resort fallback when no initial coords
// and no current location. Roughly the geographic middle of the island.
const SINGAPORE_FALLBACK = { latitude: 1.3521, longitude: 103.8198 };
const DEFAULT_DELTA = 0.008; // ~800m viewport, wide enough to orient

export interface MapPickerProps {
    visible: boolean;
    /** If set, the map opens centred here and the pin starts at these coords. */
    initialLatitude?: number | null;
    initialLongitude?: number | null;
    /** Called when the user taps Confirm. Receives the coords under the pin. */
    onConfirm: (coords: { latitude: number; longitude: number }) => void;
    /** Called when the user taps Cancel or dismisses the modal. */
    onCancel: () => void;
}

export default function MapPicker({ visible, initialLatitude, initialLongitude, onConfirm, onCancel }: MapPickerProps) {
    const { colors } = useTheme();
    const mapRef = useRef<MapView | null>(null);

    // The pin coordinates == current map centre. We don't actually move the
    // pin view (it's visually fixed in the centre of the screen); we update
    // this state as the region changes so Confirm always reads the latest
    // centre without touching the MapView ref.
    const [pinCoords, setPinCoords] = useState<{ latitude: number; longitude: number }>(() => {
        if (initialLatitude != null && initialLongitude != null) {
            return { latitude: initialLatitude, longitude: initialLongitude };
        }
        return SINGAPORE_FALLBACK;
    });
    const [locating, setLocating] = useState(false);
    const [ready, setReady] = useState(false);

    // On open, if no initial coords were passed, try to jump to the user's
    // current location. Best-effort — falls back silently to Singapore.
    useEffect(() => {
        if (!visible) {
            setReady(false);
            return;
        }
        if (initialLatitude != null && initialLongitude != null) {
            setReady(true);
            return;
        }
        let cancelled = false;
        (async () => {
            setLocating(true);
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted' || cancelled) {
                    setReady(true);
                    return;
                }
                const fix = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                if (cancelled) return;
                const coords = { latitude: fix.coords.latitude, longitude: fix.coords.longitude };
                setPinCoords(coords);
                mapRef.current?.animateToRegion(
                    { ...coords, latitudeDelta: DEFAULT_DELTA, longitudeDelta: DEFAULT_DELTA },
                    300,
                );
            } catch {
                // Silent fallback — Singapore centre stays.
            } finally {
                if (!cancelled) {
                    setLocating(false);
                    setReady(true);
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [visible, initialLatitude, initialLongitude]);

    const handleRegionChange = useCallback((region: Region) => {
        setPinCoords({ latitude: region.latitude, longitude: region.longitude });
    }, []);

    const handleUseCurrentLocation = useCallback(async () => {
        setLocating(true);
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') return;
            const fix = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
            const coords = { latitude: fix.coords.latitude, longitude: fix.coords.longitude };
            setPinCoords(coords);
            mapRef.current?.animateToRegion(
                { ...coords, latitudeDelta: DEFAULT_DELTA, longitudeDelta: DEFAULT_DELTA },
                300,
            );
        } catch {
            // Swallow — user can still pan manually.
        } finally {
            setLocating(false);
        }
    }, []);

    const handleConfirm = useCallback(() => {
        onConfirm(pinCoords);
    }, [onConfirm, pinCoords]);

    const initialRegion: Region = {
        latitude: pinCoords.latitude,
        longitude: pinCoords.longitude,
        latitudeDelta: DEFAULT_DELTA,
        longitudeDelta: DEFAULT_DELTA,
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onCancel}>
            <SafeAreaView edges={['top', 'bottom']} style={[styles.container, { backgroundColor: colors.background }]}>
                {/* Header */}
                <View style={[styles.header, { borderBottomColor: colors.border }]}>
                    <Pressable onPress={onCancel} hitSlop={12} accessibilityRole="button" accessibilityLabel="Cancel">
                        <Text style={[styles.headerAction, { color: colors.textSecondary }]}>Cancel</Text>
                    </Pressable>
                    <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Pin Venue Location</Text>
                    <Pressable
                        onPress={handleConfirm}
                        hitSlop={12}
                        disabled={!ready}
                        accessibilityRole="button"
                        accessibilityLabel="Confirm location"
                    >
                        <Text
                            style={[
                                styles.headerAction,
                                { color: ready ? colors.accent : colors.textTertiary, fontWeight: '600' },
                            ]}
                        >
                            Confirm
                        </Text>
                    </Pressable>
                </View>

                {/* Map */}
                <View style={styles.mapWrapper}>
                    <MapView
                        ref={mapRef}
                        style={StyleSheet.absoluteFill}
                        initialRegion={initialRegion}
                        onRegionChangeComplete={handleRegionChange}
                        showsUserLocation
                        showsMyLocationButton={false}
                        toolbarEnabled={false}
                    />

                    {/* Fixed-centre pin (purely visual — the actual coordinate is the map centre) */}
                    <View style={styles.pinWrapper} pointerEvents="none">
                        <Ionicons name="location" size={40} color={colors.accent} />
                        {/* Small shadow dot directly under the pin tip */}
                        <View style={[styles.pinShadow, { backgroundColor: colors.textPrimary }]} />
                    </View>

                    {/* Use current location button — bottom-right */}
                    <Pressable
                        style={[
                            styles.currentLocationButton,
                            { backgroundColor: colors.cardBackground, shadowColor: colors.textPrimary },
                        ]}
                        onPress={handleUseCurrentLocation}
                        accessibilityRole="button"
                        accessibilityLabel="Use my current location"
                    >
                        {locating ? (
                            <ActivityIndicator size="small" color={colors.accent} />
                        ) : (
                            <Ionicons name="locate" size={22} color={colors.accent} />
                        )}
                    </Pressable>
                </View>

                {/* Readout of current pin coordinates */}
                <View style={[styles.readout, { backgroundColor: colors.cardBackground }]}>
                    <Text style={[styles.readoutLabel, { color: colors.textTertiary }]}>PIN LOCATION</Text>
                    <Text style={[styles.readoutValue, { color: colors.textPrimary }]}>
                        {pinCoords.latitude.toFixed(5)}, {pinCoords.longitude.toFixed(5)}
                    </Text>
                    <Text style={[styles.readoutHint, { color: colors.textTertiary }]}>
                        Drag the map so the pin sits on your venue, then tap Confirm.
                    </Text>
                </View>
            </SafeAreaView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    headerTitle: { fontSize: 17, fontWeight: '600' },
    headerAction: { fontSize: 16 },
    mapWrapper: { flex: 1 },
    pinWrapper: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
    },
    pinShadow: {
        width: 8,
        height: 3,
        borderRadius: 4,
        opacity: 0.2,
        marginTop: -4,
    },
    currentLocationButton: {
        position: 'absolute',
        bottom: 16,
        right: 16,
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 4,
    },
    readout: {
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(128,128,128,0.2)',
    },
    readoutLabel: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.8,
        marginBottom: 4,
    },
    readoutValue: {
        fontSize: 15,
        fontWeight: '500',
        fontVariant: ['tabular-nums'],
    },
    readoutHint: {
        fontSize: 12,
        marginTop: 4,
    },
});
