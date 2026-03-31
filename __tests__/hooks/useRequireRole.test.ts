import { renderHook } from '@testing-library/react-native';
import { useRequireRole } from '@/hooks/useRequireRole';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
    router: { replace: (...args: any[]) => mockReplace(...args) },
}));

const mockUseAuth = jest.fn();
jest.mock('@/contexts/AuthContext', () => ({
    useAuth: () => mockUseAuth(),
}));

beforeEach(() => {
    jest.clearAllMocks();
});

describe('useRequireRole', () => {
    it('returns true while auth is loading', () => {
        mockUseAuth.mockReturnValue({ user: null, isLoading: true });
        const { result } = renderHook(() => useRequireRole('admin', 'manager'));
        expect(result.current).toBe(true); // don't block render while loading
        expect(mockReplace).not.toHaveBeenCalled();
    });

    it('returns true when user has an allowed role', () => {
        mockUseAuth.mockReturnValue({ user: { id: 'u1', role: 'admin' }, isLoading: false });
        const { result } = renderHook(() => useRequireRole('admin', 'manager'));
        expect(result.current).toBe(true);
        expect(mockReplace).not.toHaveBeenCalled();
    });

    it('redirects to home when user has unauthorized role', () => {
        mockUseAuth.mockReturnValue({ user: { id: 'u1', role: 'candidate' }, isLoading: false });
        const { result } = renderHook(() => useRequireRole('admin', 'manager'));
        expect(result.current).toBe(false);
        expect(mockReplace).toHaveBeenCalledWith('/(tabs)/home');
    });

    it('redirects when user is agent but only admin/manager allowed', () => {
        mockUseAuth.mockReturnValue({ user: { id: 'u1', role: 'agent' }, isLoading: false });
        const { result } = renderHook(() => useRequireRole('admin', 'manager', 'director'));
        expect(result.current).toBe(false);
        expect(mockReplace).toHaveBeenCalledWith('/(tabs)/home');
    });

    it('does not redirect when user is null (not logged in yet)', () => {
        mockUseAuth.mockReturnValue({ user: null, isLoading: false });
        const { result } = renderHook(() => useRequireRole('admin'));
        // user is null but isLoading is false — no redirect (auth gate handles this)
        expect(result.current).toBe(false);
        expect(mockReplace).not.toHaveBeenCalled();
    });

    it('allows PA role when PA is in allowed list', () => {
        mockUseAuth.mockReturnValue({ user: { id: 'u1', role: 'pa' }, isLoading: false });
        const { result } = renderHook(() => useRequireRole('pa', 'admin'));
        expect(result.current).toBe(true);
        expect(mockReplace).not.toHaveBeenCalled();
    });
});
