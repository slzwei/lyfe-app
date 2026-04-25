import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { Colors } from '@/constants/Colors';
import AgencyInfoScreen from '@/app/onboarding/AgencyInfo';

jest.mock('@/lib/supabase');
jest.mock('@/contexts/ThemeContext');

const mockPush = jest.fn();

beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({
        push: mockPush,
        replace: jest.fn(),
        back: jest.fn(),
    });
    (useTheme as jest.Mock).mockReturnValue({
        colors: Colors.light,
        isDark: false,
        mode: 'light',
        resolved: 'light',
        setMode: jest.fn(),
    });
});

describe('AgencyInfoScreen', () => {
    it('renders without crashing', () => {
        const { getByText } = render(<AgencyInfoScreen />);
        expect(getByText('inside.')).toBeTruthy();
    });

    it('shows subtitle', () => {
        const { getByText } = render(<AgencyInfoScreen />);
        expect(getByText(/Everything you need to grow your insurance career/)).toBeTruthy();
    });

    it('shows Training Roadmap feature', () => {
        const { getByText } = render(<AgencyInfoScreen />);
        expect(getByText('Training roadmap')).toBeTruthy();
        expect(getByText('Structured learning paths to build your skills')).toBeTruthy();
    });

    it('shows Events feature', () => {
        const { getByText } = render(<AgencyInfoScreen />);
        expect(getByText('Events')).toBeTruthy();
        expect(getByText('Browse workshops, roadshows, and networking events')).toBeTruthy();
    });

    it('shows Exam Preparation feature', () => {
        const { getByText } = render(<AgencyInfoScreen />);
        expect(getByText('Exam preparation')).toBeTruthy();
        expect(getByText('Track your exam progress and certifications')).toBeTruthy();
    });

    it('shows Team feature', () => {
        const { getByText } = render(<AgencyInfoScreen />);
        expect(getByText('Team')).toBeTruthy();
        expect(getByText('Connect with managers and fellow professionals')).toBeTruthy();
    });

    it('shows the continue button', () => {
        const { getByTestId } = render(<AgencyInfoScreen />);
        expect(getByTestId('continue-button')).toBeTruthy();
    });

    it('navigates to OnboardingComplete on continue press', () => {
        const { getByTestId } = render(<AgencyInfoScreen />);
        fireEvent.press(getByTestId('continue-button'));
        expect(mockPush).toHaveBeenCalledWith('/onboarding/OnboardingComplete');
    });
});
