/**
 * E2E debug logger — writes to a file in the simulator's app container so
 * the CI workflow can `cat` it after Maestro runs. console.log is stripped
 * by babel-preset-expo in Release builds.
 *
 * Only active when EXPO_PUBLIC_E2E_FACE_BYPASS === '1' (CI builds).
 *
 * Maestro launches the app fresh per flow (5 separate processes), each with
 * its own in-memory buffer. To preserve logs across all 5 flows we read any
 * pre-existing file content into the buffer on first call, then write the
 * cumulative buffer on every subsequent call. So flow N+1's logs show up
 * AFTER flow N's logs in the same file — which is what CI reads.
 */
import { File, Paths } from 'expo-file-system/next';

const enabled = process.env.EXPO_PUBLIC_E2E_FACE_BYPASS === '1';

let buffer = '';
let initialized = false;

export function e2eDebug(...parts: unknown[]) {
    if (!enabled) return;
    try {
        if (!initialized) {
            initialized = true;
            try {
                const existing = new File(Paths.document, 'e2e-debug.log');
                if (existing.exists) {
                    const prior = existing.text();
                    if (typeof prior === 'string' && prior.length > 0) {
                        buffer = prior + `--- new app launch at ${new Date().toISOString()} ---\n`;
                    }
                }
            } catch {
                // ignore — fresh start is fine
            }
        }
        const line = `${new Date().toISOString()} ${parts.map((p) => (typeof p === 'string' ? p : JSON.stringify(p))).join(' ')}\n`;
        buffer += line;
        const file = new File(Paths.document, 'e2e-debug.log');
        file.write(buffer);
    } catch {
        // never throw from a debug logger
    }
}
