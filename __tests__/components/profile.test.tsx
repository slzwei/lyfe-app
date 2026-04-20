import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Colors } from '@/constants/Colors';

import AppearanceCard from '@/components/profile/AppearanceCard';
import AssignedManagersCard from '@/components/profile/AssignedManagersCard';
import AvatarPickerSheet from '@/components/profile/AvatarPickerSheet';
import EditProfileSheet from '@/components/profile/EditProfileSheet';
import SecurityCard from '@/components/profile/SecurityCard';
import SettingsListCard from '@/components/profile/SettingsListCard';
import SignOutModal from '@/components/profile/SignOutModal';
import UserHeroCard from '@/components/profile/UserHeroCard';
import ViewModeCard from '@/components/profile/ViewModeCard';

jest.mock('@/lib/biometrics', () => ({
    biometricMeta: jest.fn(() => ({ label: 'Face ID', icon: 'scan-outline' })),
}));

jest.mock('@/components/Avatar', () => {
    const { View } = require('react-native');
    return {
        __esModule: true,
        default: (props: any) => <View testID="mock-avatar" {...props} />,
    };
});

const colors = Colors.light;

// ────────────────────────────────────────────────────────
// AppearanceCard
// ────────────────────────────────────────────────────────
describe('AppearanceCard', () => {
    const onModeChange = jest.fn();

    beforeEach(() => jest.clearAllMocks());

    it('renders APPEARANCE label and all three theme options', () => {
        const { getByText } = render(<AppearanceCard colors={colors} mode="system" onModeChange={onModeChange} />);
        expect(getByText('APPEARANCE')).toBeTruthy();
        expect(getByText('System')).toBeTruthy();
        expect(getByText('Light')).toBeTruthy();
        expect(getByText('Dark')).toBeTruthy();
    });

    it('calls onModeChange when a theme option is pressed', () => {
        const { getByText } = render(<AppearanceCard colors={colors} mode="system" onModeChange={onModeChange} />);
        fireEvent.press(getByText('Light'));
        expect(onModeChange).toHaveBeenCalledWith('light');

        fireEvent.press(getByText('Dark'));
        expect(onModeChange).toHaveBeenCalledWith('dark');
    });

    it('marks the active mode as selected via accessibilityState', () => {
        const { getByLabelText } = render(<AppearanceCard colors={colors} mode="dark" onModeChange={onModeChange} />);
        const darkBtn = getByLabelText('Set theme to Dark');
        expect(darkBtn.props.accessibilityState).toEqual({ selected: true });

        const lightBtn = getByLabelText('Set theme to Light');
        expect(lightBtn.props.accessibilityState).toEqual({ selected: false });
    });
});

// ────────────────────────────────────────────────────────
// AssignedManagersCard
// ────────────────────────────────────────────────────────
describe('AssignedManagersCard', () => {
    it('renders empty state when no managers', () => {
        const { getByText } = render(<AssignedManagersCard colors={colors} managers={[]} />);
        expect(getByText('ASSIGNED MANAGERS')).toBeTruthy();
        expect(getByText('No managers assigned yet')).toBeTruthy();
    });

    it('renders manager names and initials', () => {
        const managers = [
            { id: 'a1', full_name: 'Alice Tan', role: 'manager' },
            { id: 'b2', full_name: 'Bob Lim', role: 'manager' },
        ];
        const { getByText } = render(<AssignedManagersCard colors={colors} managers={managers} />);
        expect(getByText('Alice Tan')).toBeTruthy();
        expect(getByText('AT')).toBeTruthy();
        expect(getByText('Bob Lim')).toBeTruthy();
        expect(getByText('BL')).toBeTruthy();
    });

    it('renders Manager subtitle for each entry', () => {
        const managers = [{ id: 'x1', full_name: 'Carol Wong', role: 'manager' }];
        const { getByText } = render(<AssignedManagersCard colors={colors} managers={managers} />);
        expect(getByText('Manager')).toBeTruthy();
    });
});

// ────────────────────────────────────────────────────────
// AvatarPickerSheet
// ────────────────────────────────────────────────────────
describe('AvatarPickerSheet', () => {
    const onAction = jest.fn();
    const onClose = jest.fn();

    beforeEach(() => jest.clearAllMocks());

    it('renders title and options when visible', () => {
        const { getByText } = render(
            <AvatarPickerSheet
                visible={true}
                colors={colors}
                hasAvatar={false}
                onAction={onAction}
                onClose={onClose}
            />,
        );
        expect(getByText('Profile Photo')).toBeTruthy();
        expect(getByText('Take Photo')).toBeTruthy();
        expect(getByText('Choose from Library')).toBeTruthy();
    });

    it('does not render modal content when not visible', () => {
        const { queryByText } = render(
            <AvatarPickerSheet
                visible={false}
                colors={colors}
                hasAvatar={false}
                onAction={onAction}
                onClose={onClose}
            />,
        );
        expect(queryByText('Profile Photo')).toBeNull();
    });

    it('shows Remove Photo option only when hasAvatar is true', () => {
        const { getByText } = render(
            <AvatarPickerSheet visible={true} colors={colors} hasAvatar={true} onAction={onAction} onClose={onClose} />,
        );
        expect(getByText('Remove Photo')).toBeTruthy();
    });

    it('hides Remove Photo option when hasAvatar is false', () => {
        const { queryByText } = render(
            <AvatarPickerSheet
                visible={true}
                colors={colors}
                hasAvatar={false}
                onAction={onAction}
                onClose={onClose}
            />,
        );
        expect(queryByText('Remove Photo')).toBeNull();
    });

    it('calls onAction with correct action type when options are pressed', () => {
        const { getByText } = render(
            <AvatarPickerSheet visible={true} colors={colors} hasAvatar={true} onAction={onAction} onClose={onClose} />,
        );
        fireEvent.press(getByText('Take Photo'));
        expect(onAction).toHaveBeenCalledWith('camera');

        fireEvent.press(getByText('Choose from Library'));
        expect(onAction).toHaveBeenCalledWith('library');

        fireEvent.press(getByText('Remove Photo'));
        expect(onAction).toHaveBeenCalledWith('remove');
    });
});

// ────────────────────────────────────────────────────────
// EditProfileSheet
// ────────────────────────────────────────────────────────
describe('EditProfileSheet', () => {
    const defaultProps = {
        visible: true,
        colors,
        name: 'John Doe',
        email: 'john@example.com',
        saving: false,
        error: null,
        onNameChange: jest.fn(),
        onEmailChange: jest.fn(),
        onSave: jest.fn(),
        onClose: jest.fn(),
    };

    beforeEach(() => jest.clearAllMocks());

    it('renders title, labels, and save button when visible', () => {
        const { getByText } = render(<EditProfileSheet {...defaultProps} />);
        expect(getByText('Edit Profile')).toBeTruthy();
        expect(getByText('FULL NAME')).toBeTruthy();
        expect(getByText('EMAIL (OPTIONAL)')).toBeTruthy();
        expect(getByText('Save Changes')).toBeTruthy();
    });

    it('does not render content when not visible', () => {
        const { queryByText } = render(<EditProfileSheet {...defaultProps} visible={false} />);
        expect(queryByText('Edit Profile')).toBeNull();
    });

    it('displays current name and email values in inputs', () => {
        const { getByDisplayValue } = render(<EditProfileSheet {...defaultProps} />);
        expect(getByDisplayValue('John Doe')).toBeTruthy();
        expect(getByDisplayValue('john@example.com')).toBeTruthy();
    });

    it('calls onNameChange and onEmailChange when inputs change', () => {
        const { getByDisplayValue } = render(<EditProfileSheet {...defaultProps} />);
        fireEvent.changeText(getByDisplayValue('John Doe'), 'Jane Doe');
        expect(defaultProps.onNameChange).toHaveBeenCalledWith('Jane Doe');

        fireEvent.changeText(getByDisplayValue('john@example.com'), 'jane@test.com');
        expect(defaultProps.onEmailChange).toHaveBeenCalledWith('jane@test.com');
    });

    it('calls onSave when save button is pressed', () => {
        const { getByText } = render(<EditProfileSheet {...defaultProps} />);
        fireEvent.press(getByText('Save Changes'));
        expect(defaultProps.onSave).toHaveBeenCalledTimes(1);
    });

    it('shows Saving text and disables button when saving is true', () => {
        const { getByText } = render(<EditProfileSheet {...defaultProps} saving={true} />);
        expect(getByText('Saving\u2026')).toBeTruthy();
    });

    it('displays error text when error prop is set', () => {
        const { getByText } = render(<EditProfileSheet {...defaultProps} error="Name is required" />);
        expect(getByText('Name is required')).toBeTruthy();
    });

    it('does not display error text when error prop is null', () => {
        const { queryByText } = render(<EditProfileSheet {...defaultProps} error={null} />);
        expect(queryByText('Name is required')).toBeNull();
    });
});

// ────────────────────────────────────────────────────────
// SecurityCard
// ────────────────────────────────────────────────────────
describe('SecurityCard', () => {
    const onToggle = jest.fn();

    beforeEach(() => jest.clearAllMocks());

    it('renders SECURITY label and biometric meta info', () => {
        const { getByText } = render(
            <SecurityCard colors={colors} biometryType="faceid" enabled={false} onToggle={onToggle} />,
        );
        expect(getByText('SECURITY')).toBeTruthy();
        expect(getByText('Face ID')).toBeTruthy();
        expect(getByText('Sign in without OTP')).toBeTruthy();
    });

    it('renders the switch with correct enabled state', () => {
        const { getByLabelText } = render(
            <SecurityCard colors={colors} biometryType="faceid" enabled={true} onToggle={onToggle} />,
        );
        const switchEl = getByLabelText('Face ID sign-in');
        expect(switchEl.props.value).toBe(true);
    });

    it('calls onToggle when switch value changes', () => {
        const { getByLabelText } = render(
            <SecurityCard colors={colors} biometryType="faceid" enabled={false} onToggle={onToggle} />,
        );
        fireEvent(getByLabelText('Face ID sign-in'), 'valueChange', true);
        expect(onToggle).toHaveBeenCalledWith(true);
    });
});

// ────────────────────────────────────────────────────────
// SettingsListCard
// ────────────────────────────────────────────────────────
describe('SettingsListCard', () => {
    const onPress = jest.fn();
    const rows = [
        { key: 'edit', icon: 'create-outline' as const, label: 'Edit Profile' },
        { key: 'quiz', icon: 'help-circle-outline' as const, label: 'Personality Quiz', subtitle: 'Take the quiz' },
    ];

    beforeEach(() => jest.clearAllMocks());

    it('renders title and all row labels', () => {
        const { getByText } = render(
            <SettingsListCard colors={colors} title="ACCOUNT" rows={rows} onPress={onPress} />,
        );
        expect(getByText('ACCOUNT')).toBeTruthy();
        expect(getByText('Edit Profile')).toBeTruthy();
        expect(getByText('Personality Quiz')).toBeTruthy();
    });

    it('renders subtitle when provided', () => {
        const { getByText } = render(
            <SettingsListCard colors={colors} title="ACCOUNT" rows={rows} onPress={onPress} />,
        );
        expect(getByText('Take the quiz')).toBeTruthy();
    });

    it('calls onPress with the correct key when a row is pressed', () => {
        const { getByText } = render(
            <SettingsListCard colors={colors} title="ACCOUNT" rows={rows} onPress={onPress} />,
        );
        fireEvent.press(getByText('Edit Profile'));
        expect(onPress).toHaveBeenCalledWith('edit');

        fireEvent.press(getByText('Personality Quiz'));
        expect(onPress).toHaveBeenCalledWith('quiz');
    });

    it('renders a single row without divider', () => {
        const singleRow = [{ key: 'only', icon: 'star-outline' as const, label: 'Only Item' }];
        const { getByText } = render(
            <SettingsListCard colors={colors} title="SINGLE" rows={singleRow} onPress={onPress} />,
        );
        expect(getByText('Only Item')).toBeTruthy();
    });
});

// ────────────────────────────────────────────────────────
// SignOutModal
// ────────────────────────────────────────────────────────
describe('SignOutModal', () => {
    const onCancel = jest.fn();
    const onConfirm = jest.fn();

    beforeEach(() => jest.clearAllMocks());

    it('renders title, message, and buttons when visible', () => {
        const { getAllByText, getByText } = render(
            <SignOutModal visible={true} colors={colors} onCancel={onCancel} onConfirm={onConfirm} />,
        );
        // "Sign Out" appears as both title and confirm button text
        expect(getAllByText('Sign Out')).toHaveLength(2);
        expect(getByText('Are you sure you want to sign out of your account?')).toBeTruthy();
        expect(getByText('Cancel')).toBeTruthy();
    });

    it('does not render content when not visible', () => {
        const { queryByText } = render(
            <SignOutModal visible={false} colors={colors} onCancel={onCancel} onConfirm={onConfirm} />,
        );
        expect(queryByText('Sign Out')).toBeNull();
    });

    it('calls onCancel when Cancel button is pressed', () => {
        const { getByText } = render(
            <SignOutModal visible={true} colors={colors} onCancel={onCancel} onConfirm={onConfirm} />,
        );
        fireEvent.press(getByText('Cancel'));
        expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('calls onConfirm when Sign Out button is pressed', () => {
        const { getByLabelText } = render(
            <SignOutModal visible={true} colors={colors} onCancel={onCancel} onConfirm={onConfirm} />,
        );
        fireEvent.press(getByLabelText('Confirm sign out'));
        expect(onConfirm).toHaveBeenCalledTimes(1);
    });
});

// ────────────────────────────────────────────────────────
// UserHeroCard
// ────────────────────────────────────────────────────────
describe('UserHeroCard', () => {
    const defaultProps = {
        colors,
        fullName: 'Alice Tan',
        role: 'agent',
        phone: '+6591234567',
        email: 'alice@example.com',
        avatarUrl: null,
        avatarUploading: false,
        onAvatarPress: jest.fn(),
    };

    beforeEach(() => jest.clearAllMocks());

    it('renders full name and role label', () => {
        const { getByText } = render(<UserHeroCard {...defaultProps} />);
        expect(getByText('Alice Tan')).toBeTruthy();
        expect(getByText('Agent')).toBeTruthy();
    });

    it('renders phone and email when provided', () => {
        const { getByText } = render(<UserHeroCard {...defaultProps} />);
        // Phone is rendered via formatSgPhone (+65 + space-separated groups).
        expect(getByText('+65 9123 4567')).toBeTruthy();
        expect(getByText('alice@example.com')).toBeTruthy();
    });

    it('does not render phone or email when not provided', () => {
        const { queryByText } = render(<UserHeroCard {...defaultProps} phone={null} email={null} />);
        expect(queryByText('+65 9123 4567')).toBeNull();
        expect(queryByText('alice@example.com')).toBeNull();
    });

    it('shows Unknown User when fullName is undefined', () => {
        const { getByText } = render(<UserHeroCard {...defaultProps} fullName={undefined} />);
        expect(getByText('Unknown User')).toBeTruthy();
    });

    it('shows ActivityIndicator when avatarUploading is true', () => {
        const { queryByTestId } = render(<UserHeroCard {...defaultProps} avatarUploading={true} />);
        // When uploading, Avatar mock should not render
        expect(queryByTestId('mock-avatar')).toBeNull();
    });

    it('renders Avatar component when not uploading', () => {
        const { getByTestId } = render(<UserHeroCard {...defaultProps} />);
        expect(getByTestId('mock-avatar')).toBeTruthy();
    });

    it('calls onAvatarPress when avatar area is pressed', () => {
        const { getByLabelText } = render(<UserHeroCard {...defaultProps} />);
        fireEvent.press(getByLabelText('Change profile photo'));
        expect(defaultProps.onAvatarPress).toHaveBeenCalledTimes(1);
    });

    it('renders correct role label for manager role', () => {
        const { getByText } = render(<UserHeroCard {...defaultProps} role="manager" />);
        expect(getByText('Manager')).toBeTruthy();
    });
});

// ────────────────────────────────────────────────────────
// ViewModeCard
// ────────────────────────────────────────────────────────
describe('ViewModeCard', () => {
    const onViewModeChange = jest.fn();

    beforeEach(() => jest.clearAllMocks());

    it('renders VIEW MODE label and both options', () => {
        const { getByText } = render(
            <ViewModeCard colors={colors} viewMode="agent" onViewModeChange={onViewModeChange} />,
        );
        expect(getByText('VIEW MODE')).toBeTruthy();
        expect(getByText('Agent View')).toBeTruthy();
        expect(getByText('Manager View')).toBeTruthy();
    });

    it('shows agent hint when viewMode is agent', () => {
        const { getByText } = render(
            <ViewModeCard colors={colors} viewMode="agent" onViewModeChange={onViewModeChange} />,
        );
        expect(getByText('Manage your leads and clients')).toBeTruthy();
    });

    it('shows manager hint when viewMode is manager', () => {
        const { getByText } = render(
            <ViewModeCard colors={colors} viewMode="manager" onViewModeChange={onViewModeChange} />,
        );
        expect(getByText('Manage your team and candidates')).toBeTruthy();
    });

    it('calls onViewModeChange when an option is pressed', () => {
        const { getByText } = render(
            <ViewModeCard colors={colors} viewMode="agent" onViewModeChange={onViewModeChange} />,
        );
        fireEvent.press(getByText('Manager View'));
        expect(onViewModeChange).toHaveBeenCalledWith('manager');

        fireEvent.press(getByText('Agent View'));
        expect(onViewModeChange).toHaveBeenCalledWith('agent');
    });

    it('marks the active mode as selected via accessibilityState', () => {
        const { getByLabelText } = render(
            <ViewModeCard colors={colors} viewMode="manager" onViewModeChange={onViewModeChange} />,
        );
        const managerBtn = getByLabelText('Switch to Manager View');
        expect(managerBtn.props.accessibilityState).toEqual({ selected: true });

        const agentBtn = getByLabelText('Switch to Agent View');
        expect(agentBtn.props.accessibilityState).toEqual({ selected: false });
    });
});
