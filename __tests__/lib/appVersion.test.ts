/**
 * Login/profile version-label formatter (lib/appVersion.ts).
 *
 * Pins the embedded-vs-OTA distinction: when a build runs its own embedded JS
 * (no OTA applied on top), Updates.updateId is still a non-null UUID on SDK 54,
 * so the label must read 'embedded (…)' rather than masquerading as a published
 * OTA update id. Pure formatter — no native bridges needed.
 */
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { buildAppVersionLabel, formatAppVersionLabel } from '@/lib/appVersion';

// buildAppVersionLabel reads native bridges; mock them so we can drive the exact
// native-vs-expoConfig drift that mislabeled the 1.5.0 build as "1.4.0 (18)".
jest.mock('expo-application', () => ({ nativeApplicationVersion: null, nativeBuildVersion: null }));
jest.mock('expo-updates', () => ({ channel: 'production', updateId: null, isEmbeddedLaunch: true }));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '0.0.0' } } }));

const appMock = Application as unknown as {
    nativeApplicationVersion: string | null;
    nativeBuildVersion: string | null;
};
const constantsMock = Constants as unknown as { expoConfig: { version: string } | null };

describe('formatAppVersionLabel', () => {
    const base = {
        version: '1.3.1',
        buildNumber: '28',
        channel: 'production',
        updateId: null as string | null,
        isEmbeddedLaunch: false,
    };

    it('shows the 8-char update id when running a downloaded OTA update', () => {
        expect(formatAppVersionLabel({ ...base, updateId: '019e352e-aaaa-bbbb-cccc-ddddeeeeffff' })).toBe(
            'v1.3.1 (28) · production · 019e352e',
        );
    });

    it('labels an embedded launch "embedded (…)" even though updateId is a non-null UUID', () => {
        expect(
            formatAppVersionLabel({
                ...base,
                updateId: '019e352e-aaaa-bbbb-cccc-ddddeeeeffff',
                isEmbeddedLaunch: true,
            }),
        ).toBe('v1.3.1 (28) · production · embedded (019e352e)');
    });

    it('says plain "embedded" when embedded with no id available', () => {
        expect(formatAppVersionLabel({ ...base, updateId: null, isEmbeddedLaunch: true })).toBe(
            'v1.3.1 (28) · production · embedded',
        );
    });

    it('omits the build number when unavailable', () => {
        expect(formatAppVersionLabel({ ...base, buildNumber: null, updateId: '019e352e-aaaa' })).toBe(
            'v1.3.1 · production · 019e352e',
        );
    });

    it('drops the channel segment when the channel is unavailable', () => {
        expect(formatAppVersionLabel({ ...base, channel: null, updateId: '019e352e-aaaa' })).toBe(
            'v1.3.1 (28) · 019e352e',
        );
    });

    it('falls back to "unknown" when expo-updates is dark (no id, not embedded)', () => {
        expect(formatAppVersionLabel({ ...base, updateId: null, isEmbeddedLaunch: false })).toBe(
            'v1.3.1 (28) · production · unknown',
        );
    });
});

describe('buildAppVersionLabel — native binary version source', () => {
    it('uses the native versionName over Constants.expoConfig.version (fixes the 1.5.0 build showing "1.4.0")', () => {
        // The 1.5.0 native build: versionName bumped to 1.5.0, but app.config.js
        // (→ expoConfig / OTA manifest) still says 1.4.0. Must show the native 1.5.0.
        appMock.nativeApplicationVersion = '1.5.0';
        appMock.nativeBuildVersion = '18';
        constantsMock.expoConfig = { version: '1.4.0' };
        expect(buildAppVersionLabel()).toContain('v1.5.0 (18)');
    });

    it('falls back to expoConfig.version when the native version is unavailable (Expo Go / web)', () => {
        appMock.nativeApplicationVersion = null;
        constantsMock.expoConfig = { version: '1.4.0' };
        expect(buildAppVersionLabel()).toContain('v1.4.0');
    });
});
