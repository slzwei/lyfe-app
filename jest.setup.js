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

// Mock react-native-vision-camera (native camera not available in test env)
jest.mock('react-native-vision-camera', () => ({
    Camera: 'Camera',
    useCameraDevice: jest.fn(() => ({ id: 'mock' })),
    useCameraPermission: jest.fn(() => ({ hasPermission: true, requestPermission: jest.fn() })),
}));

// Mock react-native-vision-camera-face-detector
jest.mock('react-native-vision-camera-face-detector', () => ({
    useFaceDetector: jest.fn(() => ({ detectFaces: jest.fn(() => []) })),
}));

// Mock onnxruntime-react-native
jest.mock('onnxruntime-react-native', () => ({
    InferenceSession: { create: jest.fn() },
    Tensor: jest.fn(),
}));

// Mock expo-location
jest.mock('expo-location', () => ({
    requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
    getCurrentPositionAsync: jest.fn().mockResolvedValue({ coords: { latitude: 0, longitude: 0 } }),
    Accuracy: { High: 6 },
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
}));
