/**
 * Tests for components/events/AttendeePickerModal.tsx
 *
 * Covers: title/close, tab switching, Team tab (search / loading / error / user list /
 * selection / toggle), and External tab (name input / role chips / Add Guest / guest list /
 * remove guest).
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import AttendeePickerModal from '@/components/events/AttendeePickerModal';
import type { AttendeePickerModalProps } from '@/components/events/AttendeePickerModal';
import type { SimpleUser } from '@/lib/events';
import type { SelectedAttendee } from '@/hooks/useAttendeePicker';
import type { AttendeeRole, ExternalAttendee } from '@/types/event';

jest.mock('@/contexts/ThemeContext', () => ({
    useTheme: jest.fn(() => ({
        colors: require('@/constants/Colors').Colors.light,
        isDark: false,
        mode: 'light',
        resolved: 'light',
        setMode: jest.fn(),
    })),
}));

jest.mock('@/components/Avatar', () => {
    const { View } = require('react-native');
    return { __esModule: true, default: ({ name }: any) => <View testID={`avatar-${name}`} /> };
});

jest.mock('@/constants/platform', () => ({
    KAV_BEHAVIOR: 'padding',
    MODAL_ANIM_SHEET: 'slide',
    MODAL_STATUS_BAR_TRANSLUCENT: false,
}));

// @expo/vector-icons is already remapped to __tests__/mocks/vectorIcons.js by jest.config.js,
// but an explicit mock here keeps the file self-contained and avoids import-order issues.
jest.mock('@expo/vector-icons', () => {
    const React = require('react');
    const { Text } = require('react-native');
    return {
        Ionicons: ({ name }: any) => React.createElement(Text, null, name),
    };
});

// ATTENDEE_ROLES must match the real constant so role-chip labels render correctly.
jest.mock('@/constants/ui', () => ({
    ATTENDEE_ROLES: [
        { key: 'attendee', label: 'Attendee' },
        { key: 'host', label: 'Host' },
        { key: 'duty_manager', label: 'Duty Mgr' },
        { key: 'presenter', label: 'Presenter' },
    ],
    getAvatarColor: jest.fn(() => '#6366F1'),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ALICE: SimpleUser = { id: 'u1', full_name: 'Alice Tan', role: 'agent', avatar_url: null };
const BOB: SimpleUser = { id: 'u2', full_name: 'Bob Lim', role: 'manager', avatar_url: null };

const makeSelected = (user: SimpleUser, attendeeRole: AttendeeRole = 'attendee'): SelectedAttendee => ({
    user_id: user.id,
    full_name: user.full_name,
    avatar_url: user.avatar_url ?? null,
    role: user.role,
    attendee_role: attendeeRole,
});

const makeExternal = (name: string, attendeeRole: AttendeeRole, key: string): ExternalAttendee & { _key: string } => ({
    name,
    attendee_role: attendeeRole,
    _key: key,
});

// ── Default props factory ─────────────────────────────────────────────────────

function makeProps(overrides: Partial<AttendeePickerModalProps> = {}): AttendeePickerModalProps {
    return {
        visible: true,
        onClose: jest.fn(),
        pickerTab: 'team',
        onTabChange: jest.fn(),
        userSearch: '',
        onUserSearchChange: jest.fn(),
        loadingUsers: false,
        usersError: null,
        filteredUsers: [],
        selectedAttendees: [],
        onToggleAttendee: jest.fn(),
        onRetryLoadUsers: jest.fn(),
        externalName: '',
        onExternalNameChange: jest.fn(),
        externalRole: 'attendee',
        onExternalRoleChange: jest.fn(),
        externalAttendees: [],
        onAddExternal: jest.fn(),
        onRemoveExternal: jest.fn(),
        ...overrides,
    };
}

beforeEach(() => jest.clearAllMocks());

// ── 1. Title ──────────────────────────────────────────────────────────────────

describe('AttendeePickerModal — title and close', () => {
    it('renders "Add Attendees" title when visible', () => {
        const { getByText } = render(<AttendeePickerModal {...makeProps()} />);
        expect(getByText('Add Attendees')).toBeTruthy();
    });

    // ── 2. Done / close ───────────────────────────────────────────────────────

    it('calls onClose when Done is pressed', () => {
        const onClose = jest.fn();
        const { getByText } = render(<AttendeePickerModal {...makeProps({ onClose })} />);
        fireEvent.press(getByText('Done'));
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});

// ── 3. Tab navigation ─────────────────────────────────────────────────────────

describe('AttendeePickerModal — tab navigation', () => {
    it('renders Team and External tab labels', () => {
        const { getByText } = render(<AttendeePickerModal {...makeProps()} />);
        expect(getByText('Team')).toBeTruthy();
        expect(getByText('External')).toBeTruthy();
    });

    it('calls onTabChange with "external" when External tab is pressed', () => {
        const onTabChange = jest.fn();
        const { getByText } = render(<AttendeePickerModal {...makeProps({ onTabChange })} />);
        fireEvent.press(getByText('External'));
        expect(onTabChange).toHaveBeenCalledWith('external');
    });

    it('calls onTabChange with "team" when Team tab is pressed', () => {
        const onTabChange = jest.fn();
        // Start on external so pressing Team is a real tab switch
        const { getByText } = render(<AttendeePickerModal {...makeProps({ pickerTab: 'external', onTabChange })} />);
        fireEvent.press(getByText('Team'));
        expect(onTabChange).toHaveBeenCalledWith('team');
    });
});

// ── 4-9. Team tab ─────────────────────────────────────────────────────────────

describe('AttendeePickerModal — Team tab', () => {
    // ── 4. Search input ───────────────────────────────────────────────────────

    it('shows search input with placeholder text', () => {
        const { getByPlaceholderText } = render(<AttendeePickerModal {...makeProps()} />);
        expect(getByPlaceholderText('Search by name or role...')).toBeTruthy();
    });

    it('calls onUserSearchChange when text is entered in the search input', () => {
        const onUserSearchChange = jest.fn();
        const { getByPlaceholderText } = render(<AttendeePickerModal {...makeProps({ onUserSearchChange })} />);
        fireEvent.changeText(getByPlaceholderText('Search by name or role...'), 'alice');
        expect(onUserSearchChange).toHaveBeenCalledWith('alice');
    });

    it('reflects the userSearch prop value in the search input', () => {
        const { getByDisplayValue } = render(<AttendeePickerModal {...makeProps({ userSearch: 'bob' })} />);
        expect(getByDisplayValue('bob')).toBeTruthy();
    });

    // ── 5. Loading spinner ────────────────────────────────────────────────────

    it('shows an ActivityIndicator when loadingUsers is true', () => {
        const { UNSAFE_getByType } = render(<AttendeePickerModal {...makeProps({ loadingUsers: true })} />);
        const { ActivityIndicator } = require('react-native');
        expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
    });

    it('does not show ActivityIndicator when loadingUsers is false', () => {
        const { UNSAFE_queryByType } = render(<AttendeePickerModal {...makeProps({ loadingUsers: false })} />);
        const { ActivityIndicator } = require('react-native');
        expect(UNSAFE_queryByType(ActivityIndicator)).toBeNull();
    });

    // ── 6. Error state ────────────────────────────────────────────────────────

    it('shows the error message when usersError is set', () => {
        const { getByText } = render(
            <AttendeePickerModal {...makeProps({ usersError: 'Failed to load users. Tap to retry.' })} />,
        );
        expect(getByText('Failed to load users. Tap to retry.')).toBeTruthy();
    });

    it('shows a retry button when usersError is set', () => {
        // The retry button contains the error text — pressing it calls onRetryLoadUsers
        const onRetryLoadUsers = jest.fn();
        const { getByText } = render(
            <AttendeePickerModal
                {...makeProps({
                    usersError: 'Failed to load users. Tap to retry.',
                    onRetryLoadUsers,
                })}
            />,
        );
        fireEvent.press(getByText('Failed to load users. Tap to retry.'));
        expect(onRetryLoadUsers).toHaveBeenCalledTimes(1);
    });

    it('does not show error text when usersError is null', () => {
        const { queryByText } = render(<AttendeePickerModal {...makeProps({ usersError: null })} />);
        expect(queryByText(/failed/i)).toBeNull();
    });

    // ── 7. User list — names and capitalised roles ────────────────────────────

    it('renders each user full_name in the list', () => {
        const { getByText } = render(<AttendeePickerModal {...makeProps({ filteredUsers: [ALICE, BOB] })} />);
        expect(getByText('Alice Tan')).toBeTruthy();
        expect(getByText('Bob Lim')).toBeTruthy();
    });

    it('capitalises the first letter of the user role', () => {
        const { getByText } = render(<AttendeePickerModal {...makeProps({ filteredUsers: [ALICE] })} />);
        // ALICE.role = 'agent' → should render as 'Agent'
        expect(getByText('Agent')).toBeTruthy();
    });

    it('capitalises multi-user roles correctly', () => {
        const { getByText } = render(<AttendeePickerModal {...makeProps({ filteredUsers: [BOB] })} />);
        // BOB.role = 'manager' → 'Manager'
        expect(getByText('Manager')).toBeTruthy();
    });

    // ── 8. Selected attendee — checkmark indicator ────────────────────────────

    it('shows a checkmark icon for a selected attendee', () => {
        // The mock Ionicons renders name as text; 'checkmark-circle' appears for selected rows.
        const { getAllByText } = render(
            <AttendeePickerModal
                {...makeProps({
                    filteredUsers: [ALICE, BOB],
                    selectedAttendees: [makeSelected(ALICE)],
                })}
            />,
        );
        // Our Ionicons mock renders the icon name as a text node
        const checkmarks = getAllByText('checkmark-circle');
        expect(checkmarks.length).toBe(1);
    });

    it('does not show a checkmark for an unselected attendee', () => {
        const { queryByText } = render(
            <AttendeePickerModal
                {...makeProps({
                    filteredUsers: [BOB],
                    selectedAttendees: [],
                })}
            />,
        );
        expect(queryByText('checkmark-circle')).toBeNull();
    });

    // ── 9. Toggle attendee ────────────────────────────────────────────────────

    it('calls onToggleAttendee with the correct user when a user row is pressed', () => {
        const onToggleAttendee = jest.fn();
        const { getByText } = render(
            <AttendeePickerModal {...makeProps({ filteredUsers: [ALICE, BOB], onToggleAttendee })} />,
        );
        fireEvent.press(getByText('Alice Tan'));
        expect(onToggleAttendee).toHaveBeenCalledWith(ALICE);
    });

    it('calls onToggleAttendee for the correct user when multiple users are shown', () => {
        const onToggleAttendee = jest.fn();
        const { getByText } = render(
            <AttendeePickerModal {...makeProps({ filteredUsers: [ALICE, BOB], onToggleAttendee })} />,
        );
        fireEvent.press(getByText('Bob Lim'));
        expect(onToggleAttendee).toHaveBeenCalledWith(BOB);
        expect(onToggleAttendee).not.toHaveBeenCalledWith(ALICE);
    });
});

// ── 10-15. External tab ───────────────────────────────────────────────────────

describe('AttendeePickerModal — External tab', () => {
    const externalProps = makeProps({ pickerTab: 'external' });

    // ── 10. Name input ────────────────────────────────────────────────────────

    it('shows a name input with "Full name" placeholder', () => {
        const { getByPlaceholderText } = render(<AttendeePickerModal {...externalProps} />);
        expect(getByPlaceholderText('Full name')).toBeTruthy();
    });

    it('calls onExternalNameChange when name input changes', () => {
        const onExternalNameChange = jest.fn();
        const { getByPlaceholderText } = render(
            <AttendeePickerModal {...makeProps({ pickerTab: 'external', onExternalNameChange })} />,
        );
        fireEvent.changeText(getByPlaceholderText('Full name'), 'Jane Doe');
        expect(onExternalNameChange).toHaveBeenCalledWith('Jane Doe');
    });

    it('reflects the externalName prop value in the name input', () => {
        const { getByDisplayValue } = render(
            <AttendeePickerModal {...makeProps({ pickerTab: 'external', externalName: 'John' })} />,
        );
        expect(getByDisplayValue('John')).toBeTruthy();
    });

    // ── 11. Role chips ────────────────────────────────────────────────────────

    it('renders all four role chip labels', () => {
        const { getByText } = render(<AttendeePickerModal {...externalProps} />);
        expect(getByText('Attendee')).toBeTruthy();
        expect(getByText('Host')).toBeTruthy();
        expect(getByText('Duty Mgr')).toBeTruthy();
        expect(getByText('Presenter')).toBeTruthy();
    });

    it('calls onExternalRoleChange with the correct role when a chip is pressed', () => {
        const onExternalRoleChange = jest.fn();
        const { getByText } = render(
            <AttendeePickerModal {...makeProps({ pickerTab: 'external', onExternalRoleChange })} />,
        );
        fireEvent.press(getByText('Host'));
        expect(onExternalRoleChange).toHaveBeenCalledWith('host');
    });

    it('calls onExternalRoleChange with "duty_manager" when Duty Mgr is pressed', () => {
        const onExternalRoleChange = jest.fn();
        const { getByText } = render(
            <AttendeePickerModal {...makeProps({ pickerTab: 'external', onExternalRoleChange })} />,
        );
        fireEvent.press(getByText('Duty Mgr'));
        expect(onExternalRoleChange).toHaveBeenCalledWith('duty_manager');
    });

    it('calls onExternalRoleChange with "presenter" when Presenter is pressed', () => {
        const onExternalRoleChange = jest.fn();
        const { getByText } = render(
            <AttendeePickerModal {...makeProps({ pickerTab: 'external', onExternalRoleChange })} />,
        );
        fireEvent.press(getByText('Presenter'));
        expect(onExternalRoleChange).toHaveBeenCalledWith('presenter');
    });

    // ── 12. Add Guest — disabled when name is empty ───────────────────────────

    it('disables the Add Guest button when externalName is empty', () => {
        const onAddExternal = jest.fn();
        const { getByText } = render(
            <AttendeePickerModal {...makeProps({ pickerTab: 'external', externalName: '', onAddExternal })} />,
        );
        // fireEvent.press on a disabled TouchableOpacity still calls the handler in RTN;
        // we verify the `disabled` prop is set by confirming that the component renders
        // and that pressing it does NOT invoke onAddExternal.
        fireEvent.press(getByText('Add Guest'));
        expect(onAddExternal).not.toHaveBeenCalled();
    });

    it('disables the Add Guest button when externalName is whitespace only', () => {
        const onAddExternal = jest.fn();
        const { getByText } = render(
            <AttendeePickerModal {...makeProps({ pickerTab: 'external', externalName: '   ', onAddExternal })} />,
        );
        fireEvent.press(getByText('Add Guest'));
        expect(onAddExternal).not.toHaveBeenCalled();
    });

    // ── 13. Add Guest — enabled when name is present ──────────────────────────

    it('calls onAddExternal when Add Guest is pressed and name is non-empty', () => {
        const onAddExternal = jest.fn();
        const { getByText } = render(
            <AttendeePickerModal {...makeProps({ pickerTab: 'external', externalName: 'Jane Doe', onAddExternal })} />,
        );
        fireEvent.press(getByText('Add Guest'));
        expect(onAddExternal).toHaveBeenCalledTimes(1);
    });

    // ── 14. Rendered guest list ───────────────────────────────────────────────

    it('renders added guests by name', () => {
        const guests = [makeExternal('Carol White', 'attendee', 'ext_1'), makeExternal('Dave Green', 'host', 'ext_2')];
        const { getByText } = render(
            <AttendeePickerModal {...makeProps({ pickerTab: 'external', externalAttendees: guests })} />,
        );
        expect(getByText('Carol White')).toBeTruthy();
        expect(getByText('Dave Green')).toBeTruthy();
    });

    it('renders guest role labels using ATTENDEE_ROLES lookup', () => {
        const guests = [makeExternal('Carol White', 'host', 'ext_1')];
        const { getAllByText } = render(
            <AttendeePickerModal {...makeProps({ pickerTab: 'external', externalAttendees: guests })} />,
        );
        // 'host' maps to label 'Host' via the ATTENDEE_ROLES mock.
        // "Host" appears twice: once as the role chip label, once as the guest's role label.
        const hostElements = getAllByText('Host');
        expect(hostElements.length).toBeGreaterThanOrEqual(2);
    });

    it('shows the "Added guests" section label when guests are present', () => {
        const guests = [makeExternal('Eve Black', 'attendee', 'ext_1')];
        const { getByText } = render(
            <AttendeePickerModal {...makeProps({ pickerTab: 'external', externalAttendees: guests })} />,
        );
        expect(getByText('Added guests')).toBeTruthy();
    });

    it('does not show "Added guests" label when guest list is empty', () => {
        const { queryByText } = render(
            <AttendeePickerModal {...makeProps({ pickerTab: 'external', externalAttendees: [] })} />,
        );
        expect(queryByText('Added guests')).toBeNull();
    });

    // ── 15. Remove guest ──────────────────────────────────────────────────────

    it('calls onRemoveExternal with the correct key when the remove icon is pressed', () => {
        const onRemoveExternal = jest.fn();
        const guests = [makeExternal('Frank Grey', 'attendee', 'ext_42')];
        const { getAllByText } = render(
            <AttendeePickerModal
                {...makeProps({ pickerTab: 'external', externalAttendees: guests, onRemoveExternal })}
            />,
        );
        // Our Ionicons mock renders the icon name as text; 'close-circle' is the remove icon.
        const removeButtons = getAllByText('close-circle');
        expect(removeButtons.length).toBe(1);
        fireEvent.press(removeButtons[0]);
        expect(onRemoveExternal).toHaveBeenCalledWith('ext_42');
    });

    it('calls onRemoveExternal with the key of the pressed guest only', () => {
        const onRemoveExternal = jest.fn();
        const guests = [makeExternal('Guest One', 'attendee', 'ext_1'), makeExternal('Guest Two', 'host', 'ext_2')];
        const { getAllByText } = render(
            <AttendeePickerModal
                {...makeProps({ pickerTab: 'external', externalAttendees: guests, onRemoveExternal })}
            />,
        );
        const removeButtons = getAllByText('close-circle');
        expect(removeButtons.length).toBe(2);
        // Press the second guest's remove icon
        fireEvent.press(removeButtons[1]);
        expect(onRemoveExternal).toHaveBeenCalledWith('ext_2');
        expect(onRemoveExternal).not.toHaveBeenCalledWith('ext_1');
    });
});
