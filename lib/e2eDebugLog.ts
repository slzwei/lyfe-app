/**
 * E2E debug logger — appends to a file in the simulator's app container so
 * the CI workflow can `cat` it after Maestro runs. console.log is stripped
 * by babel-preset-expo in Release builds.
 *
 * Only active when EXPO_PUBLIC_E2E_FACE_BYPASS === '1' (CI builds).
 *
 * Implementation note: keeps an in-memory buffer of all log lines and writes
 * the cumulative buffer on every call. file.text() is async (returns a
 * Promise) and we want a sync logger, so we don't read existing content
 * back from disk — the in-process buffer is the source of truth.
 */
import { File, Paths } from 'expo-file-system/next';

const enabled = process.env.EXPO_PUBLIC_E2E_FACE_BYPASS === '1';

let buffer = '';

export function e2eDebug(...parts: unknown[]) {
    if (!enabled) return;
    try {
        const line = `${new Date().toISOString()} ${parts.map((p) => (typeof p === 'string' ? p : JSON.stringify(p))).join(' ')}\n`;
        buffer += line;
        const file = new File(Paths.document, 'e2e-debug.log');
        file.write(buffer);
    } catch {
        // never throw from a debug logger
    }
}
