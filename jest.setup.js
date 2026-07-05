// Mock expo-secure-store
jest.mock('expo-secure-store', () => ({
    getItemAsync: jest.fn(),
    setItemAsync: jest.fn(),
    deleteItemAsync: jest.fn(),
}));

// Mock expo-notifications
jest.mock('expo-notifications', () => ({
    getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
    requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
    getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: 'ExponentPushToken[mock]' }),
    setNotificationHandler: jest.fn(),
}));

// Mock expo-local-authentication
jest.mock('expo-local-authentication', () => ({
    hasHardwareAsync: jest.fn().mockResolvedValue(true),
    isEnrolledAsync: jest.fn().mockResolvedValue(true),
    supportedAuthenticationTypesAsync: jest.fn().mockResolvedValue([]),
    authenticateAsync: jest.fn().mockResolvedValue({ success: true }),
    AuthenticationType: {
        FINGERPRINT: 1,
        FACIAL_RECOGNITION: 2,
        IRIS: 3,
    },
}));

// Mock expo-router — functional Stack/Tabs components for layout testing
jest.mock('expo-router', () => {
    const React = require('react');
    const { View } = require('react-native');

    const Stack = (props) => React.createElement(View, { testID: 'mock-stack' }, props.children);
    Stack.Screen = () => null;

    const Tabs = (props) => React.createElement(View, { testID: 'mock-tabs' }, props.children);
    Tabs.Screen = () => null;

    const routerObj = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => false };

    return {
        Stack,
        Tabs,
        Redirect: ({ href }) => React.createElement(View, { testID: `redirect-${href}` }),
        Link: ({ children }) => React.createElement(View, null, children),
        router: routerObj,
        useRouter: jest.fn(() => routerObj),
        useLocalSearchParams: jest.fn(() => ({})),
        useGlobalSearchParams: jest.fn(() => ({})),
        useSegments: jest.fn(() => []),
        useNavigationContainerRef: jest.fn(() => ({ current: null })),
        useFocusEffect: jest.fn((cb) => cb()),
        usePathname: jest.fn(() => '/'),
    };
});

// Mock expo-splash-screen (needed by root layout)
jest.mock('expo-splash-screen', () => ({
    preventAutoHideAsync: jest.fn(),
    hideAsync: jest.fn(),
}));

// Mock expo-font (needed by root layout)
jest.mock('expo-font', () => ({
    useFonts: jest.fn(() => [true, null]),
    isLoaded: jest.fn(() => true),
}));

// Mock @sentry/react-native
jest.mock('@sentry/react-native', () => ({
    init: jest.fn(),
    wrap: jest.fn((component) => component),
    captureException: jest.fn(),
    captureMessage: jest.fn(),
    setUser: jest.fn(),
    setTag: jest.fn(),
    addBreadcrumb: jest.fn(),
    withScope: jest.fn((cb) => cb({ setExtra: jest.fn(), setExtras: jest.fn() })),
    mobileReplayIntegration: jest.fn(() => ({ name: 'MobileReplay' })),
    reactNavigationIntegration: jest.fn(() => ({
        name: 'ReactNavigation',
        registerNavigationContainer: jest.fn(),
    })),
}));

// Mock expo-constants
jest.mock('expo-constants', () => ({
    expoConfig: { version: '1.0.0', extra: { eas: { projectId: 'test' } } },
}));

// Mock react-native-worklets (native module not available in test env)
jest.mock('react-native-worklets', () => ({
    createWorkletRuntime: jest.fn(),
    useWorklet: jest.fn(),
    isWorklet: jest.fn(() => false),
    isWorkletFunction: jest.fn(() => false),
    createSerializable: jest.fn((v) => v),
    createSharedValue: jest.fn((v) => ({ value: v })),
    serializableMappingCache: new WeakMap(),
    runOnUI: jest.fn((fn) => fn),
    runOnJS: jest.fn((fn) => fn),
    runOnRuntime: jest.fn((_, fn) => fn),
    scheduleOnUI: jest.fn((fn) => fn()),
    makeShareable: jest.fn((v) => v),
    RuntimeKind: { UI: 'UI', MAIN_JS: 'MAIN_JS' },
}));

// Mock react-native-reanimated (animation runtime not available in test env)
jest.mock('react-native-reanimated', () => {
    const actual = jest.requireActual('react-native-reanimated/mock');
    return {
        ...actual,
        useSharedValue: jest.fn((v) => ({ value: v })),
        useAnimatedStyle: jest.fn(() => ({})),
        useReducedMotion: jest.fn(() => false),
        withTiming: jest.fn((v) => v),
        withSpring: jest.fn((v) => v),
        withDelay: jest.fn((_, v) => v),
        runOnJS: jest.fn((fn) => fn),
        runOnUI: jest.fn((fn) => fn),
        // reanimated/mock omits Easing; useSheetAnimation reads Easing.out(Easing.cubic)
        // at module scope, so provide identity easings (withTiming ignores them anyway).
        Easing: {
            ...(actual.Easing || {}),
            linear: (t) => t,
            ease: (t) => t,
            quad: (t) => t,
            cubic: (t) => t,
            in: (fn) => fn || ((t) => t),
            out: (fn) => fn || ((t) => t),
            inOut: (fn) => fn || ((t) => t),
            bezier: () => (t) => t,
        },
    };
});

// Mock react-native-keyboard-controller (native module not available in test env)
jest.mock('react-native-keyboard-controller', () => {
    const { ScrollView, View } = require('react-native');
    return {
        KeyboardAwareScrollView: ScrollView,
        KeyboardProvider: View,
        KeyboardAvoidingView: View,
        KeyboardStickyView: View,
        KeyboardToolbar: View,
        useKeyboardHandler: jest.fn(),
        useKeyboardAnimation: jest.fn(() => ({ height: { value: 0 }, progress: { value: 0 } })),
    };
});

// Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => {
    const { View } = require('react-native');
    return {
        SafeAreaView: View,
        SafeAreaProvider: View,
        useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
    };
});

// Mock expo-image (virtual — package may not be installed in test env)
jest.mock('expo-image', () => ({ Image: 'ExpoImage' }), { virtual: true });

// Mock expo-av (native audio module not available in test env)
jest.mock('expo-av', () => ({
    Audio: {
        Sound: {
            createAsync: jest.fn().mockResolvedValue({
                sound: {
                    playAsync: jest.fn(),
                    pauseAsync: jest.fn(),
                    stopAsync: jest.fn(),
                    unloadAsync: jest.fn(),
                    setPositionAsync: jest.fn(),
                    getStatusAsync: jest.fn().mockResolvedValue({ isLoaded: false }),
                    setOnPlaybackStatusUpdate: jest.fn(),
                },
                status: { isLoaded: false },
            }),
        },
        setAudioModeAsync: jest.fn(),
    },
}));

// Mock react-native-vision-camera v5 (native camera not available in test env)
jest.mock('react-native-vision-camera', () => ({
    Camera: 'Camera',
    useCameraDevice: jest.fn(() => ({ id: 'mock' })),
    useCameraPermission: jest.fn(() => ({ hasPermission: true, requestPermission: jest.fn() })),
    usePhotoOutput: jest.fn(() => ({ capturePhotoToFile: jest.fn() })),
}));

// Mock native face detection module
jest.mock('./modules/face-detection/src', () => ({
    detectFaces: jest.fn().mockResolvedValue([]),
    convertToJpeg: jest.fn().mockResolvedValue('/tmp/mock.jpg'),
    setMaxBrightness: jest.fn(),
    restoreBrightness: jest.fn(),
}));

// Mock the MLKit face-detector plugin (nitro module — no native runtime in tests).
// Tests drive liveness by invoking the captured onFacesDetected callback.
jest.mock('react-native-vision-camera-face-detector', () => ({
    createFaceDetectorOutput: jest.fn((options) => ({
        __mockFaceDetectorOutput: true,
        __options: options,
    })),
}));

// Mock expo-asset
jest.mock('expo-asset', () => ({
    Asset: {
        fromModule: jest.fn(() => ({
            downloadAsync: jest.fn().mockResolvedValue(undefined),
            localUri: 'file:///mock/model.onnx',
        })),
    },
}));

// Mock react-native-nitro-image
jest.mock('react-native-nitro-image', () => ({
    loadImage: jest.fn().mockResolvedValue({
        width: 112,
        height: 112,
        crop: jest.fn().mockReturnThis(),
        resize: jest.fn().mockReturnThis(),
        toRawPixelData: jest.fn(() => ({
            buffer: new ArrayBuffer(112 * 112 * 4),
            width: 112,
            height: 112,
            pixelFormat: 'RGBA',
        })),
    }),
}));

// Mock expo-location
jest.mock('expo-location', () => ({
    requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
    getCurrentPositionAsync: jest.fn().mockResolvedValue({
        coords: { latitude: 0, longitude: 0, accuracy: 10, mocked: false },
        timestamp: Date.now(),
    }),
    Accuracy: { Lowest: 1, Low: 2, Balanced: 3, High: 6, Highest: 6, BestForNavigation: 6 },
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
}));

// Mock ThemeContext so components using useTheme() render without needing a
// ThemeProvider wrapper in each test. Uses jest.fn so individual tests can
// call `(useTheme as jest.Mock).mockReturnValue(...)` to override if needed.
// Tests that need the real impl call `jest.unmock('@/contexts/ThemeContext')`.
jest.mock('@/contexts/ThemeContext', () => {
    const React = require('react');
    const { View } = require('react-native');
    const { Colors } = jest.requireActual('@/constants/Colors');
    const defaultTheme = {
        mode: 'light',
        resolved: 'light',
        colors: Colors.light,
        setMode: jest.fn(),
        isDark: false,
    };
    return {
        ThemeProvider: ({ children }) => React.createElement(View, null, children),
        useTheme: jest.fn(() => defaultTheme),
    };
});
