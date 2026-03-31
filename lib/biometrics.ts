import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { IconName } from '@/types/ui';

const BIOMETRICS_ENABLED_KEY = 'lyfe_biometrics_enabled';
const BIOMETRICS_PROMPT_SHOWN_KEY = 'lyfe_biometrics_prompt_shown';
const BIOMETRIC_REFRESH_TOKEN_KEY = 'lyfe_biometric_refresh_token';

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
        await SecureStore.deleteItemAsync(BIOMETRIC_REFRESH_TOKEN_KEY);
        await SecureStore.deleteItemAsync(BIOMETRICS_PROMPT_SHOWN_KEY);
    }
}

/** Max age for biometric refresh tokens (7 days in ms). */
const BIOMETRIC_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Stash a refresh token so Face ID can re-establish a session after sign-out. */
export async function storeBiometricRefreshToken(token: string): Promise<void> {
    const payload = JSON.stringify({ token, storedAt: Date.now() });
    await SecureStore.setItemAsync(BIOMETRIC_REFRESH_TOKEN_KEY, payload);
}

export async function getBiometricRefreshToken(): Promise<string | null> {
    try {
        const raw = await SecureStore.getItemAsync(BIOMETRIC_REFRESH_TOKEN_KEY);
        if (!raw) return null;

        // New format: {token, storedAt}
        try {
            const parsed = JSON.parse(raw);
            if (parsed.token && parsed.storedAt) {
                if (Date.now() - parsed.storedAt > BIOMETRIC_TOKEN_MAX_AGE_MS) {
                    await clearBiometricRefreshToken();
                    return null;
                }
                return parsed.token;
            }
        } catch {
            // Not JSON — fall through to legacy format
        }

        // Legacy format: plain string token (no expiry check, migrate on next store)
        return raw;
    } catch {
        return null;
    }
}

export async function clearBiometricRefreshToken(): Promise<void> {
    await SecureStore.deleteItemAsync(BIOMETRIC_REFRESH_TOKEN_KEY);
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
