import { useAuth } from '@/contexts/AuthContext';
import type { UserRole } from '@/constants/Roles';
import { router } from 'expo-router';
import { useEffect } from 'react';

/**
 * Redirects to home if the current user's role is not in the allowed list.
 * Prevents unauthorized access via deep links to role-restricted tabs.
 * Returns true once the user is confirmed authorized.
 */
export function useRequireRole(...allowedRoles: UserRole[]): boolean {
    const { user, isLoading } = useAuth();
    const role = user?.role as UserRole | undefined;
    const authorized = !!role && allowedRoles.includes(role);

    useEffect(() => {
        if (!isLoading && user && !authorized) {
            router.replace('/(tabs)/home');
        }
    }, [isLoading, user, authorized]);

    return authorized || isLoading;
}
