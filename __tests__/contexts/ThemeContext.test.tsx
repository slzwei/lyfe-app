/**
 * Tests for contexts/ThemeContext.tsx — Theme provider and hook
 */
// This test exercises the REAL ThemeContext; undo the global jest.setup mock.
import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';

import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { Colors } from '@/constants/Colors';

jest.unmock('@/contexts/ThemeContext');

// Mock just useColorScheme via jest.spyOn isn't feasible for RN hooks,
// so we mock the specific hook module
let mockSystemScheme: 'light' | 'dark' | null = 'light';
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
    __esModule: true,
    default: () => mockSystemScheme,
}));

const wrapper = ({ children }: { children: React.ReactNode }) => <ThemeProvider>{children}</ThemeProvider>;

beforeEach(() => {
    jest.clearAllMocks();
    mockSystemScheme = 'light';
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
});

describe('ThemeContext', () => {
    it('defaults to system mode (light)', async () => {
        const { result } = renderHook(() => useTheme(), { wrapper });
        await act(async () => {});

        expect(result.current.mode).toBe('system');
        expect(result.current.resolved).toBe('light');
        expect(result.current.isDark).toBe(false);
        expect(result.current.colors).toBe(Colors.light);
    });

    it('resolves to dark when system scheme is dark', async () => {
        mockSystemScheme = 'dark';
        const { result } = renderHook(() => useTheme(), { wrapper });
        await act(async () => {});

        expect(result.current.mode).toBe('system');
        expect(result.current.resolved).toBe('dark');
        expect(result.current.isDark).toBe(true);
        expect(result.current.colors).toBe(Colors.dark);
    });

    it('loads saved theme preference from AsyncStorage', async () => {
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue('dark');
        const { result } = renderHook(() => useTheme(), { wrapper });
        await act(async () => {});

        expect(result.current.mode).toBe('dark');
        expect(result.current.resolved).toBe('dark');
        expect(result.current.isDark).toBe(true);
    });

    it('setMode persists to AsyncStorage and updates state', async () => {
        const { result } = renderHook(() => useTheme(), { wrapper });
        await act(async () => {});

        await act(async () => {
            result.current.setMode('dark');
        });

        expect(result.current.mode).toBe('dark');
        expect(result.current.resolved).toBe('dark');
        expect(result.current.colors).toBe(Colors.dark);
        expect(AsyncStorage.setItem).toHaveBeenCalledWith('lyfe_theme_mode', 'dark');
    });

    it('explicit light mode ignores system dark scheme', async () => {
        mockSystemScheme = 'dark';
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue('light');
        const { result } = renderHook(() => useTheme(), { wrapper });
        await act(async () => {});

        expect(result.current.mode).toBe('light');
        expect(result.current.resolved).toBe('light');
        expect(result.current.isDark).toBe(false);
    });

    it('ignores invalid saved theme values', async () => {
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue('invalid');
        const { result } = renderHook(() => useTheme(), { wrapper });
        await act(async () => {});

        expect(result.current.mode).toBe('system');
    });

    it('throws when useTheme is used outside provider', () => {
        expect(() => {
            renderHook(() => useTheme());
        }).toThrow('useTheme must be used within a ThemeProvider');
    });
});
