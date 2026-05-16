import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

import PaperAttemptEditSheet from '@/components/candidates/PaperAttemptEditSheet';
import { Colors } from '@/constants/Colors';

jest.mock('@/components/InlineCalendar', () => {
    const React = require('react');
    const { Pressable, Text, View } = require('react-native');

    return function MockInlineCalendar({ onSelect }: { onSelect: (date: string | null) => void }) {
        return (
            <View>
                <Pressable testID="mock-calendar-select" onPress={() => onSelect('2026-05-16')}>
                    <Text>Select date</Text>
                </Pressable>
                <Pressable testID="mock-calendar-clear" onPress={() => onSelect(null)}>
                    <Text>Clear date</Text>
                </Pressable>
            </View>
        );
    };
});

jest.mock('@/components/InlineTimePicker', () => {
    const React = require('react');
    const { Pressable, Text, View } = require('react-native');

    return function MockInlineTimePicker({
        onHourChange,
        onMinuteChange,
        onAmPmChange,
    }: {
        onHourChange: (hour: number) => void;
        onMinuteChange: (minute: number) => void;
        onAmPmChange: (amPm: 'AM' | 'PM') => void;
    }) {
        return (
            <View>
                <Pressable testID="mock-time-hour" onPress={() => onHourChange(11)}>
                    <Text>Hour</Text>
                </Pressable>
                <Pressable testID="mock-time-minute" onPress={() => onMinuteChange(35)}>
                    <Text>Minute</Text>
                </Pressable>
                <Pressable testID="mock-time-pm" onPress={() => onAmPmChange('PM')}>
                    <Text>PM</Text>
                </Pressable>
            </View>
        );
    };
});

const baseProps = {
    visible: true,
    colors: Colors.light,
    animatedStyle: {},
    requirementLabel: 'Life 1',
    acceptedPaperCodes: ['M9', 'CM_LIP'] as any,
    editing: null,
    isSaving: false,
    error: null,
    onSave: jest.fn(),
    onDelete: jest.fn(),
    onDismiss: jest.fn(),
};

describe('PaperAttemptEditSheet', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
    });

    it('saves a new attempt with selected paper, schedule, cost, and result', () => {
        const onSave = jest.fn();
        const screen = render(<PaperAttemptEditSheet {...baseProps} onSave={onSave} />);

        fireEvent.press(screen.getByTestId('paper-attempt-code-CM_LIP'));
        fireEvent.press(screen.getByTestId('paper-attempt-open-date-picker'));
        fireEvent.press(screen.getByTestId('mock-calendar-select'));
        fireEvent.press(screen.getByTestId('mock-time-hour'));
        fireEvent.press(screen.getByTestId('mock-time-minute'));
        fireEvent.press(screen.getByTestId('mock-time-pm'));
        fireEvent.changeText(screen.getByTestId('paper-attempt-cost-input'), '188.50');
        fireEvent.press(screen.getByTestId('paper-attempt-result-passed'));
        fireEvent.press(screen.getByTestId('paper-attempt-save'));

        expect(onSave).toHaveBeenCalledWith(
            expect.objectContaining({
                paperCode: 'CM_LIP',
                cost: 188.5,
                result: 'passed',
            }),
        );
        const savedAt = onSave.mock.calls[0][0].examAt as Date;
        expect(savedAt.getFullYear()).toBe(2026);
        expect(savedAt.getMonth()).toBe(4);
        expect(savedAt.getDate()).toBe(16);
        expect(savedAt.getHours()).toBe(23);
        expect(savedAt.getMinutes()).toBe(35);
    });

    it('loads an existing attempt and exposes delete/dismiss actions', () => {
        const onDelete = jest.fn();
        const onDismiss = jest.fn();
        const editing = {
            id: 'attempt-1',
            candidate_id: 'candidate-1',
            paper_code: 'M9',
            exam_at: '2026-05-16T14:45:00.000Z',
            cost: 120,
            result: 'failed',
            created_at: '2026-05-01T00:00:00.000Z',
            updated_at: '2026-05-01T00:00:00.000Z',
        };

        const screen = render(
            <PaperAttemptEditSheet {...baseProps} editing={editing as any} onDelete={onDelete} onDismiss={onDismiss} />,
        );

        expect(screen.getByDisplayValue('120')).toBeTruthy();

        fireEvent.press(screen.getByTestId('paper-attempt-delete'));
        fireEvent.press(screen.getByText('Cancel'));

        expect(onDelete).toHaveBeenCalledTimes(1);
        expect(onDismiss).toHaveBeenCalledTimes(1);
    });
});
