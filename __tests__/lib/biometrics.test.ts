/**
 * Tests for lib/biometrics.ts — Biometric auth helpers
 */
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

import {
    getBiometryType,
    biometricMeta,
    isBiometricsAvailable,
    isBiometricsEnabled,
    setBiometricsEnabled,
    hasShownBiometricsPrompt,
    markBiometricsPromptShown,
    authenticate,
} from '@/lib/biometrics';

const mockLA = LocalAuthentication as jest.Mocked<typeof LocalAuthentication>;
const mockSS = SecureStore as jest.Mocked<typeof SecureStore>;

beforeEach(() => {
    jest.clearAllMocks();
});

// ── getBiometryType ──

describe('getBiometryType', () => {
    it('returns faceid when facial recognition available', async () => {
        mockLA.hasHardwareAsync.mockResolvedValue(true);
        mockLA.isEnrolledAsync.mockResolvedValue(true);
        mockLA.supportedAuthenticationTypesAsync.mockResolvedValue([
            LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
        ]);

        expect(await getBiometryType()).toBe('faceid');
    });

    it('returns touchid when fingerprint available', async () => {
        mockLA.hasHardwareAsync.mockResolvedValue(true);
        mockLA.isEnrolledAsync.mockResolvedValue(true);
        mockLA.supportedAuthenticationTypesAsync.mockResolvedValue([
            LocalAuthentication.AuthenticationType.FINGERPRINT,
        ]);

        expect(await getBiometryType()).toBe('touchid');
    });

    it('prefers faceid over touchid when both available', async () => {
        mockLA.hasHardwareAsync.mockResolvedValue(true);
        mockLA.isEnrolledAsync.mockResolvedValue(true);
        mockLA.supportedAuthenticationTypesAsync.mockResolvedValue([
            LocalAuthentication.AuthenticationType.FINGERPRINT,
            LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
        ]);

        expect(await getBiometryType()).toBe('faceid');
    });

    it('returns none when no hardware', async () => {
        mockLA.hasHardwareAsync.mockResolvedValue(false);

        expect(await getBiometryType()).toBe('none');
    });

    it('returns none when not enrolled', async () => {
        mockLA.hasHardwareAsync.mockResolvedValue(true);
        mockLA.isEnrolledAsync.mockResolvedValue(false);

        expect(await getBiometryType()).toBe('none');
    });

    it('returns none when no supported types', async () => {
        mockLA.hasHardwareAsync.mockResolvedValue(true);
        mockLA.isEnrolledAsync.mockResolvedValue(true);
        mockLA.supportedAuthenticationTypesAsync.mockResolvedValue([]);

        expect(await getBiometryType()).toBe('none');
    });

    it('returns none on error', async () => {
        mockLA.hasHardwareAsync.mockRejectedValue(new Error('Device error'));

        expect(await getBiometryType()).toBe('none');
    });
});

// ── biometricMeta ──

describe('biometricMeta', () => {
    it('returns Face ID label and scan icon for faceid', () => {
        expect(biometricMeta('faceid')).toEqual({ label: 'Face ID', icon: 'scan' });
    });

    it('returns Touch ID label and finger-print icon for touchid', () => {
        expect(biometricMeta('touchid')).toEqual({ label: 'Touch ID', icon: 'finger-print' });
    });

    it('returns Biometrics label and lock-closed icon for biometric', () => {
        expect(biometricMeta('biometric')).toEqual({ label: 'Biometrics', icon: 'lock-closed' });
    });

    it('returns fallback for none', () => {
        expect(biometricMeta('none')).toEqual({ label: '', icon: 'lock-closed' });
    });
});

// ── isBiometricsAvailable ──

describe('isBiometricsAvailable', () => {
    it('returns true when biometry type is not none', async () => {
        mockLA.hasHardwareAsync.mockResolvedValue(true);
        mockLA.isEnrolledAsync.mockResolvedValue(true);
        mockLA.supportedAuthenticationTypesAsync.mockResolvedValue([
            LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
        ]);

        expect(await isBiometricsAvailable()).toBe(true);
    });

    it('returns false when no biometry', async () => {
        mockLA.hasHardwareAsync.mockResolvedValue(false);

        expect(await isBiometricsAvailable()).toBe(false);
    });
});

// ── isBiometricsEnabled ──

describe('isBiometricsEnabled', () => {
    it('returns true when stored value is "true"', async () => {
        mockSS.getItemAsync.mockResolvedValue('true');

        expect(await isBiometricsEnabled()).toBe(true);
        expect(mockSS.getItemAsync).toHaveBeenCalledWith('lyfe_biometrics_enabled');
    });

    it('returns false when stored value is null', async () => {
        mockSS.getItemAsync.mockResolvedValue(null);

        expect(await isBiometricsEnabled()).toBe(false);
    });

    it('returns false when stored value is not "true"', async () => {
        mockSS.getItemAsync.mockResolvedValue('false');

        expect(await isBiometricsEnabled()).toBe(false);
    });

    it('returns false on SecureStore error', async () => {
        mockSS.getItemAsync.mockRejectedValue(new Error('Keychain error'));

        expect(await isBiometricsEnabled()).toBe(false);
    });
});

// ── setBiometricsEnabled ──

describe('setBiometricsEnabled', () => {
    it('stores true and marks prompt shown when enabling', async () => {
        await setBiometricsEnabled(true);

        expect(mockSS.setItemAsync).toHaveBeenCalledWith('lyfe_biometrics_enabled', 'true');
        expect(mockSS.setItemAsync).toHaveBeenCalledWith('lyfe_biometrics_prompt_shown', 'true');
    });

    it('deletes all biometric keys when disabling', async () => {
        await setBiometricsEnabled(false);

        expect(mockSS.deleteItemAsync).toHaveBeenCalledWith('lyfe_biometrics_enabled');
        expect(mockSS.deleteItemAsync).toHaveBeenCalledWith('lyfe_biometric_refresh_token');
        expect(mockSS.deleteItemAsync).toHaveBeenCalledWith('lyfe_biometrics_prompt_shown');
        expect(mockSS.setItemAsync).not.toHaveBeenCalled();
    });
});

// ── hasShownBiometricsPrompt ──

describe('hasShownBiometricsPrompt', () => {
    it('returns true when stored', async () => {
        mockSS.getItemAsync.mockResolvedValue('true');

        expect(await hasShownBiometricsPrompt()).toBe(true);
    });

    it('returns false when not stored', async () => {
        mockSS.getItemAsync.mockResolvedValue(null);

        expect(await hasShownBiometricsPrompt()).toBe(false);
    });

    it('returns false on error', async () => {
        mockSS.getItemAsync.mockRejectedValue(new Error('fail'));

        expect(await hasShownBiometricsPrompt()).toBe(false);
    });
});

// ── markBiometricsPromptShown ──

describe('markBiometricsPromptShown', () => {
    it('stores prompt shown flag', async () => {
        await markBiometricsPromptShown();

        expect(mockSS.setItemAsync).toHaveBeenCalledWith('lyfe_biometrics_prompt_shown', 'true');
    });
});

// ── authenticate ──

describe('authenticate', () => {
    it('returns true on successful auth', async () => {
        mockLA.authenticateAsync.mockResolvedValue({ success: true } as any);

        expect(await authenticate('Sign in')).toBe(true);
        expect(mockLA.authenticateAsync).toHaveBeenCalledWith({
            promptMessage: 'Sign in',
            cancelLabel: 'Cancel',
            disableDeviceFallback: true,
        });
    });

    it('returns false when user cancels', async () => {
        mockLA.authenticateAsync.mockResolvedValue({ success: false } as any);

        expect(await authenticate('Sign in')).toBe(false);
    });

    it('returns false on error', async () => {
        mockLA.authenticateAsync.mockRejectedValue(new Error('Sensor error'));

        expect(await authenticate('Sign in')).toBe(false);
    });
});
