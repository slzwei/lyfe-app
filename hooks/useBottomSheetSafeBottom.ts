import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Returns a paddingBottom value that clears Android's 3-button nav bar
 * (~48dp) and iOS's home indicator (~34px) for bottom-anchored modal sheets.
 *
 * Pass the original design padding as `floor`; the returned value is
 * `max(floor, 16 + bottomInset)`. So iOS without a home indicator keeps the
 * original design value, while Android with a system nav bar gets ~64.
 */
export function useBottomSheetSafeBottom(floor: number): number {
    const { bottom } = useSafeAreaInsets();
    return Math.max(floor, 16 + bottom);
}
