import { renderHook } from '@testing-library/react-native';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

jest.mock('@/lib/supabase', () => require('@/lib/__mocks__/supabase'));

describe('useNetworkStatus', () => {
    it('throws when used outside NetworkProvider', () => {
        expect(() => {
            renderHook(() => useNetworkStatus());
        }).toThrow('useNetworkStatus must be used within a NetworkProvider');
    });
});
