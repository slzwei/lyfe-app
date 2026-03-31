import { renderHook, act } from '@testing-library/react-native';
import { AppState, Linking } from 'react-native';
import { useContactOutcome } from '@/hooks/useContactOutcome';

jest.mock('@/lib/supabase');
jest.mock('@/lib/recruitment', () => ({
    addCandidateActivity: jest.fn().mockResolvedValue({ error: null }),
}));

const { addCandidateActivity } = require('@/lib/recruitment');

const defaultParams = {
    candidateId: 'c1',
    candidateName: 'John Doe',
    candidatePhone: '+6591234567',
    userId: 'u1',
    userName: 'Manager Smith',
    onActivityLogged: jest.fn(),
};

describe('useContactOutcome', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('initializes with default state', () => {
        const { result } = renderHook(() => useContactOutcome(defaultParams));
        expect(result.current.pendingType).toBeNull();
        expect(result.current.showConfirmSheet).toBe(false);
        expect(result.current.confirmStep).toBe('outcome');
        expect(result.current.selectedOutcome).toBeNull();
        expect(result.current.noteText).toBe('');
    });

    it('handleCall opens phone link', () => {
        const linkingSpy = jest.spyOn(Linking, 'openURL').mockImplementation(() => Promise.resolve(true));
        const { result } = renderHook(() => useContactOutcome(defaultParams));

        act(() => result.current.handleCall());

        expect(linkingSpy).toHaveBeenCalledWith('tel:+6591234567');
        expect(result.current.pendingType).toBe('call');
    });

    it('handleWhatsApp opens WhatsApp link', () => {
        const linkingSpy = jest.spyOn(Linking, 'openURL').mockImplementation(() => Promise.resolve(true));
        const { result } = renderHook(() => useContactOutcome(defaultParams));

        act(() => result.current.handleWhatsApp());

        expect(linkingSpy).toHaveBeenCalledWith('https://wa.me/6591234567');
        expect(result.current.pendingType).toBe('whatsapp');
    });

    it('handleOutcomeSelect sets outcome and advances to note step', () => {
        const { result } = renderHook(() => useContactOutcome(defaultParams));

        act(() => result.current.handleOutcomeSelect('reached'));

        expect(result.current.selectedOutcome).toBe('reached');
        expect(result.current.confirmStep).toBe('note');
    });

    it('handleSaveActivity calls addCandidateActivity and onActivityLogged', () => {
        const onLogged = jest.fn();
        const { result } = renderHook(() => useContactOutcome({ ...defaultParams, onActivityLogged: onLogged }));

        // Set up pending state
        act(() => result.current.handleCall());
        act(() => result.current.handleOutcomeSelect('reached'));
        act(() => result.current.setNoteText('Great call'));

        act(() => result.current.handleSaveActivity(false));

        expect(addCandidateActivity).toHaveBeenCalledWith('c1', 'u1', 'call', 'reached', 'Great call');
        expect(onLogged).toHaveBeenCalledWith(
            expect.objectContaining({
                candidate_id: 'c1',
                user_id: 'u1',
                type: 'call',
                outcome: 'reached',
                note: 'Great call',
            }),
        );
        // Sheet should be dismissed
        expect(result.current.showConfirmSheet).toBe(false);
        expect(result.current.pendingType).toBeNull();
    });

    it('handleSaveActivity with skipNote sends null note', () => {
        const onLogged = jest.fn();
        const { result } = renderHook(() => useContactOutcome({ ...defaultParams, onActivityLogged: onLogged }));

        act(() => result.current.handleCall());
        act(() => result.current.handleOutcomeSelect('no_answer'));
        act(() => result.current.setNoteText('Some text'));

        act(() => result.current.handleSaveActivity(true));

        expect(addCandidateActivity).toHaveBeenCalledWith('c1', 'u1', 'call', 'no_answer', null);
    });

    it('handleDismissSheet resets all state', () => {
        const { result } = renderHook(() => useContactOutcome(defaultParams));

        act(() => result.current.handleCall());
        act(() => result.current.handleOutcomeSelect('reached'));
        act(() => result.current.setNoteText('test'));

        act(() => result.current.handleDismissSheet());

        expect(result.current.pendingType).toBeNull();
        expect(result.current.selectedOutcome).toBeNull();
        expect(result.current.noteText).toBe('');
        expect(result.current.showConfirmSheet).toBe(false);
        expect(result.current.confirmStep).toBe('outcome');
    });

    it('AppState listener shows confirm sheet on return from background', () => {
        let appStateCallback: (state: string) => void = () => {};
        const mockRemove = jest.fn();
        jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
            appStateCallback = handler as (state: string) => void;
            return { remove: mockRemove } as any;
        });

        const { result } = renderHook(() => useContactOutcome(defaultParams));

        // Simulate making a call (sets hasPendingContact)
        act(() => result.current.handleCall());

        // Simulate going to background then returning
        act(() => appStateCallback('background'));
        act(() => appStateCallback('active'));

        expect(result.current.showConfirmSheet).toBe(true);
        expect(result.current.confirmStep).toBe('outcome');
    });

    it('does not re-trigger sheet on subsequent bg/fg cycles after it was shown', () => {
        let appStateCallback: (state: string) => void = () => {};
        const mockRemove = jest.fn();
        jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
            appStateCallback = handler as (state: string) => void;
            return { remove: mockRemove } as any;
        });

        const { result } = renderHook(() => useContactOutcome(defaultParams));

        // Call → bg → fg → sheet shows
        act(() => result.current.handleCall());
        act(() => appStateCallback('background'));
        act(() => appStateCallback('active'));
        expect(result.current.showConfirmSheet).toBe(true);

        // User selects outcome → moves to note step
        act(() => result.current.handleOutcomeSelect('reached'));
        expect(result.current.confirmStep).toBe('note');

        // Another bg/fg cycle should NOT reset confirmStep back to 'outcome'
        act(() => appStateCallback('background'));
        act(() => appStateCallback('active'));
        expect(result.current.confirmStep).toBe('note');
    });

    it('does not show sheet after dismiss on next bg/fg cycle', () => {
        let appStateCallback: (state: string) => void = () => {};
        const mockRemove = jest.fn();
        jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
            appStateCallback = handler as (state: string) => void;
            return { remove: mockRemove } as any;
        });

        const { result } = renderHook(() => useContactOutcome(defaultParams));

        // Call → bg → fg → sheet shows → dismiss
        act(() => result.current.handleCall());
        act(() => appStateCallback('background'));
        act(() => appStateCallback('active'));
        act(() => result.current.handleDismissSheet());
        expect(result.current.showConfirmSheet).toBe(false);

        // Next bg/fg cycle should NOT show sheet again
        act(() => appStateCallback('background'));
        act(() => appStateCallback('active'));
        expect(result.current.showConfirmSheet).toBe(false);
    });

    it('clears pending state when Linking.openURL fails', async () => {
        jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('Cannot open URL'));
        const { result } = renderHook(() => useContactOutcome(defaultParams));

        await act(async () => result.current.handleCall());

        expect(result.current.pendingType).toBeNull();
    });
});
