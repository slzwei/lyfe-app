/**
 * Tests for app/(tabs)/profile/index.tsx — Profile screen
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import ProfileScreen from '@/app/(tabs)/profile/index';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useViewMode } from '@/contexts/ViewModeContext';
import { Colors } from '@/constants/Colors';
import { getBiometryType } from '@/lib/biometrics';
import { fetchPAManagers } from '@/lib/recruitment';

jest.mock('@/lib/supabase');
jest.mock('@/contexts/AuthContext');
jest.mock('@/contexts/ThemeContext');
jest.mock('@/contexts/ViewModeContext');
jest.mock('@/lib/biometrics');
jest.mock('@/lib/recruitment');
jest.mock('@/lib/storage');
jest.mock('@/hooks/useSubmitGuard', () => ({
    useSubmitGuard: () => ({
        isSubmitting: false,
        guard: (fn: () => Promise<void>) => fn(),
    }),
}));

// Mock child components to keep tests focused
jest.mock('@/components/ScreenHeader', () => {
    const { Text } = require('react-native');
    return function MockScreenHeader({ title }: { title: string }) {
        return <Text>{title}</Text>;
    };
});
jest.mock('@/components/LyfeLogo', () => {
    const { View } = require('react-native');
    return () => <View testID="lyfe-logo" />;
});
jest.mock('@/components/profile/UserHeroCard', () => {
    const { Text } = require('react-native');
    return function MockUserHeroCard({ user }: { user: any }) {
        return <Text>User: {user?.full_name}</Text>;
    };
});
jest.mock('@/components/profile/AppearanceCard', () => {
    const { Text } = require('react-native');
    return function MockAppearanceCard() {
        return <Text>Appearance</Text>;
    };
});
jest.mock('@/components/profile/SecurityCard', () => {
    const { Text } = require('react-native');
    return function MockSecurityCard() {
        return <Text>Security</Text>;
    };
});
jest.mock('@/components/profile/SettingsListCard', () => {
    const { View, Text, TouchableOpacity } = require('react-native');
    return function MockSettingsListCard({ rows, onPress }: any) {
        return (
            <View>
                {rows.map((r: any) => (
                    <TouchableOpacity key={r.key} onPress={() => onPress?.(r.key)}>
                        <Text>{r.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>
        );
    };
});
jest.mock('@/components/profile/ViewModeCard', () => {
    const { Text } = require('react-native');
    return function MockViewModeCard() {
        return <Text>View Mode</Text>;
    };
});
jest.mock('@/components/profile/AssignedManagersCard', () => {
    const { Text } = require('react-native');
    return function MockAssignedManagersCard() {
        return <Text>Assigned Managers</Text>;
    };
});
jest.mock('@/components/profile/PersonalityQuizzesCard', () => {
    const { Text } = require('react-native');
    return function MockPersonalityQuizzesCard() {
        return <Text>Personality Quizzes</Text>;
    };
});
jest.mock('@/components/profile/SignOutModal', () => {
    return function MockSignOutModal() {
        return null;
    };
});
jest.mock('@/components/profile/DeleteAccountModal', () => {
    return function MockDeleteAccountModal() {
        return null;
    };
});
jest.mock('@/components/profile/AvatarPickerSheet', () => {
    return function MockAvatarPickerSheet() {
        return null;
    };
});
jest.mock('@/components/profile/EditProfileSheet', () => {
    return function MockEditProfileSheet() {
        return null;
    };
});
jest.mock('@/components/ErrorBanner', () => {
    const { Text } = require('react-native');
    return function MockErrorBanner({ message }: { message: string }) {
        return <Text>{message}</Text>;
    };
});

const mockPush = jest.fn();
jest.mock('@/hooks/useTypedRouter', () => ({
    useTypedRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
}));
jest.mock('expo-router', () => ({
    ...jest.requireActual('expo-router'),
    useFocusEffect: (cb: () => void) => {
        const React = require('react');
        React.useEffect(() => {
            cb();
        }, []);
    },
}));

beforeEach(() => {
    jest.clearAllMocks();
    (useTheme as jest.Mock).mockReturnValue({
        colors: Colors.light,
        isDark: false,
        mode: 'light',
        resolved: 'light',
        setMode: jest.fn(),
    });
    (useAuth as jest.Mock).mockReturnValue({
        user: { id: 'user-1', full_name: 'John Doe', role: 'agent', avatar_url: null, phone: '+6591234567' },
        signOut: jest.fn(),
        biometricsEnabled: false,
        enableBiometrics: jest.fn(),
        disableBiometrics: jest.fn(),
        updateAvatarUrl: jest.fn(),
        updateProfile: jest.fn(),
    });
    (useViewMode as jest.Mock).mockReturnValue({
        viewMode: 'agent',
        canToggle: false,
        setViewMode: jest.fn(),
    });
    (getBiometryType as jest.Mock).mockResolvedValue('none');
    (fetchPAManagers as jest.Mock).mockResolvedValue([]);
});

describe('ProfileScreen', () => {
    it('renders general settings', async () => {
        const { getByText } = render(<ProfileScreen />);
        await waitFor(() => {
            expect(getByText('Edit Profile')).toBeTruthy();
            expect(getByText('Notifications')).toBeTruthy();
            expect(getByText('Privacy')).toBeTruthy();
        });
    });

    it('renders appearance card', async () => {
        const { getByText } = render(<ProfileScreen />);
        await waitFor(() => {
            expect(getByText('Appearance')).toBeTruthy();
        });
    });

    it('renders view mode card for managers', async () => {
        (useAuth as jest.Mock).mockReturnValue({
            user: { id: 'user-1', full_name: 'Manager', role: 'manager', avatar_url: null },
            signOut: jest.fn(),
            biometricsEnabled: false,
            enableBiometrics: jest.fn(),
            disableBiometrics: jest.fn(),
            updateAvatarUrl: jest.fn(),
            updateProfile: jest.fn(),
        });
        (useViewMode as jest.Mock).mockReturnValue({
            viewMode: 'manager',
            canToggle: true,
            setViewMode: jest.fn(),
        });

        const { getByText } = render(<ProfileScreen />);
        await waitFor(() => {
            expect(getByText('View Mode')).toBeTruthy();
        });
    });

    it('renders sign out button', async () => {
        const { getByText } = render(<ProfileScreen />);
        await waitFor(() => {
            expect(getByText('Sign Out')).toBeTruthy();
        });
    });

    it('renders support settings', async () => {
        const { getByText } = render(<ProfileScreen />);
        await waitFor(() => {
            expect(getByText('Terms of Service')).toBeTruthy();
        });
    });

    it('navigates to notifications on settings press', async () => {
        const { getByText } = render(<ProfileScreen />);
        await waitFor(() => {
            fireEvent.press(getByText('Notifications'));
        });
        expect(mockPush).toHaveBeenCalled();
    });
});
