import { useEffect, useRef, useState } from 'react';
import { Dimensions } from 'react-native';
import { Easing, type SharedValue, withTiming } from 'react-native-reanimated';

const OPEN_DURATION = 300;
const CLOSE_DURATION = 250;
const SLIDE_UP = { duration: OPEN_DURATION, easing: Easing.out(Easing.cubic) };
const SLIDE_DOWN = { duration: CLOSE_DURATION, easing: Easing.out(Easing.cubic) };
const OFFSCREEN = Dimensions.get('window').height;

/**
 * Manages open/close animation for a bottom-sheet Modal.
 *
 * Returns `modalVisible` — pass this to `<Modal visible>` instead of the
 * raw `show` flag. The Modal stays mounted for the full duration of the
 * close animation so the slide-down is visible.
 */
export function useSheetAnimation(show: boolean, sheetY: SharedValue<number>): boolean {
    const [modalVisible, setModalVisible] = useState(false);
    const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (closeTimer.current) {
            clearTimeout(closeTimer.current);
            closeTimer.current = null;
        }

        if (show) {
            setModalVisible(true);
            sheetY.value = withTiming(0, SLIDE_UP);
        } else if (modalVisible) {
            sheetY.value = withTiming(OFFSCREEN, SLIDE_DOWN);
            closeTimer.current = setTimeout(() => {
                setModalVisible(false);
                closeTimer.current = null;
            }, CLOSE_DURATION + 30);
        }
    }, [show]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        return () => {
            if (closeTimer.current) clearTimeout(closeTimer.current);
        };
    }, []);

    return modalVisible;
}
