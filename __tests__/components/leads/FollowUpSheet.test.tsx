/**
 * Smoke + behavior test for components/leads/FollowUpSheet.tsx.
 * Exercises the leads Sheet path (Modal + useSheetAnimation, now that the jest
 * reanimated mock provides Easing) and the save contract: onSave(date, task, remind)
 * with the blank-task → "Follow up" fallback and remind defaulting on.
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { FollowUpSheet } from '@/components/leads/FollowUpSheet';

jest.mock('@/contexts/ThemeContext', () => ({
    useTheme: () => ({ colors: jest.requireActual('@/constants/Colors').Colors.light, isDark: false }),
}));

const baseProps = {
    visible: true,
    onClose: jest.fn(),
    initial: null,
    onSave: jest.fn(),
};

beforeEach(() => jest.clearAllMocks());

describe('FollowUpSheet', () => {
    it('renders the "Set a follow-up" title and Save action when new', async () => {
        const { getByText, getByLabelText } = render(<FollowUpSheet {...baseProps} />);
        await waitFor(() => expect(getByText('Set a follow-up')).toBeTruthy());
        expect(getByLabelText('Save follow-up')).toBeTruthy();
    });

    it('shows "Edit follow-up" when editing an existing follow-up', async () => {
        const { getByText } = render(
            <FollowUpSheet {...baseProps} initial={{ at: '2026-07-01T03:00:00Z', task: 'Send quote', remind: true }} />,
        );
        await waitFor(() => expect(getByText('Edit follow-up')).toBeTruthy());
    });

    it('saves with the blank-task fallback "Follow up" and remind defaulting on', async () => {
        const onSave = jest.fn();
        const { getByLabelText } = render(<FollowUpSheet {...baseProps} onSave={onSave} />);
        await waitFor(() => expect(getByLabelText('Save follow-up')).toBeTruthy());

        fireEvent.press(getByLabelText('Save follow-up'));
        expect(onSave).toHaveBeenCalledTimes(1);
        const [at, task, remind] = onSave.mock.calls[0];
        expect(at).toBeInstanceOf(Date);
        expect(task).toBe('Follow up');
        expect(remind).toBe(true);
    });

    it('shows "Saving…" and does not save while busy', async () => {
        const onSave = jest.fn();
        const { getByText } = render(<FollowUpSheet {...baseProps} busy onSave={onSave} />);
        await waitFor(() => expect(getByText('Saving…')).toBeTruthy());
        fireEvent.press(getByText('Saving…'));
        expect(onSave).not.toHaveBeenCalled();
    });
});
