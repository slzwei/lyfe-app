/**
 * Tests for components/leads/RecordingCard.tsx — including audio state machine
 */
import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import RecordingCard from '@/components/leads/RecordingCard';
import { useTheme } from '@/contexts/ThemeContext';
import { Colors } from '@/constants/Colors';
import { Audio } from 'expo-av';

jest.mock('@/contexts/ThemeContext');

// Capture the status callback for manual invocation
let capturedStatusCallback: ((status: any) => void) | null = null;
const mockPlayAsync = jest.fn();
const mockPauseAsync = jest.fn();
const mockUnloadAsync = jest.fn();
const mockGetStatusAsync = jest.fn().mockResolvedValue({ isLoaded: true, isPlaying: false });

jest.mock('expo-av', () => ({
    Audio: {
        setAudioModeAsync: jest.fn(),
        Sound: {
            createAsync: jest.fn().mockImplementation(async (_source: any, _opts: any, statusCb: any) => {
                capturedStatusCallback = statusCb;
                return {
                    sound: {
                        playAsync: mockPlayAsync,
                        pauseAsync: mockPauseAsync,
                        stopAsync: jest.fn(),
                        unloadAsync: mockUnloadAsync,
                        getStatusAsync: mockGetStatusAsync,
                        setOnPlaybackStatusUpdate: jest.fn(),
                    },
                    status: { isLoaded: true, durationMillis: 60000 },
                };
            }),
        },
    },
}));

beforeEach(() => {
    jest.clearAllMocks();
    capturedStatusCallback = null;
    (useTheme as jest.Mock).mockReturnValue({
        colors: Colors.light,
        isDark: false,
        mode: 'light',
        resolved: 'light',
        setMode: jest.fn(),
    });
});

describe('RecordingCard', () => {
    it('renders Call Recording header with audio URL', () => {
        const { getByText } = render(<RecordingCard recordingUrl="https://example.com/rec.mp3" transcript={null} />);
        expect(getByText('Call Recording')).toBeTruthy();
    });

    it('renders Call Transcript header without audio URL', () => {
        const { getByText } = render(<RecordingCard recordingUrl={null} transcript="Some transcript" />);
        expect(getByText('Call Transcript')).toBeTruthy();
    });

    it('renders play button with audio URL', () => {
        const { getByLabelText } = render(
            <RecordingCard recordingUrl="https://example.com/rec.mp3" transcript={null} />,
        );
        expect(getByLabelText('Play recording')).toBeTruthy();
    });

    it('renders transcript toggle when transcript exists', () => {
        const { getByText } = render(
            <RecordingCard recordingUrl="https://example.com/rec.mp3" transcript="Hello world" />,
        );
        expect(getByText('Transcript')).toBeTruthy();
    });

    it('shows transcript text on toggle press', () => {
        const { getByText, getByLabelText } = render(
            <RecordingCard recordingUrl="https://example.com/rec.mp3" transcript="Hello world" />,
        );
        fireEvent.press(getByLabelText('Show transcript'));
        expect(getByText('Hello world')).toBeTruthy();
    });

    it('hides transcript on second toggle press', () => {
        const { queryByText, getByLabelText } = render(
            <RecordingCard recordingUrl="https://example.com/rec.mp3" transcript="Hello world" />,
        );
        fireEvent.press(getByLabelText('Show transcript'));
        expect(queryByText('Hello world')).toBeTruthy();
        fireEvent.press(getByLabelText('Hide transcript'));
        expect(queryByText('Hello world')).toBeNull();
    });

    it('does not show transcript toggle when transcript is null', () => {
        const { queryByText } = render(<RecordingCard recordingUrl="https://example.com/rec.mp3" transcript={null} />);
        expect(queryByText('Transcript')).toBeNull();
    });

    it('renders time display with initial 0:00', () => {
        const { getAllByText } = render(<RecordingCard recordingUrl="https://example.com/rec.mp3" transcript={null} />);
        expect(getAllByText('0:00').length).toBeGreaterThanOrEqual(1);
    });

    // ── Audio state machine ──

    it('calls createAsync when play button pressed', async () => {
        const { getByLabelText } = render(
            <RecordingCard recordingUrl="https://example.com/rec.mp3" transcript={null} />,
        );

        await act(async () => {
            fireEvent.press(getByLabelText('Play recording'));
        });

        expect(Audio.Sound.createAsync).toHaveBeenCalledWith(
            { uri: 'https://example.com/rec.mp3' },
            { shouldPlay: true },
            expect.any(Function),
        );
    });

    it('updates position and duration from status callback', async () => {
        const { getByLabelText, getByText } = render(
            <RecordingCard recordingUrl="https://example.com/rec.mp3" transcript={null} />,
        );

        // Play to trigger createAsync and capture callback
        await act(async () => {
            fireEvent.press(getByLabelText('Play recording'));
        });

        expect(capturedStatusCallback).not.toBeNull();

        // Simulate playback progress
        await act(async () => {
            capturedStatusCallback!({
                isLoaded: true,
                positionMillis: 30000,
                durationMillis: 60000,
            });
        });

        // Should show 0:30 position and 1:00 duration
        expect(getByText('0:30')).toBeTruthy();
        expect(getByText('1:00')).toBeTruthy();
    });

    it('resets state when playback finishes (didJustFinish)', async () => {
        const { getByLabelText } = render(
            <RecordingCard recordingUrl="https://example.com/rec.mp3" transcript={null} />,
        );

        await act(async () => {
            fireEvent.press(getByLabelText('Play recording'));
        });

        // Simulate playback finishing
        await act(async () => {
            capturedStatusCallback!({
                isLoaded: true,
                positionMillis: 60000,
                durationMillis: 60000,
                didJustFinish: true,
            });
        });

        // Should be back to "Play recording" (not "Pause recording")
        expect(getByLabelText('Play recording')).toBeTruthy();
    });

    it('pauses on second press (toggle play/pause)', async () => {
        const { getByLabelText } = render(
            <RecordingCard recordingUrl="https://example.com/rec.mp3" transcript={null} />,
        );

        // First press: play
        await act(async () => {
            fireEvent.press(getByLabelText('Play recording'));
        });

        // After createAsync, state becomes "playing" → label changes to "Pause recording"
        await waitFor(() => {
            expect(getByLabelText('Pause recording')).toBeTruthy();
        });

        // Second press: pause
        await act(async () => {
            fireEvent.press(getByLabelText('Pause recording'));
        });

        expect(mockPauseAsync).toHaveBeenCalled();
    });

    it('resumes playback after pause', async () => {
        mockGetStatusAsync.mockResolvedValue({ isLoaded: true, isPlaying: false });

        const { getByLabelText } = render(
            <RecordingCard recordingUrl="https://example.com/rec.mp3" transcript={null} />,
        );

        // Play → pause → play again
        await act(async () => {
            fireEvent.press(getByLabelText('Play recording'));
        });

        await act(async () => {
            fireEvent.press(getByLabelText('Pause recording'));
        });

        // Now press play again — should call playAsync on existing sound
        await act(async () => {
            fireEvent.press(getByLabelText('Play recording'));
        });

        expect(mockPlayAsync).toHaveBeenCalled();
    });

    it('cleans up sound on unmount', async () => {
        const { getByLabelText, unmount } = render(
            <RecordingCard recordingUrl="https://example.com/rec.mp3" transcript={null} />,
        );

        // Play to create the sound
        await act(async () => {
            fireEvent.press(getByLabelText('Play recording'));
        });

        unmount();
        expect(mockUnloadAsync).toHaveBeenCalled();
    });
});
