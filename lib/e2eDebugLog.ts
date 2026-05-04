/**
 * E2E debug logger — writes per-flow log files to the app's Documents
 * directory. Maestro launches each flow as a fresh process; each process's
 * module load picks a unique filename based on Date.now() at startup, so
 * the 5 flows produce 5 distinct files (no overwrite). The CI workflow
 * cats all `e2e-debug-*.log` after Maestro finishes.
 *
 * Why not console.warn / sim.log: tested in PR #48 — console.warn output
 * does NOT make it into `xcrun simctl spawn ... log stream` on Release
 * builds. RN routes through RCTLog → a subsystem the predicate filter
 * doesn't catch.
 *
 * Why not single shared file: Maestro re-launches the app per flow, the
 * Documents directory persists, but the in-memory buffer resets. We
 * tried "read prior content + append" — the file did appear to exist
 * across flows but only the LAST flow's content survived, suggesting
 * either Maestro reinstalls or expo-file-system/next's behavior on
 * existing files differs from what we expected.
 *
 * Only active when EXPO_PUBLIC_E2E_FACE_BYPASS === '1' (CI builds).
 */
import { File, Paths } from 'expo-file-system/next';

const enabled = process.env.EXPO_PUBLIC_E2E_FACE_BYPASS === '1';

// Unique per process. Each Maestro flow launches a fresh app process, so
// each gets its own filename. Format: e2e-debug-<unix-ms>.log
const launchId = Date.now();
const filename = `e2e-debug-${launchId}.log`;

let buffer = '';

export function e2eDebug(...parts: unknown[]) {
    if (!enabled) return;
    try {
        const line = `${new Date().toISOString()} ${parts.map((p) => (typeof p === 'string' ? p : JSON.stringify(p))).join(' ')}\n`;
        buffer += line;
        const file = new File(Paths.document, filename);
        file.write(buffer);
    } catch {
        // never throw from a debug logger
    }
}
