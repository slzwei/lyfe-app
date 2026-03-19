import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { IconName } from '@/types/ui';

const BIOMETRICS_ENABLED_KEY = 'lyfe_biometrics_enabled';
const BIOMETRICS_PROMPT_SHOWN_KEY = 'lyfe_biometrics_prompt_shown';

// iOS distinguishes Face ID vs Touch ID; Android uses a unified BiometricPrompt
// so we return a generic 'biometric' type.
export type BiometryType = 'faceid' | 'touchid' | 'biometric' | 'none';

export async function getBiometryType(): Promise<BiometryType> {
    try {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        if (!hasHardware) return 'none';
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        if (!isEnrolled) return 'none';
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        const hasFace = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
        const hasFingerprint = types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);
        if (!hasFace && !hasFingerprint) return 'none';
        // Android: always return generic 'biometric' — BiometricPrompt handles the rest
        if (Platform.OS === 'android') return 'biometric';
        // iOS: distinguish Face ID vs Touch ID
        if (hasFace) return 'faceid';
        return 'touchid';
    } catch {
        return 'none';
    }
}

export async function isBiometricsAvailable(): Promise<boolean> {
    const type = await getBiometryType();
    return type !== 'none';
}

export async function isBiometricsEnabled(): Promise<boolean> {
    try {
        const val = await SecureStore.getItemAsync(BIOMETRICS_ENABLED_KEY);
        return val === 'true';
    } catch {
        return false;
    }
}

export async function setBiometricsEnabled(enabled: boolean): Promise<void> {
    if (enabled) {
        await SecureStore.setItemAsync(BIOMETRICS_ENABLED_KEY, 'true');
        await SecureStore.setItemAsync(BIOMETRICS_PROMPT_SHOWN_KEY, 'true');
    } else {
        await SecureStore.deleteItemAsync(BIOMETRICS_ENABLED_KEY);
    }
}

export async function hasShownBiometricsPrompt(): Promise<boolean> {
    try {
        const val = await SecureStore.getItemAsync(BIOMETRICS_PROMPT_SHOWN_KEY);
        return val === 'true';
    } catch {
        return false;
    }
}

export async function markBiometricsPromptShown(): Promise<void> {
    await SecureStore.setItemAsync(BIOMETRICS_PROMPT_SHOWN_KEY, 'true');
}

/** Platform-appropriate label and Ionicon name for a given biometry type. */
export function biometricMeta(type: BiometryType): { label: string; icon: IconName } {
    switch (type) {
        case 'faceid':
            return { label: 'Face ID', icon: 'scan' };
        case 'touchid':
            return { label: 'Touch ID', icon: 'finger-print' };
        case 'biometric':
            return { label: 'Biometrics', icon: 'lock-closed' };
        default:
            return { label: '', icon: 'lock-closed' };
    }
}

export async function authenticate(promptMessage: string): Promise<boolean> {
    try {
        const result = await LocalAuthentication.authenticateAsync({
            promptMessage,
            cancelLabel: 'Cancel',
            disableDeviceFallback: true,
        });
        return result.success;
    } catch {
        return false;
    }
}
