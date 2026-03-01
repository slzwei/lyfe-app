import type { UserRole } from '@/constants/Roles';
import { useAuth } from '@/contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type ViewMode = 'agent' | 'manager';

interface ViewModeContextType {
    /** Current view mode — 'agent' or 'manager' */
    viewMode: ViewMode;
    /** Whether the current user can toggle between modes */
    canToggle: boolean;
    /** Switch view mode (persists to AsyncStorage) */
    setViewMode: (mode: ViewMode) => void;
    /** Whether context is ready (AsyncStorage loaded) */
    isReady: boolean;
}

const VIEW_MODE_STORAGE_KEY = 'lyfe_view_mode';

/** Roles that can toggle between Agent and Manager view */
const TOGGLEABLE_ROLES: UserRole[] = ['manager', 'director'];

const ViewModeContext = createContext<ViewModeContextType | undefined>(undefined);

export function ViewModeProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const [storedMode, setStoredMode] = useState<ViewMode | null>(null);
    const [isReady, setIsReady] = useState(false);

    const role = user?.role as UserRole | undefined;
    const canToggle = !!role && TOGGLEABLE_ROLES.includes(role);

    // Load saved view mode on mount
    useEffect(() => {
        AsyncStorage.getItem(VIEW_MODE_STORAGE_KEY).then((saved) => {
            if (saved === 'agent' || saved === 'manager') {
                setStoredMode(saved);
            }
            setIsReady(true);
        });
    }, []);

    // Resolve effective view mode:
    // - If user can't toggle, they don't have a viewMode (agents are always 'agent'-like)
    // - If stored mode is invalid for this role, default to 'manager'
    const viewMode: ViewMode = canToggle
        ? (storedMode || 'manager')
        : 'agent';

    const setViewMode = useCallback((newMode: ViewMode) => {
        setStoredMode(newMode);
        AsyncStorage.setItem(VIEW_MODE_STORAGE_KEY, newMode);
    }, []);

    if (!isReady) return null;

    return (
        <ViewModeContext.Provider value={{ viewMode, canToggle, setViewMode, isReady }}>
            {children}
        </ViewModeContext.Provider>
    );
}

export function useViewMode() {
    const context = useContext(ViewModeContext);
    if (!context) {
        throw new Error('useViewMode must be used within a ViewModeProvider');
    }
    return context;
}

/** Static helper to clear view mode on sign-out */
export async function clearViewModeStorage() {
    await AsyncStorage.removeItem(VIEW_MODE_STORAGE_KEY);
}
