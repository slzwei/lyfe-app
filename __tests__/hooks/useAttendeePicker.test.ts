import { renderHook, act, waitFor } from '@testing-library/react-native';
import { useAttendeePicker } from '@/hooks/useAttendeePicker';
import { fetchAllUsers } from '@/lib/events';

jest.mock('@/lib/supabase');
jest.mock('@/lib/events', () => ({
    fetchAllUsers: jest.fn().mockResolvedValue({
        data: [
            { id: 'u1', full_name: 'Alice Wong', role: 'agent', avatar_url: null },
            { id: 'u2', full_name: 'Bob Tan', role: 'manager', avatar_url: null },
            { id: 'u3', full_name: 'Carol Lim', role: 'candidate', avatar_url: null },
        ],
        error: null,
    }),
}));

describe('useAttendeePicker', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('loads users on mount', async () => {
        const { result } = renderHook(() => useAttendeePicker());
        await waitFor(() => expect(result.current.loadingUsers).toBe(false));
        expect(result.current.filteredUsers).toHaveLength(3);
    });

    it('passes the current user id to the scoped user loader', async () => {
        const { result } = renderHook(() => useAttendeePicker('training', 'user-1'));
        await waitFor(() => expect(result.current.loadingUsers).toBe(false));
        expect(fetchAllUsers).toHaveBeenCalledWith('user-1');
    });

    it('toggleAttendee adds and removes', async () => {
        const { result } = renderHook(() => useAttendeePicker());
        await waitFor(() => expect(result.current.loadingUsers).toBe(false));

        const user = { id: 'u1', full_name: 'Alice Wong', role: 'agent', avatar_url: null };
        act(() => result.current.toggleAttendee(user));
        expect(result.current.selectedAttendees).toHaveLength(1);
        expect(result.current.selectedAttendees[0].user_id).toBe('u1');

        act(() => result.current.toggleAttendee(user));
        expect(result.current.selectedAttendees).toHaveLength(0);
    });

    it('updateAttendeeRole changes role', async () => {
        const { result } = renderHook(() => useAttendeePicker());
        await waitFor(() => expect(result.current.loadingUsers).toBe(false));

        const user = { id: 'u1', full_name: 'Alice Wong', role: 'agent', avatar_url: null };
        act(() => result.current.toggleAttendee(user));
        act(() => result.current.updateAttendeeRole('u1', 'host'));
        expect(result.current.selectedAttendees[0].attendee_role).toBe('host');
    });

    it('filters users by search', async () => {
        const { result } = renderHook(() => useAttendeePicker());
        await waitFor(() => expect(result.current.loadingUsers).toBe(false));

        act(() => result.current.setUserSearch('alice'));
        expect(result.current.filteredUsers).toHaveLength(1);
        expect(result.current.filteredUsers[0].full_name).toBe('Alice Wong');
    });

    it('addExternal adds external attendee', () => {
        const { result } = renderHook(() => useAttendeePicker());
        act(() => {
            result.current.setExternalName('Guest');
            result.current.setExternalRole('attendee');
        });
        act(() => result.current.addExternal());
        expect(result.current.externalAttendees).toHaveLength(1);
        expect(result.current.externalAttendees[0].name).toBe('Guest');
        expect(result.current.externalName).toBe('');
    });

    it('removeExternal removes by key', () => {
        const { result } = renderHook(() => useAttendeePicker());
        act(() => {
            result.current.setExternalName('Guest');
        });
        act(() => result.current.addExternal());
        const key = result.current.externalAttendees[0]._key;
        act(() => result.current.removeExternal(key));
        expect(result.current.externalAttendees).toHaveLength(0);
    });

    it('hides candidates from the team list when eventType is roadshow', async () => {
        const { result } = renderHook(() => useAttendeePicker('roadshow'));
        await waitFor(() => expect(result.current.loadingUsers).toBe(false));
        expect(result.current.filteredUsers).toHaveLength(2);
        expect(result.current.filteredUsers.map((u) => u.role)).not.toContain('candidate');
    });

    it('shows candidates for non-roadshow event types', async () => {
        const { result } = renderHook(() => useAttendeePicker('training'));
        await waitFor(() => expect(result.current.loadingUsers).toBe(false));
        expect(result.current.filteredUsers).toHaveLength(3);
        expect(result.current.filteredUsers.map((u) => u.role)).toContain('candidate');
    });

    it('drops already-selected candidates when eventType flips to roadshow', async () => {
        const { result, rerender } = renderHook(({ type }) => useAttendeePicker(type), {
            initialProps: { type: 'training' as string },
        });
        await waitFor(() => expect(result.current.loadingUsers).toBe(false));

        const candidate = { id: 'u3', full_name: 'Carol Lim', role: 'candidate', avatar_url: null };
        const agent = { id: 'u1', full_name: 'Alice Wong', role: 'agent', avatar_url: null };
        act(() => {
            result.current.toggleAttendee(candidate);
            result.current.toggleAttendee(agent);
        });
        expect(result.current.selectedAttendees).toHaveLength(2);

        rerender({ type: 'roadshow' });
        await waitFor(() => expect(result.current.selectedAttendees.map((a) => a.user_id)).toEqual(['u1']));
    });
});
