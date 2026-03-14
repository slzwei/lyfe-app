import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import AppErrorBoundary, { AppErrorBoundaryInner } from '@/components/AppErrorBoundary';
import { Sentry } from '@/lib/sentry';
import { Colors } from '@/constants/Colors';
import { Text } from 'react-native';

jest.mock('@/lib/sentry', () => ({
    Sentry: {
        captureException: jest.fn(),
        withScope: jest.fn((cb: any) => cb({ setExtra: jest.fn() })),
    },
}));

jest.mock('@/contexts/ThemeContext', () => {
    const mockColors = require('@/constants/Colors').Colors;
    return {
        useTheme: () => ({
            colors: mockColors.light,
            isDark: false,
            mode: 'light',
            resolved: 'light',
            setMode: jest.fn(),
        }),
    };
});

// Component that throws on demand
function Bomb({ shouldThrow }: { shouldThrow: boolean }) {
    if (shouldThrow) throw new Error('Boom');
    return <Text>Child rendered</Text>;
}

beforeEach(() => jest.clearAllMocks());

describe('AppErrorBoundary', () => {
    it('renders children when no error', () => {
        const { getByText } = render(
            <AppErrorBoundary>
                <Bomb shouldThrow={false} />
            </AppErrorBoundary>,
        );
        expect(getByText('Child rendered')).toBeTruthy();
    });

    it('shows fallback UI when child throws', () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        const { getByText } = render(
            <AppErrorBoundary>
                <Bomb shouldThrow={true} />
            </AppErrorBoundary>,
        );
        expect(getByText('Something went wrong')).toBeTruthy();
        expect(getByText('Try Again')).toBeTruthy();
        consoleSpy.mockRestore();
    });

    it('calls Sentry.captureException on error', () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        render(
            <AppErrorBoundary>
                <Bomb shouldThrow={true} />
            </AppErrorBoundary>,
        );
        expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error));
        consoleSpy.mockRestore();
    });

    it('recovers when Try Again is pressed', () => {
        let shouldThrow = true;
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

        function DynamicBomb() {
            if (shouldThrow) throw new Error('Boom');
            return <Text>Recovered</Text>;
        }

        const { getByText } = render(
            <AppErrorBoundary>
                <DynamicBomb />
            </AppErrorBoundary>,
        );
        expect(getByText('Something went wrong')).toBeTruthy();

        shouldThrow = false;
        fireEvent.press(getByText('Try Again'));
        expect(getByText('Recovered')).toBeTruthy();
        consoleSpy.mockRestore();
    });
});

describe('AppErrorBoundaryInner with theme colors', () => {
    it('uses light theme colors for fallback UI', () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        const { getByText } = render(
            <AppErrorBoundaryInner colors={Colors.light}>
                <Bomb shouldThrow={true} />
            </AppErrorBoundaryInner>,
        );
        expect(getByText('Something went wrong')).toBeTruthy();
        consoleSpy.mockRestore();
    });

    it('uses dark theme colors for fallback UI', () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
        const { getByText } = render(
            <AppErrorBoundaryInner colors={Colors.dark}>
                <Bomb shouldThrow={true} />
            </AppErrorBoundaryInner>,
        );
        expect(getByText('Something went wrong')).toBeTruthy();
        expect(getByText('Try Again')).toBeTruthy();
        consoleSpy.mockRestore();
    });

    it('renders children when no error with dark colors', () => {
        const { getByText } = render(
            <AppErrorBoundaryInner colors={Colors.dark}>
                <Bomb shouldThrow={false} />
            </AppErrorBoundaryInner>,
        );
        expect(getByText('Child rendered')).toBeTruthy();
    });
});
