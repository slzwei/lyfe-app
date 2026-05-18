import Constants from 'expo-constants';
import * as Updates from 'expo-updates';

/**
 * Build a human-readable version label for diagnostic surfaces (login footer,
 * profile screen). Lazy by design — call from inside a component (or memoise)
 * so the expo-updates / expo-constants native bridges are fully initialised
 * before we read static properties. Module-load eager eval of these was the
 * suspected cause of an iOS startup crash on 2026-05-16.
 *
 * Returns one of:
 *   v1.3.1 (28) · 019e352e   — both build number + OTA update id resolved
 *   v1.3.1 · 019e352e        — build number missing (e.g. Expo Go) but OTA id known
 *   v1.3.1 (28) · embedded   — no OTA applied; running the binary's bundled JS
 *   v1.3.1 (28) · unknown    — last resort if both Updates fields are null
 */
export function buildAppVersionLabel(): string {
    const version = Constants.expoConfig?.version ?? '1.3.1';

    let buildNumber: string | null = null;
    try {
        const native = Constants.nativeBuildVersion;
        if (typeof native === 'string' && native.length > 0) buildNumber = native;
    } catch {
        buildNumber = null;
    }

    let updateLabel = 'unknown';
    try {
        const id = Updates.updateId;
        if (typeof id === 'string' && id.length > 0) {
            updateLabel = id.slice(0, 8);
        } else if (Updates.isEmbeddedLaunch) {
            updateLabel = 'embedded';
        }
    } catch {
        updateLabel = 'unknown';
    }

    const versionPart = buildNumber ? `v${version} (${buildNumber})` : `v${version}`;
    return `${versionPart} · ${updateLabel}`;
}
