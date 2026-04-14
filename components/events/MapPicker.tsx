/**
 * MapPicker — reusable modal for pinning a precise location on a map.
 *
 * Primary flow: users type into the search field which powers Google Places
 * Autocomplete, pick a suggestion from the dropdown, and the map jumps to
 * that place with the pin dropped there. Pan the map to fine-tune if the
 * Places result is slightly off, then Confirm to return the coordinates
 * and the place name to the parent.
 *
 * Used by the event create and detail screens to capture a venue's lat/lng.
 * The pin stays centred on the visible map region.
 *
 * On mount (when no initial coords are provided), tries to jump to the
 * user's current GPS position as a starting point. "Use Current Location"
 * button re-triggers the jump on demand.
 */
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { GooglePlacesAutocomplete, type GooglePlacesAutocompleteRef } from 'react-native-google-places-autocomplete';
import MapView, { type Region } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

// Singapore centre — used as a last-resort fallback when no initial coords
// and no current location. Roughly the geographic middle of the island.
const SINGAPORE_FALLBACK = { latitude: 1.3521, longitude: 103.8198 };
const DEFAULT_DELTA = 0.008; // ~800m viewport, wide enough to orient

export interface MapPickerConfirmPayload {
    latitude: number;
    longitude: number;
    /** Populated if the user typed a place name in the search field. Empty
     * when they panned manually. Callers can use this to auto-fill the
     * event's location text field without clobbering a manual entry. */
    name?: string;
}

export interface MapPickerProps {
    visible: boolean;
    /** If set, the map opens centred here and the pin starts at these coords. */
    initialLatitude?: number | null;
    initialLongitude?: number | null;
    /** Optional initial value for the search field — e.g. the event's existing
     * location text so the user can edit it rather than retype. */
    initialName?: string;
    /** Called when the user taps Confirm. Receives the coords under the pin
     * plus the search text if one was typed. */
    onConfirm: (payload: MapPickerConfirmPayload) => void;
    /** Called when the user taps Cancel or dismisses the modal. */
    onCancel: () => void;
}

export default function MapPicker({
    visible,
    initialLatitude,
    initialLongitude,
    initialName,
    onConfirm,
    onCancel,
}: MapPickerProps) {
    const { colors } = useTheme();
    const mapRef = useRef<MapView | null>(null);
    const autocompleteRef = useRef<GooglePlacesAutocompleteRef | null>(null);
    // Monotonic counter used to ignore stale reverse-geocode responses when
    // the user pans multiple times in quick succession. Only the most
    // recent request's result is applied.
    const pendingGeocodeIdRef = useRef(0);

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
    // Name associated with the current pin — set after a successful Places
    // selection, cleared on manual pan. If set at Confirm time, passed back
    // to the caller so the event's location text field can auto-fill.
    const [selectedName, setSelectedName] = useState<string | null>(initialName ?? null);

    // On every visible → true transition, re-sync internal state from the
    // latest props. Without this, a previously-mounted MapPicker retains
    // whatever pin / name / map region it was last showing — even though
    // the parent may now be editing a different event, or re-opening the
    // picker to adjust the same one. Handles three cases:
    //
    //   1. Re-opening with existing coords (user saved Woods Square, tapped
    //      the location row to edit again): restore the pin + autocomplete
    //      text + map centre to that saved state.
    //   2. Opening fresh with no coords: reset everything, then try to
    //      jump to the user's current GPS position as a starting point.
    //   3. Closing: reset `ready` so the Confirm button is disabled until
    //      the next open finishes laying out.
    useEffect(() => {
        if (!visible) {
            setReady(false);
            return;
        }

        // Case 1: reopening with a saved selection — restore it.
        if (initialLatitude != null && initialLongitude != null) {
            const coords = { latitude: initialLatitude, longitude: initialLongitude };
            setPinCoords(coords);
            setSelectedName(initialName ?? null);
            // Snap map to the saved coords on open. Duration 0 = instant
            // (no visible animation), so the user sees their last pick
            // immediately, not a jump from wherever the map was.
            mapRef.current?.animateToRegion(
                { ...coords, latitudeDelta: DEFAULT_DELTA, longitudeDelta: DEFAULT_DELTA },
                0,
            );
            // Pre-fill the search field with the saved name so the user
            // can tap it to edit or replace the selection.
            autocompleteRef.current?.setAddressText(initialName ?? '');
            setReady(true);
            return;
        }

        // Case 2: fresh open (no saved coords). Clear any stale state
        // from a previous session and try to centre on current GPS.
        setPinCoords(SINGAPORE_FALLBACK);
        setSelectedName(null);
        autocompleteRef.current?.setAddressText('');

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
    }, [visible, initialLatitude, initialLongitude, initialName]);

    // Reverse-geocode a coord pair and pick the most specific label from
    // the OS response. Prefers a POI name, then street+district, then
    // city, then country. Returns null if the geocoder gave no usable
    // result — caller should leave whatever name is currently displayed.
    const resolveCoordName = useCallback(async (latitude: number, longitude: number): Promise<string | null> => {
        try {
            const results = await Location.reverseGeocodeAsync({ latitude, longitude });
            if (results.length === 0) return null;
            const first = results[0];
            return (
                first.name ||
                [first.street, first.district || first.city].filter(Boolean).join(', ') ||
                first.city ||
                first.country ||
                null
            );
        } catch {
            return null;
        }
    }, []);

    const handleRegionChange = useCallback(
        async (region: Region, details?: { isGesture?: boolean }) => {
            setPinCoords({ latitude: region.latitude, longitude: region.longitude });
            // Only react to user-initiated pans. Programmatic animations
            // (from animateToRegion after a Places pick) fire this callback
            // with isGesture === false and must NOT trigger reverse-geocoding
            // — otherwise the Places-resolved name gets clobbered with a
            // nearby but different label immediately after selection.
            if (details?.isGesture !== true) return;

            // User panned. Reverse-geocode the new pin coords and update
            // the search bar live so the label tracks the pin. Track the
            // request ID so a slow response from a stale pan doesn't
            // overwrite a later pan's result.
            const myId = ++pendingGeocodeIdRef.current;
            const name = await resolveCoordName(region.latitude, region.longitude);
            if (myId !== pendingGeocodeIdRef.current) return; // stale
            if (name) {
                setSelectedName(name);
                autocompleteRef.current?.setAddressText(name);
            } else {
                // Geocoder gave us nothing — clear both so Confirm's
                // safety-net fallback can try again later if needed.
                setSelectedName(null);
                autocompleteRef.current?.setAddressText('');
            }
        },
        [resolveCoordName],
    );

    // Called by the GooglePlacesAutocomplete component when the user taps a
    // suggestion from the dropdown. `details` contains the full Place Details
    // (including geometry.location) thanks to fetchDetails={true} on the
    // component.
    const handlePlaceSelected = useCallback(
        (description: string, details: { geometry: { location: { lat: number; lng: number } } } | null) => {
            if (!details?.geometry?.location) return;
            const coords = {
                latitude: details.geometry.location.lat,
                longitude: details.geometry.location.lng,
            };
            setPinCoords(coords);
            setSelectedName(description);
            mapRef.current?.animateToRegion(
                { ...coords, latitudeDelta: DEFAULT_DELTA, longitudeDelta: DEFAULT_DELTA },
                300,
            );
        },
        [],
    );

    const handleUseCurrentLocation = useCallback(async () => {
        setLocating(true);
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') return;
            const fix = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
            const coords = { latitude: fix.coords.latitude, longitude: fix.coords.longitude };
            setPinCoords(coords);
            // Using current location invalidates any previously-selected name.
            setSelectedName(null);
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

    const handleConfirm = useCallback(async () => {
        // handleRegionChange already populates selectedName on every user
        // pan and handlePlaceSelected sets it from the Places suggestion,
        // so selectedName is almost always populated by the time Confirm
        // fires. Safety net: if it isn't (e.g. a slow reverse-geocode that
        // hadn't returned yet), resolve it now before returning to the
        // caller so every pin has a label.
        let name = selectedName ?? undefined;
        if (!name) {
            const resolved = await resolveCoordName(pinCoords.latitude, pinCoords.longitude);
            if (resolved) name = resolved;
        }

        onConfirm({
            latitude: pinCoords.latitude,
            longitude: pinCoords.longitude,
            name,
        });
    }, [onConfirm, pinCoords, selectedName, resolveCoordName]);

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

                {/* Places autocomplete — debounced search with dropdown
                    suggestions backed by Google Places API. On selection,
                    animates the map and drops the pin. The component
                    renders its dropdown absolute-positioned so it floats
                    over the map below. */}
                <View style={styles.searchWrapper}>
                    <GooglePlacesAutocomplete
                        ref={autocompleteRef}
                        placeholder="Search venue or address"
                        fetchDetails
                        debounce={300}
                        minLength={2}
                        enablePoweredByContainer={false}
                        onPress={(data, details) => {
                            // `details` is typed as `any` by the lib — narrow
                            // to what we actually read.
                            const geometry = (details as { geometry?: { location?: { lat: number; lng: number } } })
                                ?.geometry?.location;
                            if (!geometry) return;
                            handlePlaceSelected(data.description, {
                                geometry: { location: { lat: geometry.lat, lng: geometry.lng } },
                            });
                        }}
                        query={{
                            key: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
                            language: 'en',
                            // Bias results to Singapore — staff app footprint.
                            components: 'country:sg',
                        }}
                        textInputProps={{
                            placeholderTextColor: colors.textTertiary,
                            autoCorrect: false,
                            autoCapitalize: 'words',
                            // Tap → select all so the user can replace the
                            // saved name in one go without backspacing.
                            selectTextOnFocus: true,
                        }}
                        styles={{
                            container: {
                                flex: 0,
                                marginHorizontal: 16,
                                marginTop: 12,
                            },
                            textInputContainer: {
                                backgroundColor: colors.cardBackground,
                                borderRadius: 12,
                                paddingHorizontal: 12,
                                flexDirection: 'row',
                                alignItems: 'center',
                            },
                            textInput: {
                                backgroundColor: 'transparent',
                                color: colors.textPrimary,
                                fontSize: 15,
                                paddingVertical: 10,
                                margin: 0,
                            },
                            listView: {
                                backgroundColor: colors.cardBackground,
                                borderRadius: 12,
                                marginTop: 4,
                                elevation: 4,
                                shadowColor: colors.textPrimary,
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.12,
                                shadowRadius: 8,
                                // Float above the map — crucial.
                                zIndex: 10,
                            },
                            row: {
                                backgroundColor: 'transparent',
                                paddingHorizontal: 14,
                                paddingVertical: 12,
                            },
                            description: {
                                color: colors.textPrimary,
                                fontSize: 14,
                            },
                            separator: {
                                height: StyleSheet.hairlineWidth,
                                backgroundColor: colors.border,
                            },
                        }}
                        renderLeftButton={() => (
                            <Ionicons name="search" size={18} color={colors.textTertiary} style={{ marginRight: 8 }} />
                        )}
                    />
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
    // Wrapper exists just to give the GooglePlacesAutocomplete dropdown a
    // predictable z-index above the map. The component handles its own
    // internal padding + background via the `styles` prop.
    searchWrapper: {
        zIndex: 10,
        // No flex: 1 — we want this row to size to content so the map
        // below can fill the remaining space.
    },
    mapWrapper: { flex: 1, zIndex: 0 },
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
