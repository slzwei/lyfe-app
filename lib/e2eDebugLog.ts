/**
 * E2E debug logger — primary path: console.warn (survives Release builds;
 * babel-preset-expo strips console.log but not warn/error). Captured by the
 * `xcrun simctl spawn ... log stream` running in CI as /tmp/sim.log, which
 * is uploaded as artifact. console.warn output spans all 5 Maestro flows in
 * one stream — solves the "Maestro reinstalls per flow → Documents wiped"
 * problem the file-based logger had.
 *
 * Backup path: keeps writing to e2e-debug.log in the app's Documents
 * directory in case sim.log capture fails. Best-effort.
 *
 * Only active when EXPO_PUBLIC_E2E_FACE_BYPASS === '1' (CI builds).
 */
import { File, Paths } from 'expo-file-system/next';

const enabled = process.env.EXPO_PUBLIC_E2E_FACE_BYPASS === '1';

let buffer = '';

export function e2eDebug(...parts: unknown[]) {
    if (!enabled) return;
    const line = `[E2E_DEBUG] ${new Date().toISOString()} ${parts.map((p) => (typeof p === 'string' ? p : JSON.stringify(p))).join(' ')}`;

    // Primary: console.warn (cross-flow visibility via sim.log)
    try {
        // eslint-disable-next-line no-console
        console.warn(line);
    } catch {
        // never throw from a debug logger
    }

    // Backup: file write (per-flow, survives if sim.log capture is missing)
    try {
        buffer += line + '\n';
        const file = new File(Paths.document, 'e2e-debug.log');
        file.write(buffer);
    } catch {
        // ignore
    }
}
