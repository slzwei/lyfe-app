import * as Application from 'expo-application';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';

/**
 * Build a human-readable version label for diagnostic surfaces (login footer,
 * profile screen). Lazy by design — call from inside a component (or memoise)
 * so the expo-updates / expo-constants native bridges are fully initialised
 * before we read static properties. Module-load eager eval of these was the
 * suspected cause of an iOS startup crash on 2026-05-16.
 *
 * The pure formatting is split into formatAppVersionLabel() so it can be
 * unit-tested without the native bridges (__tests__/lib/appVersion.test.ts).
 *
 * Returns one of:
 *   v1.3.1 (28) · production · 019e352e            — running a downloaded OTA update (its id)
 *   v1.3.1 (28) · production · embedded (019e352e) — no OTA applied; running the build's own bundle
 *   v1.3.1 · production · 019e352e                 — build number missing (e.g. Expo Go)
 *   v1.3.1 (28) · 019e352e                         — channel unavailable, OTA id known
 *   v1.3.1 (28) · production · unknown             — expo-updates dark / disabled
 */
export interface AppVersionParts {
    version: string;
    buildNumber: string | null;
    channel: string | null;
    updateId: string | null;
    isEmbeddedLaunch: boolean;
}

/**
 * Pure label formatter. An embedded launch is labelled `embedded (…)` rather
 * than its raw id: on SDK 54 `Updates.updateId` is a non-null UUID even when
 * running the bundle baked into the build, so showing the bare slice made an
 * embedded build look like it was on a published OTA update (it isn't). The
 * embedded id is kept in parens for build correlation.
 */
export function formatAppVersionLabel({
    version,
    buildNumber,
    channel,
    updateId,
    isEmbeddedLaunch,
}: AppVersionParts): string {
    const shortId = updateId && updateId.length > 0 ? updateId.slice(0, 8) : null;

    let updateLabel: string;
    if (isEmbeddedLaunch) {
        updateLabel = shortId ? `embedded (${shortId})` : 'embedded';
    } else if (shortId) {
        updateLabel = shortId;
    } else {
        updateLabel = 'unknown';
    }

    const versionPart = buildNumber ? `v${version} (${buildNumber})` : `v${version}`;
    return [versionPart, channel, updateLabel].filter(Boolean).join(' · ');
}

export function buildAppVersionLabel(): string {
    // Read the version from the NATIVE binary (Android versionName / iOS
    // CFBundleShortVersionString) via expo-application — NOT Constants.expoConfig
    // .version. expoConfig reflects the JS bundle / OTA manifest (app.config.js
    // `version` at publish time), so a native build whose versionName was bumped
    // to 1.5.0 while app.config.js still read 1.4.0 — or which pulled an OTA
    // published under the old version — mislabels itself. nativeApplicationVersion
    // is correct per-binary and OTA-immune (mirrors how buildNumber below reads
    // nativeBuildVersion). Falls back to expoConfig where native is absent
    // (Expo Go / web / tests).
    let version = Constants.expoConfig?.version ?? '1.3.1';
    try {
        const nativeVersion = Application.nativeApplicationVersion;
        if (typeof nativeVersion === 'string' && nativeVersion.length > 0) version = nativeVersion;
    } catch {
        // keep the expoConfig fallback
    }

    let buildNumber: string | null = null;
    try {
        // expo-application, NOT Constants.nativeBuildVersion — the latter is
        // @deprecated and resolves to null on SDK 54. Application reads the
        // native Android versionCode / iOS CFBundleVersion. Already linked
        // (transitive via expo-notifications), so this stays OTA-safe.
        const native = Application.nativeBuildVersion;
        if (typeof native === 'string' && native.length > 0) buildNumber = native;
    } catch {
        buildNumber = null;
    }

    let channel: string | null = null;
    try {
        const c = Updates.channel;
        if (typeof c === 'string' && c.length > 0) channel = c;
    } catch {
        channel = null;
    }

    let updateId: string | null = null;
    let isEmbeddedLaunch = false;
    try {
        const id = Updates.updateId;
        if (typeof id === 'string' && id.length > 0) updateId = id;
        isEmbeddedLaunch = Updates.isEmbeddedLaunch === true;
    } catch {
        updateId = null;
        isEmbeddedLaunch = false;
    }

    return formatAppVersionLabel({ version, buildNumber, channel, updateId, isEmbeddedLaunch });
}
