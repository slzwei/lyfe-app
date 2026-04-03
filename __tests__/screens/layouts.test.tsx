/**
 * Batch render tests for layout files, small screens, and stubs.
 * Verifies every file renders without crashing under the global mock infrastructure.
 */
import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('@/lib/supabase');
jest.mock('@/contexts/AuthContext', () => ({
    useAuth: () => ({
        user: { id: 'u1', role: 'admin', full_name: 'Test Admin', avatar_url: null },
        isLoading: false,
        session: { access_token: 'test' },
        signOut: jest.fn(),
        biometricsEnabled: false,
        enableBiometrics: jest.fn(),
        disableBiometrics: jest.fn(),
        refreshUser: jest.fn(),
    }),
}));
jest.mock('@/contexts/ThemeContext', () => ({
    useTheme: () => ({
        colors: require('@/constants/Colors').Colors.light,
        isDark: false,
        mode: 'light',
        resolved: 'light',
        setMode: jest.fn(),
    }),
}));
jest.mock('@/contexts/ViewModeContext', () => ({
    useViewMode: () => ({ viewMode: 'agent', canToggle: false, setViewMode: jest.fn() }),
}));
jest.mock('@/contexts/NotificationContext', () => ({
    useNotifications: () => ({ unreadCount: 0 }),
}));
jest.mock('@/components/ScreenHeader', () => {
    const { Text } = require('react-native');
    return ({ title }: any) => <Text>{title}</Text>;
});

// ── Tab-specific layout files (with useRequireRole) ──

describe('Tab layout files render without crashing', () => {
    it('admin/_layout.tsx', () => {
        const C = require('@/app/(tabs)/admin/_layout').default;
        expect(render(<C />).toJSON()).toBeTruthy();
    });

    it('candidates/_layout.tsx', () => {
        const C = require('@/app/(tabs)/candidates/_layout').default;
        expect(render(<C />).toJSON()).toBeTruthy();
    });

    it('leads/_layout.tsx', () => {
        const C = require('@/app/(tabs)/leads/_layout').default;
        expect(render(<C />).toJSON()).toBeTruthy();
    });

    it('pa/_layout.tsx', () => {
        const C = require('@/app/(tabs)/pa/_layout').default;
        expect(render(<C />).toJSON()).toBeTruthy();
    });

    it('roadmap/_layout.tsx (returns null for non-candidate)', () => {
        const C = require('@/app/(tabs)/roadmap/_layout').default;
        // Roadmap requires 'candidate' role — admin gets null (redirect to home)
        const tree = render(<C />);
        expect(tree.toJSON()).toBeNull();
    });

    it('team/_layout.tsx', () => {
        const C = require('@/app/(tabs)/team/_layout').default;
        expect(render(<C />).toJSON()).toBeTruthy();
    });

    it('events/_layout.tsx', () => {
        const C = require('@/app/(tabs)/events/_layout').default;
        expect(render(<C />).toJSON()).toBeTruthy();
    });

    it('exams/_layout.tsx', () => {
        const C = require('@/app/(tabs)/exams/_layout').default;
        expect(render(<C />).toJSON()).toBeTruthy();
    });

    it('home/_layout.tsx', () => {
        const C = require('@/app/(tabs)/home/_layout').default;
        expect(render(<C />).toJSON()).toBeTruthy();
    });

    it('profile/_layout.tsx', () => {
        const C = require('@/app/(tabs)/profile/_layout').default;
        expect(render(<C />).toJSON()).toBeTruthy();
    });

    it('(auth)/_layout.tsx', () => {
        const C = require('@/app/(auth)/_layout').default;
        expect(render(<C />).toJSON()).toBeTruthy();
    });

    it('onboarding/_layout.tsx', () => {
        const C = require('@/app/onboarding/_layout').default;
        expect(render(<C />).toJSON()).toBeTruthy();
    });
});

// ── Small screens and stubs at 0% ──

describe('Small screens render without crashing', () => {
    it('app/+not-found.tsx', () => {
        const C = require('@/app/+not-found').default;
        expect(render(<C />).toJSON()).toBeTruthy();
    });

    it('admin/index.tsx', () => {
        const C = require('@/app/(tabs)/admin/index').default;
        expect(render(<C />).toJSON()).toBeTruthy();
    });

    it('exams/study.tsx', () => {
        const C = require('@/app/(tabs)/exams/study').default;
        expect(render(<C />).toJSON()).toBeTruthy();
    });

    it('profile/privacy.tsx', () => {
        const C = require('@/app/(tabs)/profile/privacy').default;
        expect(render(<C />).toJSON()).toBeTruthy();
    });

    it('profile/terms.tsx', () => {
        const C = require('@/app/(tabs)/profile/terms').default;
        expect(render(<C />).toJSON()).toBeTruthy();
    });
});
