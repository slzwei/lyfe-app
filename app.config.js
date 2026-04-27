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
        version: '1.3.0',
        orientation: 'portrait',
        icon: './assets/images/icon.png',
        scheme: 'lyfeapp',
        userInterfaceStyle: 'automatic',
        splash: {
            image: './assets/images/splash-icon.png',
            resizeMode: 'contain',
            backgroundColor: '#FFFFFF',
        },
        ios: {
            supportsTablet: false,
            bundleIdentifier: 'com.shawnlee.lyfe',
            appleTeamId: 'Y953XF3N6C',
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
                backgroundColor: '#E6F4FE',
                foregroundImage: './assets/images/android-icon-foreground.png',
                backgroundImage: './assets/images/android-icon-background.png',
                monochromeImage: './assets/images/android-icon-monochrome.png',
            },
            predictiveBackGestureEnabled: false,
            permissions: [
                'android.permission.USE_BIOMETRIC',
                'android.permission.USE_FINGERPRINT',
                'android.permission.CAMERA',
                'android.permission.READ_MEDIA_IMAGES',
                'android.permission.ACCESS_FINE_LOCATION',
                'android.permission.ACCESS_COARSE_LOCATION',
            ],
            config: {
                googleMaps: {
                    // Read from .env.local so the key stays out of git.
                    // Restrict this key to com.shawnlee.lyfe + SHA-1 in the Google Cloud console.
                    apiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY,
                },
            },
        },
        web: {
            bundler: 'metro',
            output: 'static',
            favicon: './assets/images/favicon.png',
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
