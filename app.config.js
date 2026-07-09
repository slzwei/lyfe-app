/**
 * Expo dynamic config — replaces app.json so we can inject environment
 * variables at build time. The only dynamic bit right now is the Google
 * Maps Android SDK API key (pulled from .env.local / .env so it stays
 * out of git). iOS uses Apple MapKit which needs no key.
 *
 * Expo CLI auto-loads .env / .env.local into process.env before
 * evaluating this file, so no explicit `require('dotenv').config()` is
 * needed for expo start / prebuild / eas build.
 */

module.exports = {
    expo: {
        name: 'Lyfe',
        slug: 'lyfe-app',
        version: '1.5.2',
        // Lock supported platforms to mobile so `expo export --platform all`
        // (which is what eas update runs by default) doesn't try to bundle for
        // web. react-native-pdf has no web fallback and breaks the web bundle.
        // lyfe-sg is the actual web product — this app is mobile-only.
        platforms: ['ios', 'android'],
        orientation: 'portrait',
        icon: './assets/images/icon.png',
        scheme: 'lyfeapp',
        userInterfaceStyle: 'automatic',
        updates: {
            url: 'https://u.expo.dev/e8f2f192-e77b-4673-a00c-4e63478d56d2',
            // Native layer checks for updates on cold start; pairs with the
            // foreground silent-fetch in hooks/useOtaUpdates.ts. fallback=0
            // means we never block launch on an update — always boot the
            // cached bundle immediately and apply new ones on next cold start.
            checkAutomatically: 'ON_LOAD',
            fallbackToCacheTimeout: 0,
        },
        // Bare workflow: runtime version policies aren't supported, so this
        // must be bumped manually whenever native code or native deps change.
        // 1.5.1: the calendar fix ships in a NEW native build (correct Info.plist
        // via the expo-calendar config plugin). Its own runtime lane — isolated from
        // the poisoned runtime-1.4.0 population, so their kill-switch OTA and this
        // build's OTAs never cross. Bump native versionName / CFBundleShortVersion
        // to 1.5.1 too (build.gradle + iOS project) when you cut this build.
        runtimeVersion: '1.5.2',
        splash: {
            image: './assets/images/splash-icon.png',
            resizeMode: 'contain',
            backgroundColor: '#F5F0E6',
        },
        ios: {
            supportsTablet: false,
            bundleIdentifier: 'com.shawnlee.lyfe',
            appleTeamId: '35L9ZSS9F9',
            infoPlist: {
                NSFaceIDUsageDescription: 'Use Face ID to sign in to Lyfe quickly and securely.',
                NSCameraUsageDescription:
                    'Lyfe uses the camera for profile photos and to verify your identity at roadshow check-in.',
                NSMicrophoneUsageDescription:
                    'Lyfe uses the microphone when recording video for events. Lyfe does not record audio in the background.',
                NSLocationWhenInUseUsageDescription:
                    'Lyfe uses your location to verify you are at the roadshow venue during check-in.',
                NSPhotoLibraryUsageDescription: 'Allow Lyfe to choose a profile photo from your library.',
                NSPhotoLibraryAddUsageDescription:
                    'Lyfe needs permission to save event photos and exported documents to your photo library.',
                ITSAppUsesNonExemptEncryption: false,
                UIRequiredDeviceCapabilities: [],
            },
        },
        android: {
            package: 'com.shawnlee.lyfe',
            adaptiveIcon: {
                backgroundColor: '#F5F0E6',
                foregroundImage: './assets/images/android-icon-foreground.png',
                backgroundImage: './assets/images/android-icon-background.png',
                monochromeImage: './assets/images/android-icon-monochrome.png',
            },
            predictiveBackGestureEnabled: false,
            permissions: [
                'android.permission.USE_BIOMETRIC',
                'android.permission.USE_FINGERPRINT',
                'android.permission.CAMERA',
                'android.permission.ACCESS_FINE_LOCATION',
                'android.permission.ACCESS_COARSE_LOCATION',
                'android.permission.POST_NOTIFICATIONS',
            ],
            // Strip the restricted photo/video permissions that expo-image-picker
            // would otherwise add. The avatar picker uses the Android system
            // Photo Picker (launchImageLibraryAsync), which needs no permission,
            // so declaring these would trigger Google Play's photo/video policy
            // declaration for no reason. prebuild emits tools:node="remove" for
            // each, removing them from the merged manifest.
            blockedPermissions: [
                'android.permission.READ_MEDIA_IMAGES',
                'android.permission.READ_MEDIA_VIDEO',
                'android.permission.READ_EXTERNAL_STORAGE',
            ],
            config: {
                googleMaps: {
                    // Read from .env.local so the key stays out of git.
                    // Restrict this key to com.shawnlee.lyfe + SHA-1 in the Google Cloud console.
                    apiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY,
                },
            },
        },
        plugins: [
            'expo-router',
            'expo-font',
            'expo-secure-store',
            'expo-web-browser',
            'expo-local-authentication',
            'expo-image-picker',
            'expo-video',
            [
                '@sentry/react-native',
                {
                    organization: 'mktr-pte-ltd',
                    project: 'apple-ios',
                },
            ],
            './plugins/withSwiftConcurrency',
            'expo-location',
            [
                // Manages calendar usage-description strings (iOS) + READ/WRITE_CALENDAR
                // (Android) on every native build. Declaring them here — not only in the
                // hand-edited native files — is what prevents the MissingCalendarPListValue
                // crash that shipped in 1.5.0 build 33 (Sentry APPLE-IOS-6).
                'expo-calendar',
                {
                    calendarPermission:
                        'Lyfe adds events you choose to your calendar so reminders work even when the app is closed.',
                },
            ],
            [
                'expo-build-properties',
                {
                    ios: {
                        deploymentTarget: '16.0',
                    },
                    android: {
                        minSdkVersion: 26,
                    },
                },
            ],
        ],
        experiments: {
            typedRoutes: true,
        },
        newArchEnabled: true,
        extra: {
            router: {},
            eas: {
                projectId: 'e8f2f192-e77b-4673-a00c-4e63478d56d2',
            },
        },
    },
};
