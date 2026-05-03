/**
 * E2E debug logger — appends to a file in the simulator's app container so
 * the CI workflow can `cat` it after Maestro runs. console.log is stripped
 * by babel-preset-expo in Release builds, so console.* won't surface in CI.
 *
 * Only writes when EXPO_PUBLIC_E2E_FACE_BYPASS === '1' (CI builds).
 */
import { File, Paths } from 'expo-file-system/next';

const enabled = process.env.EXPO_PUBLIC_E2E_FACE_BYPASS === '1';

export function e2eDebug(...parts: unknown[]) {
    if (!enabled) return;
    try {
        const line = `${new Date().toISOString()} ${parts.map((p) => (typeof p === 'string' ? p : JSON.stringify(p))).join(' ')}\n`;
        const file = new File(Paths.document, 'e2e-debug.log');
        const existing = file.exists ? (file.text ?? '') : '';
        file.write(existing + line);
    } catch {
        // never throw from a debug logger
    }
}
