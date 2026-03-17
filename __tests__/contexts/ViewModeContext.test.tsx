/**
 * Tests for contexts/ViewModeContext.tsx — View mode provider and hook
 */
import React from 'react';
import { renderHook, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock AuthContext — useAuth returns the user we configure
let mockUser: any = null;
jest.mock('@/contexts/AuthContext', () => ({
    useAuth: () => ({ user: mockUser }),
}));

import { ViewModeProvider, useViewMode } from '@/contexts/ViewModeContext';

const wrapper = ({ children }: { children: React.ReactNode }) => <ViewModeProvider>{children}</ViewModeProvider>;

beforeEach(() => {
    jest.clearAllMocks();
    mockUser = null;
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
});

describe('ViewModeContext', () => {
    it('manager defaults to manager view mode', async () => {
        mockUser = { role: 'manager' };
        const { result } = renderHook(() => useViewMode(), { wrapper });
        await act(async () => {});

        expect(result.current.viewMode).toBe('manager');
        expect(result.current.canToggle).toBe(true);
        expect(result.current.isReady).toBe(true);
    });

    it('director can toggle view modes', async () => {
        mockUser = { role: 'director' };
        const { result } = renderHook(() => useViewMode(), { wrapper });
        await act(async () => {});

        expect(result.current.canToggle).toBe(true);
        expect(result.current.viewMode).toBe('manager');
    });

    it('agent is always in agent mode and cannot toggle', async () => {
        mockUser = { role: 'agent' };
        const { result } = renderHook(() => useViewMode(), { wrapper });
        await act(async () => {});

        expect(result.current.viewMode).toBe('agent');
        expect(result.current.canToggle).toBe(false);
    });

    it('PA cannot toggle', async () => {
        mockUser = { role: 'pa' };
        const { result } = renderHook(() => useViewMode(), { wrapper });
        await act(async () => {});

        expect(result.current.viewMode).toBe('agent');
        expect(result.current.canToggle).toBe(false);
    });

    it('candidate cannot toggle', async () => {
        mockUser = { role: 'candidate' };
        const { result } = renderHook(() => useViewMode(), { wrapper });
        await act(async () => {});

        expect(result.current.canToggle).toBe(false);
    });

    it('null user defaults to agent mode', async () => {
        mockUser = null;
        const { result } = renderHook(() => useViewMode(), { wrapper });
        await act(async () => {});

        expect(result.current.viewMode).toBe('agent');
        expect(result.current.canToggle).toBe(false);
    });

    it('loads saved view mode from AsyncStorage for toggleable role', async () => {
        mockUser = { role: 'manager' };
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue('agent');
        const { result } = renderHook(() => useViewMode(), { wrapper });
        await act(async () => {});

        expect(result.current.viewMode).toBe('agent');
    });

    it('saved view mode ignored for non-toggleable role', async () => {
        mockUser = { role: 'agent' };
        (AsyncStorage.getItem as jest.Mock).mockResolvedValue('manager');
        const { result } = renderHook(() => useViewMode(), { wrapper });
        await act(async () => {});

        // Agent can't toggle, so always 'agent' regardless of stored value
        expect(result.current.viewMode).toBe('agent');
    });

    it('setViewMode persists to AsyncStorage', async () => {
        mockUser = { role: 'manager' };
        const { result } = renderHook(() => useViewMode(), { wrapper });
        await act(async () => {});

        await act(async () => {
            result.current.setViewMode('agent');
        });

        expect(result.current.viewMode).toBe('agent');
        expect(AsyncStorage.setItem).toHaveBeenCalledWith('lyfe_view_mode', 'agent');
    });

    it('throws when useViewMode is used outside provider', () => {
        expect(() => {
            renderHook(() => useViewMode());
        }).toThrow('useViewMode must be used within a ViewModeProvider');
    });
});
