/**
 * RN-only: Platform-split shadow presets.
 * iOS uses shadowOffset/Opacity/Radius; Android uses elevation.
 */

import { Platform, StyleSheet } from 'react-native';
import type { ViewStyle } from 'react-native';

export const HAIRLINE = StyleSheet.hairlineWidth;

type ShadowLevel = 'sm' | 'md' | 'lg';

const ios: Record<ShadowLevel, ViewStyle> = {
    sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8 },
    md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 12 },
    lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 16 },
};

const android: Record<ShadowLevel, ViewStyle> = {
    sm: { elevation: 2 },
    md: { elevation: 4 },
    lg: { elevation: 8 },
};

export function shadow(level: ShadowLevel): ViewStyle {
    return Platform.OS === 'ios' ? ios[level] : android[level];
}
