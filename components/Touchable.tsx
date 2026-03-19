/**
 * Cross-platform touchable wrapper.
 *
 * - iOS: opacity dim on press (matches existing TouchableOpacity behavior)
 * - Android: Material ripple feedback
 *
 * Drop-in replacement for TouchableOpacity in shared components.
 * Accepts all Pressable props + an optional `activeOpacity` for iOS parity.
 */
import React from 'react';
import { Platform, Pressable, type PressableProps } from 'react-native';

interface TouchableProps extends Omit<PressableProps, 'style'> {
    /** iOS press opacity (default 0.7, matching TouchableOpacity default) */
    activeOpacity?: number;
    /** Ripple color override for Android (default: subtle gray) */
    rippleColor?: string;
    /** Borderless ripple (for icon buttons) */
    rippleBorderless?: boolean;
    style?: PressableProps['style'];
    children?: React.ReactNode;
}

export default function Touchable({
    activeOpacity = 0.7,
    rippleColor = 'rgba(0, 0, 0, 0.08)',
    rippleBorderless = false,
    style,
    children,
    disabled,
    accessibilityRole = 'button',
    ...rest
}: TouchableProps) {
    return (
        <Pressable
            style={({ pressed }) => [
                typeof style === 'function' ? style({ pressed }) : style,
                Platform.OS === 'ios' && pressed && !disabled ? { opacity: activeOpacity } : undefined,
            ]}
            android_ripple={
                Platform.OS === 'android' && !disabled
                    ? { color: rippleColor, borderless: rippleBorderless }
                    : undefined
            }
            disabled={disabled}
            accessibilityRole={accessibilityRole}
            {...rest}
        >
            {children}
        </Pressable>
    );
}
