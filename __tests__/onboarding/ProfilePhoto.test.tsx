import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { Colors } from '@/constants/Colors';
import { pickAndUploadAvatar, takeAndUploadAvatar, removeAvatar } from '@/lib/storage';
import ProfilePhotoScreen from '@/app/onboarding/ProfilePhoto';

jest.mock('@/lib/supabase');
jest.mock('@/contexts/ThemeContext');
jest.mock('@/contexts/AuthContext');
jest.mock('@/lib/storage', () => ({
    pickAndUploadAvatar: jest.fn(),
    takeAndUploadAvatar: jest.fn(),
    removeAvatar: jest.fn(),
}));

const mockPush = jest.fn();
const mockUpdateAvatarUrl = jest.fn();

beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({
        push: mockPush,
        replace: jest.fn(),
        back: jest.fn(),
    });
    (useTheme as jest.Mock).mockReturnValue({
        colors: Colors.light,
        isDark: false,
        mode: 'light',
        resolved: 'light',
        setMode: jest.fn(),
    });
    (useAuth as jest.Mock).mockReturnValue({
        user: { id: 'user-1', full_name: 'John Doe', phone: '+6580000004', role: 'agent', avatar_url: null },
        updateAvatarUrl: mockUpdateAvatarUrl,
    });
});

describe('ProfilePhotoScreen', () => {
    it('renders the photo prompt', () => {
        const { getByText } = render(<ProfilePhotoScreen />);
        expect(getByText('photo')).toBeTruthy();
        expect(getByText('Help your team recognise you at a glance.')).toBeTruthy();
    });

    it('shows user initial in the avatar placeholder', () => {
        const { getByText } = render(<ProfilePhotoScreen />);
        expect(getByText('J')).toBeTruthy(); // initial of "John Doe"
    });

    it('shows "Tap to add" hint when no avatar', () => {
        const { getByText } = render(<ProfilePhotoScreen />);
        expect(getByText('Tap to add')).toBeTruthy();
    });

    it('shows "Skip for now" button when no avatar', () => {
        const { getByTestId } = render(<ProfilePhotoScreen />);
        expect(getByTestId('continue-button')).toHaveTextContent('Skip for now');
    });

    it('shows "Continue" button when avatar exists', () => {
        (useAuth as jest.Mock).mockReturnValue({
            user: {
                id: 'user-1',
                full_name: 'John Doe',
                phone: '+6580000004',
                role: 'agent',
                avatar_url: 'https://example.com/avatar.jpg',
            },
            updateAvatarUrl: mockUpdateAvatarUrl,
        });
        const { getByTestId } = render(<ProfilePhotoScreen />);
        expect(getByTestId('continue-button')).toHaveTextContent('Continue');
    });

    it('opens avatar picker sheet when avatar area is tapped', () => {
        const { getByTestId, getByText } = render(<ProfilePhotoScreen />);
        fireEvent.press(getByTestId('avatar-button'));
        expect(getByText('Profile Photo')).toBeTruthy();
    });

    it('navigates to AgencyInfo on continue', () => {
        const { getByTestId } = render(<ProfilePhotoScreen />);
        fireEvent.press(getByTestId('continue-button'));
        expect(mockPush).toHaveBeenCalledWith('/onboarding/AgencyInfo');
    });

    it('updates avatar after successful upload', async () => {
        (pickAndUploadAvatar as jest.Mock).mockResolvedValue({
            url: 'https://example.com/new-avatar.jpg',
            error: null,
        });
        const { getByTestId, getByText } = render(<ProfilePhotoScreen />);

        // Open sheet and pick from library
        fireEvent.press(getByTestId('avatar-button'));
        fireEvent.press(getByText('Choose from Library'));

        await waitFor(() => {
            expect(pickAndUploadAvatar).toHaveBeenCalledWith('user-1');
            expect(mockUpdateAvatarUrl).toHaveBeenCalledWith('https://example.com/new-avatar.jpg');
        });
    });

    it('takes photo with camera', async () => {
        (takeAndUploadAvatar as jest.Mock).mockResolvedValue({
            url: 'https://example.com/camera-photo.jpg',
            error: null,
        });
        const { getByTestId, getByText } = render(<ProfilePhotoScreen />);

        fireEvent.press(getByTestId('avatar-button'));
        fireEvent.press(getByText('Take Photo'));

        await waitFor(() => {
            expect(takeAndUploadAvatar).toHaveBeenCalledWith('user-1');
            expect(mockUpdateAvatarUrl).toHaveBeenCalledWith('https://example.com/camera-photo.jpg');
        });
    });

    it('removes avatar', async () => {
        (useAuth as jest.Mock).mockReturnValue({
            user: {
                id: 'user-1',
                full_name: 'John Doe',
                phone: '+6580000004',
                role: 'agent',
                avatar_url: 'https://example.com/avatar.jpg',
            },
            updateAvatarUrl: mockUpdateAvatarUrl,
        });
        (removeAvatar as jest.Mock).mockResolvedValue({ error: null });

        const { getByTestId, getByText } = render(<ProfilePhotoScreen />);

        fireEvent.press(getByTestId('avatar-button'));
        fireEvent.press(getByText('Remove Photo'));

        await waitFor(() => {
            expect(removeAvatar).toHaveBeenCalledWith('user-1');
            expect(mockUpdateAvatarUrl).toHaveBeenCalledWith(null);
        });
    });

    it('shows alert on upload error', async () => {
        const alertSpy = jest.spyOn(require('react-native').Alert, 'alert');
        (pickAndUploadAvatar as jest.Mock).mockResolvedValue({
            url: null,
            error: 'File too large',
        });
        const { getByTestId, getByText } = render(<ProfilePhotoScreen />);

        fireEvent.press(getByTestId('avatar-button'));
        fireEvent.press(getByText('Choose from Library'));

        await waitFor(() => {
            expect(alertSpy).toHaveBeenCalledWith('Upload Failed', 'File too large');
        });
    });
});
