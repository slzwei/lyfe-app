import * as Updates from 'expo-updates';
import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { captureError } from '@/lib/sentry';

// Kept for backwards compat with the AuthContext's bio-gate skip logic, even
// though we no longer write to it (no JS-triggered reloads). Reading it on
// init is a no-op when the key is absent.
export const OTA_RELOAD_FLAG_KEY = 'lyfe_ota_just_reloaded';

// Silently checks EAS for a new bundle on every foreground transition and
// downloads it in the background. Does NOT trigger reloadAsync — the new
// bundle applies on the user's next natural cold start (full app kill, OS
// eviction, or device restart). This is the same as expo-updates' default
// cold-start behavior, with the foreground check as an enhancement so users
// who background but don't fully kill the app still queue updates.
//
// Tradeoff: zero flash, zero forced reloads. Update delivery latency is
// "until next cold start" — typically minutes to hours for active users.
// For urgent fixes, expect <24h reach across the user base.
export function useOtaUpdates() {
    useEffect(() => {
        if (!Updates.isEnabled || __DEV__) return;

        let cancelled = false;

        const checkAndFetch = async () => {
            try {
                const result = await Updates.checkForUpdateAsync();
                if (cancelled || !result.isAvailable) return;
                await Updates.fetchUpdateAsync();
                // Bundle is now cached; expo-updates applies it on next cold start.
            } catch (err) {
                captureError(err, { fn: 'useOtaUpdates.checkAndFetch' });
            }
        };

        // Initial check on mount (covers cold start + dev client reload cases
        // where AppState 'active' may not fire).
        checkAndFetch();

        const subscription = AppState.addEventListener('change', (status: AppStateStatus) => {
            if (status === 'active') checkAndFetch();
        });

        return () => {
            cancelled = true;
            subscription.remove();
        };
    }, []);
}
