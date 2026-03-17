import FormField from '@/components/FormField';
import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

const COLORS: any = {
    textSecondary: '#666',
    textTertiary: '#999',
    textPrimary: '#000',
    surfacePrimary: '#F5F5F5',
    borderLight: '#E0E0E0',
    danger: '#EF4444',
};

describe('FormField', () => {
    it('renders label and input', () => {
        const { getByText, getByPlaceholderText } = render(
            <FormField label="Name" value="" onChangeText={() => {}} placeholder="Enter name" colors={COLORS} />,
        );
        expect(getByText('Name')).toBeTruthy();
        expect(getByPlaceholderText('Enter name')).toBeTruthy();
    });

    it('shows required asterisk', () => {
        const { getByText } = render(
            <FormField label="Name" value="" onChangeText={() => {}} placeholder="" colors={COLORS} required />,
        );
        expect(getByText('*')).toBeTruthy();
    });

    it('shows error message', () => {
        const { getByText } = render(
            <FormField label="Name" value="" onChangeText={() => {}} placeholder="" colors={COLORS} error="Required" />,
        );
        expect(getByText('Required')).toBeTruthy();
    });

    it('calls onChangeText', () => {
        const handler = jest.fn();
        const { getByPlaceholderText } = render(
            <FormField label="Name" value="" onChangeText={handler} placeholder="Enter" colors={COLORS} />,
        );
        fireEvent.changeText(getByPlaceholderText('Enter'), 'hello');
        expect(handler).toHaveBeenCalledWith('hello');
    });

    it('renders icon variant with icon prop', () => {
        const { getByPlaceholderText } = render(
            <FormField
                label="Phone"
                value=""
                onChangeText={() => {}}
                placeholder="Phone"
                colors={COLORS}
                icon="call-outline"
            />,
        );
        expect(getByPlaceholderText('Phone')).toBeTruthy();
    });
});
