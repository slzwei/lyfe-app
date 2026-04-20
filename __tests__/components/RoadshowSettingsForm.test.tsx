import RoadshowSettingsForm, { RoadshowSettingsFormProps } from '@/components/events/RoadshowSettingsForm';
import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';

jest.mock('@/contexts/ThemeContext', () => ({
    useTheme: jest.fn(() => ({
        colors: require('@/constants/Colors').Colors.light,
        isDark: false,
        mode: 'light' as const,
        resolved: 'light' as const,
        setMode: jest.fn(),
    })),
}));

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

function makeProps(overrides?: Partial<RoadshowSettingsFormProps>): RoadshowSettingsFormProps {
    return {
        rsWeeklyCost: '',
        onWeeklyCostChange: jest.fn(),
        rsSlots: 3,
        onSlotsChange: jest.fn(),
        rsGrace: 15,
        onGraceChange: jest.fn(),
        rsSitdowns: 4,
        onSitdownsChange: jest.fn(),
        rsPitches: 2,
        onPitchesChange: jest.fn(),
        rsClosed: 1,
        onClosedChange: jest.fn(),
        rsConfigLocked: false,
        errors: {},
        onClearError: jest.fn(),
        ...overrides,
    };
}

beforeEach(() => jest.clearAllMocks());

describe('RoadshowSettingsForm', () => {
    // -------------------------------------------------------------------------
    // 1. Title
    // -------------------------------------------------------------------------
    it('renders the form with Roadshow Settings a11y label', () => {
        // Visible header moved up to the parent screen's "ROADSHOW CONFIG"
        // eyebrow — this component renders flat. A11y label preserves the
        // legacy semantic name for consumers that care.
        const { getByLabelText } = render(<RoadshowSettingsForm {...makeProps()} />);
        expect(getByLabelText('Roadshow Settings')).toBeTruthy();
    });

    // -------------------------------------------------------------------------
    // 2 & 3. Locked banner visibility
    // -------------------------------------------------------------------------
    it('shows locked banner when rsConfigLocked is true', () => {
        const { getByText } = render(<RoadshowSettingsForm {...makeProps({ rsConfigLocked: true })} />);
        expect(getByText('Config locked — agents have already checked in.')).toBeTruthy();
    });

    it('hides locked banner when rsConfigLocked is false', () => {
        const { queryByText } = render(<RoadshowSettingsForm {...makeProps({ rsConfigLocked: false })} />);
        expect(queryByText('Config locked — agents have already checked in.')).toBeNull();
    });

    // -------------------------------------------------------------------------
    // 4. TextInput strips non-numeric characters
    // -------------------------------------------------------------------------
    it('calls onWeeklyCostChange with non-numeric characters stripped', () => {
        const onWeeklyCostChange = jest.fn();
        const { getByPlaceholderText } = render(<RoadshowSettingsForm {...makeProps({ onWeeklyCostChange })} />);

        fireEvent.changeText(getByPlaceholderText('e.g. 1800'), '1a8b0c0');
        expect(onWeeklyCostChange).toHaveBeenCalledWith('1800');
    });

    it('passes through a purely numeric string unchanged', () => {
        const onWeeklyCostChange = jest.fn();
        const { getByPlaceholderText } = render(<RoadshowSettingsForm {...makeProps({ onWeeklyCostChange })} />);

        fireEvent.changeText(getByPlaceholderText('e.g. 1800'), '1800');
        expect(onWeeklyCostChange).toHaveBeenCalledWith('1800');
    });

    it('allows decimal point through the numeric filter', () => {
        const onWeeklyCostChange = jest.fn();
        const { getByPlaceholderText } = render(<RoadshowSettingsForm {...makeProps({ onWeeklyCostChange })} />);

        fireEvent.changeText(getByPlaceholderText('e.g. 1800'), '18.50');
        expect(onWeeklyCostChange).toHaveBeenCalledWith('18.50');
    });

    // -------------------------------------------------------------------------
    // 5. TextInput clears error on change
    // -------------------------------------------------------------------------
    it('calls onClearError("rsWeeklyCost") when typing in the cost field', () => {
        const onClearError = jest.fn();
        const { getByPlaceholderText } = render(<RoadshowSettingsForm {...makeProps({ onClearError })} />);

        fireEvent.changeText(getByPlaceholderText('e.g. 1800'), '500');
        expect(onClearError).toHaveBeenCalledWith('rsWeeklyCost');
    });

    // -------------------------------------------------------------------------
    // 6. Agents per slot stepper
    // -------------------------------------------------------------------------
    it('calls onSlotsChange with an updater that increments by 1 when increase is pressed', () => {
        const onSlotsChange = jest.fn();
        const { getByLabelText } = render(<RoadshowSettingsForm {...makeProps({ rsSlots: 3, onSlotsChange })} />);

        fireEvent.press(getByLabelText('Increase agents per slot'));

        expect(onSlotsChange).toHaveBeenCalledTimes(1);
        const updater = onSlotsChange.mock.calls[0][0];
        expect(updater(3)).toBe(4);
    });

    it('calls onSlotsChange with an updater that decrements by 1 when decrease is pressed', () => {
        const onSlotsChange = jest.fn();
        const { getByLabelText } = render(<RoadshowSettingsForm {...makeProps({ rsSlots: 3, onSlotsChange })} />);

        fireEvent.press(getByLabelText('Decrease agents per slot'));

        expect(onSlotsChange).toHaveBeenCalledTimes(1);
        const updater = onSlotsChange.mock.calls[0][0];
        expect(updater(3)).toBe(2);
    });

    it('does not allow agents per slot below 1', () => {
        const onSlotsChange = jest.fn();
        const { getByLabelText } = render(<RoadshowSettingsForm {...makeProps({ rsSlots: 1, onSlotsChange })} />);

        fireEvent.press(getByLabelText('Decrease agents per slot'));

        const updater = onSlotsChange.mock.calls[0][0];
        expect(updater(1)).toBe(1);
    });

    // -------------------------------------------------------------------------
    // 7. Grace period stepper
    // -------------------------------------------------------------------------
    it('calls onGraceChange with an updater that increments by 5 when increase is pressed', () => {
        const onGraceChange = jest.fn();
        const { getByLabelText } = render(<RoadshowSettingsForm {...makeProps({ rsGrace: 15, onGraceChange })} />);

        fireEvent.press(getByLabelText('Increase grace period'));

        expect(onGraceChange).toHaveBeenCalledTimes(1);
        const updater = onGraceChange.mock.calls[0][0];
        expect(updater(15)).toBe(20);
    });

    it('calls onGraceChange with an updater that decrements by 5 when decrease is pressed', () => {
        const onGraceChange = jest.fn();
        const { getByLabelText } = render(<RoadshowSettingsForm {...makeProps({ rsGrace: 15, onGraceChange })} />);

        fireEvent.press(getByLabelText('Decrease grace period'));

        expect(onGraceChange).toHaveBeenCalledTimes(1);
        const updater = onGraceChange.mock.calls[0][0];
        expect(updater(15)).toBe(10);
    });

    it('does not allow grace period below 0', () => {
        const onGraceChange = jest.fn();
        const { getByLabelText } = render(<RoadshowSettingsForm {...makeProps({ rsGrace: 0, onGraceChange })} />);

        fireEvent.press(getByLabelText('Decrease grace period'));

        const updater = onGraceChange.mock.calls[0][0];
        expect(updater(0)).toBe(0);
    });

    // -------------------------------------------------------------------------
    // 8. Target steppers — sitdowns, pitches, closed
    // -------------------------------------------------------------------------
    it('calls onSitdownsChange with an updater that increments by 1', () => {
        const onSitdownsChange = jest.fn();
        const { getByLabelText } = render(<RoadshowSettingsForm {...makeProps({ rsSitdowns: 4, onSitdownsChange })} />);

        fireEvent.press(getByLabelText('Increase Sitdowns target'));

        const updater = onSitdownsChange.mock.calls[0][0];
        expect(updater(4)).toBe(5);
    });

    it('calls onSitdownsChange with an updater that decrements by 1', () => {
        const onSitdownsChange = jest.fn();
        const { getByLabelText } = render(<RoadshowSettingsForm {...makeProps({ rsSitdowns: 4, onSitdownsChange })} />);

        fireEvent.press(getByLabelText('Decrease Sitdowns target'));

        const updater = onSitdownsChange.mock.calls[0][0];
        expect(updater(4)).toBe(3);
    });

    it('does not allow Sitdowns target below 0', () => {
        const onSitdownsChange = jest.fn();
        const { getByLabelText } = render(<RoadshowSettingsForm {...makeProps({ rsSitdowns: 0, onSitdownsChange })} />);

        fireEvent.press(getByLabelText('Decrease Sitdowns target'));

        const updater = onSitdownsChange.mock.calls[0][0];
        expect(updater(0)).toBe(0);
    });

    it('calls onPitchesChange with an updater that increments by 1', () => {
        const onPitchesChange = jest.fn();
        const { getByLabelText } = render(<RoadshowSettingsForm {...makeProps({ rsPitches: 2, onPitchesChange })} />);

        fireEvent.press(getByLabelText('Increase Pitches target'));

        const updater = onPitchesChange.mock.calls[0][0];
        expect(updater(2)).toBe(3);
    });

    it('calls onPitchesChange with an updater that decrements by 1', () => {
        const onPitchesChange = jest.fn();
        const { getByLabelText } = render(<RoadshowSettingsForm {...makeProps({ rsPitches: 2, onPitchesChange })} />);

        fireEvent.press(getByLabelText('Decrease Pitches target'));

        const updater = onPitchesChange.mock.calls[0][0];
        expect(updater(2)).toBe(1);
    });

    it('calls onClosedChange with an updater that increments by 1', () => {
        const onClosedChange = jest.fn();
        const { getByLabelText } = render(<RoadshowSettingsForm {...makeProps({ rsClosed: 1, onClosedChange })} />);

        fireEvent.press(getByLabelText('Increase Cases Closed target'));

        const updater = onClosedChange.mock.calls[0][0];
        expect(updater(1)).toBe(2);
    });

    it('calls onClosedChange with an updater that decrements by 1', () => {
        const onClosedChange = jest.fn();
        const { getByLabelText } = render(<RoadshowSettingsForm {...makeProps({ rsClosed: 1, onClosedChange })} />);

        fireEvent.press(getByLabelText('Decrease Cases Closed target'));

        const updater = onClosedChange.mock.calls[0][0];
        expect(updater(1)).toBe(0);
    });

    it('does not allow Cases Closed target below 0', () => {
        const onClosedChange = jest.fn();
        const { getByLabelText } = render(<RoadshowSettingsForm {...makeProps({ rsClosed: 0, onClosedChange })} />);

        fireEvent.press(getByLabelText('Decrease Cases Closed target'));

        const updater = onClosedChange.mock.calls[0][0];
        expect(updater(0)).toBe(0);
    });

    // -------------------------------------------------------------------------
    // 9. Error text display
    // -------------------------------------------------------------------------
    it('shows error text when errors.rsWeeklyCost is set', () => {
        const { getByText } = render(
            <RoadshowSettingsForm {...makeProps({ errors: { rsWeeklyCost: 'Weekly cost is required' } })} />,
        );
        expect(getByText('Weekly cost is required')).toBeTruthy();
    });

    it('does not show error text when errors.rsWeeklyCost is not set', () => {
        const { queryByText } = render(<RoadshowSettingsForm {...makeProps({ errors: {} })} />);
        expect(queryByText('Weekly cost is required')).toBeNull();
    });

    // -------------------------------------------------------------------------
    // 10 & 11. Cost preview visibility
    // -------------------------------------------------------------------------
    it('shows cost preview section when weekly cost is a valid positive number', () => {
        const { getByText } = render(<RoadshowSettingsForm {...makeProps({ rsWeeklyCost: '700' })} />);
        expect(getByText('Cost Preview')).toBeTruthy();
    });

    it('hides cost preview when weekly cost is empty', () => {
        const { queryByText } = render(<RoadshowSettingsForm {...makeProps({ rsWeeklyCost: '' })} />);
        expect(queryByText('Cost Preview')).toBeNull();
    });

    it('hides cost preview when weekly cost is zero', () => {
        const { queryByText } = render(<RoadshowSettingsForm {...makeProps({ rsWeeklyCost: '0' })} />);
        expect(queryByText('Cost Preview')).toBeNull();
    });

    it('hides cost preview when weekly cost is not a number', () => {
        // After the numeric strip a purely alphabetic entry becomes '', but test
        // the component's own guard against a raw NaN string like 'abc' directly.
        const { queryByText } = render(<RoadshowSettingsForm {...makeProps({ rsWeeklyCost: 'abc' })} />);
        expect(queryByText('Cost Preview')).toBeNull();
    });

    // -------------------------------------------------------------------------
    // 12. Cost preview arithmetic
    // -------------------------------------------------------------------------
    it('shows correct daily cost (weekly / 7) in cost preview', () => {
        // 700 / 7 = 100.00
        const { getByText } = render(<RoadshowSettingsForm {...makeProps({ rsWeeklyCost: '700' })} />);
        expect(getByText('$100.00')).toBeTruthy();
    });

    it('shows correct per-agent cost (weekly / 7 / slots) in cost preview', () => {
        // 700 / 7 / 5 = 20.00
        const { getByText } = render(<RoadshowSettingsForm {...makeProps({ rsWeeklyCost: '700', rsSlots: 5 })} />);
        expect(getByText('$20.00')).toBeTruthy();
    });

    it('uses slots of at least 1 to avoid division by zero in per-agent cost', () => {
        // rsSlots=0 → Math.max(1, 0) = 1 → 700 / 7 / 1 = 100.00
        const { getAllByText } = render(<RoadshowSettingsForm {...makeProps({ rsWeeklyCost: '700', rsSlots: 0 })} />);
        // Daily cost and per-agent cost are both $100.00 in this edge case
        const matches = getAllByText('$100.00');
        expect(matches.length).toBeGreaterThanOrEqual(2);
    });

    it('renders "Daily cost" and "Per agent / slot" labels in cost preview', () => {
        const { getByText } = render(<RoadshowSettingsForm {...makeProps({ rsWeeklyCost: '1400' })} />);
        expect(getByText('Daily cost')).toBeTruthy();
        expect(getByText('Per agent / slot')).toBeTruthy();
    });

    // -------------------------------------------------------------------------
    // 13. TextInput not editable when locked
    // -------------------------------------------------------------------------
    it('renders TextInput as not editable when rsConfigLocked is true', () => {
        const { getByPlaceholderText } = render(<RoadshowSettingsForm {...makeProps({ rsConfigLocked: true })} />);
        const input = getByPlaceholderText('e.g. 1800');
        expect(input.props.editable).toBe(false);
    });

    it('renders TextInput as editable when rsConfigLocked is false', () => {
        const { getByPlaceholderText } = render(<RoadshowSettingsForm {...makeProps({ rsConfigLocked: false })} />);
        const input = getByPlaceholderText('e.g. 1800');
        expect(input.props.editable).toBe(true);
    });

    // -------------------------------------------------------------------------
    // Stepper buttons disabled when locked
    // -------------------------------------------------------------------------
    it('does not call onSlotsChange when agents-per-slot buttons are pressed while locked', () => {
        const onSlotsChange = jest.fn();
        const { getByLabelText } = render(
            <RoadshowSettingsForm {...makeProps({ rsConfigLocked: true, onSlotsChange })} />,
        );

        // RNTL respects the `disabled` prop on TouchableOpacity and swallows the event
        fireEvent.press(getByLabelText('Increase agents per slot'));
        fireEvent.press(getByLabelText('Decrease agents per slot'));

        expect(onSlotsChange).not.toHaveBeenCalled();
    });

    // -------------------------------------------------------------------------
    // Current stepper values are displayed
    // -------------------------------------------------------------------------
    it('displays current stepper values in the UI', () => {
        const { getByText } = render(
            <RoadshowSettingsForm
                {...makeProps({ rsSlots: 7, rsGrace: 20, rsSitdowns: 6, rsPitches: 3, rsClosed: 2 })}
            />,
        );
        expect(getByText('7')).toBeTruthy();
        expect(getByText('20')).toBeTruthy();
        expect(getByText('6')).toBeTruthy();
        expect(getByText('3')).toBeTruthy();
        expect(getByText('2')).toBeTruthy();
    });

    // -------------------------------------------------------------------------
    // Section labels are present
    // -------------------------------------------------------------------------
    it('renders stepper section labels', () => {
        const { getByText, getByLabelText } = render(<RoadshowSettingsForm {...makeProps()} />);
        // NumberStepper labels render uppercased per design tokens
        expect(getByText('SLOTS / DAY')).toBeTruthy();
        expect(getByText('GRACE (MIN)')).toBeTruthy();
        expect(getByText('SUGGESTED DAILY TARGETS')).toBeTruthy();
        expect(getByText('SITDOWNS')).toBeTruthy();
        expect(getByText('PITCHES')).toBeTruthy();
        expect(getByText('CLOSED')).toBeTruthy();
        // A11y labels preserve original semantic names for tests that care
        expect(getByLabelText('Increase agents per slot')).toBeTruthy();
        expect(getByLabelText('Increase grace period')).toBeTruthy();
        expect(getByLabelText('Increase Cases Closed target')).toBeTruthy();
    });
});
