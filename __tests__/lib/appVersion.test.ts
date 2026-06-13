/**
 * Login/profile version-label formatter (lib/appVersion.ts).
 *
 * Pins the embedded-vs-OTA distinction: when a build runs its own embedded JS
 * (no OTA applied on top), Updates.updateId is still a non-null UUID on SDK 54,
 * so the label must read 'embedded (…)' rather than masquerading as a published
 * OTA update id. Pure formatter — no native bridges needed.
 */
import { formatAppVersionLabel } from '@/lib/appVersion';

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
