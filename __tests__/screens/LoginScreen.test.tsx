import React from 'react';
import { render } from '@testing-library/react-native';
import LoginScreen from '@/app/(auth)/login';

jest.mock('@/lib/supabase');

jest.mock('@/contexts/AuthContext', () => ({
    useAuth: () => ({
        signInWithOtp: jest.fn(),
        verifyOtp: jest.fn(),
        authenticateWithBiometrics: jest.fn(),
        biometricsEnabled: false,
    }),
}));

jest.mock('@/contexts/ThemeContext', () => ({
    useTheme: () => ({
        colors: {
            background: '#fff',
            text: '#000',
            textSecondary: '#666',
            border: '#ccc',
            card: '#f5f5f5',
        },
        theme: 'light',
    }),
}));

jest.mock('@/lib/biometrics', () => ({
    getBiometryType: jest.fn().mockResolvedValue('none'),
    biometricMeta: jest.fn().mockReturnValue({ label: '', icon: 'lock-closed' }),
}));

jest.mock('@/components/LyfeLogo', () => {
    const { View } = require('react-native');
    return () => <View testID="lyfe-logo" />;
});

describe('LoginScreen', () => {
    it('renders without crashing', () => {
        const tree = render(<LoginScreen />);
        expect(tree.toJSON()).toBeTruthy();
    });

    it('renders welcome text', () => {
        const { getByText } = render(<LoginScreen />);
        expect(getByText(/welcome back/i)).toBeTruthy();
    });
});
