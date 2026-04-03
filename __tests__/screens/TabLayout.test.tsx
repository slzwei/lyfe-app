/**
 * Tests for app/(tabs)/_layout.tsx — Tab visibility by role
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import TabLayout from '@/app/(tabs)/_layout';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useViewMode } from '@/contexts/ViewModeContext';
import { Colors } from '@/constants/Colors';

jest.mock('@/lib/supabase');
jest.mock('@/contexts/AuthContext');
jest.mock('@/contexts/ThemeContext');
jest.mock('@/contexts/ViewModeContext');
jest.mock('@/components/LiveEventBar', () => () => null);
jest.mock('@/components/OfflineBanner', () => () => null);

beforeEach(() => {
    jest.clearAllMocks();
    (useTheme as jest.Mock).mockReturnValue({
        colors: Colors.light,
        isDark: false,
        mode: 'light',
        resolved: 'light',
        setMode: jest.fn(),
    });
    (useViewMode as jest.Mock).mockReturnValue({
        viewMode: 'agent',
        canToggle: false,
        setViewMode: jest.fn(),
    });
});

function setupRole(role: string, viewMode: string = 'agent') {
    (useAuth as jest.Mock).mockReturnValue({
        user: { id: 'u1', role, full_name: 'Test', avatar_url: null },
        isLoading: false,
    });
    (useViewMode as jest.Mock).mockReturnValue({
        viewMode,
        canToggle: role === 'manager' || role === 'director',
        setViewMode: jest.fn(),
    });
}

describe('TabLayout', () => {
    it('renders tabs container for agent', () => {
        setupRole('agent');
        const { getByTestId } = render(<TabLayout />);
        expect(getByTestId('mock-tabs')).toBeTruthy();
    });

    it('renders tabs container for candidate', () => {
        setupRole('candidate');
        const { getByTestId } = render(<TabLayout />);
        expect(getByTestId('mock-tabs')).toBeTruthy();
    });

    it('renders tabs container for admin', () => {
        setupRole('admin');
        const { getByTestId } = render(<TabLayout />);
        expect(getByTestId('mock-tabs')).toBeTruthy();
    });

    it('renders tabs for manager in manager view', () => {
        setupRole('manager', 'manager');
        const { getByTestId } = render(<TabLayout />);
        expect(getByTestId('mock-tabs')).toBeTruthy();
    });

    it('renders tabs for manager in agent view', () => {
        setupRole('manager', 'agent');
        const { getByTestId } = render(<TabLayout />);
        expect(getByTestId('mock-tabs')).toBeTruthy();
    });

    it('renders tabs for PA', () => {
        setupRole('pa');
        const { getByTestId } = render(<TabLayout />);
        expect(getByTestId('mock-tabs')).toBeTruthy();
    });

    it('renders tabs for director', () => {
        setupRole('director', 'manager');
        const { getByTestId } = render(<TabLayout />);
        expect(getByTestId('mock-tabs')).toBeTruthy();
    });
});
