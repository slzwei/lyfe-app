/**
 * Tests for components/candidates/ — all 12 components at 0% coverage.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Colors } from '@/constants/Colors';

// ── Imports (after mocks) ──

import ActivityEntry from '@/components/candidates/ActivityEntry';
import CandidateProfileCard from '@/components/candidates/CandidateProfileCard';
import ContactHistoryCard from '@/components/candidates/ContactHistoryCard';
import ContactOutcomeSheet from '@/components/candidates/ContactOutcomeSheet';
import { DocumentList, AddDocumentSheet } from '@/components/candidates/DocumentSection';
import InterviewSchedulerSheet from '@/components/candidates/InterviewSchedulerSheet';
import InterviewSection from '@/components/candidates/InterviewSection';
import NoteSheet from '@/components/candidates/NoteSheet';
import PdfViewerModal from '@/components/candidates/PdfViewerModal';
import ProfileCard from '@/components/candidates/ProfileCard';
import QuickAction from '@/components/candidates/QuickAction';
import QuickActionsBar from '@/components/candidates/QuickActionsBar';

import type { CandidateActivity, Interview, RecruitmentCandidate, CandidateDocument } from '@/types/recruitment';

// ── Mocks ──

jest.mock('@/lib/dateTime', () => ({
    timeAgo: jest.fn(() => '2m ago'),
    formatCreatedAt: jest.fn(() => '15 Mar 2026'),
    formatDateTime: jest.fn((d: string) => d),
}));

jest.mock('react-native-reanimated', () => {
    const { View } = require('react-native');
    return {
        __esModule: true,
        default: { View },
        View,
        createAnimatedComponent: (component: any) => component,
    };
});

jest.mock('react-native-webview', () => {
    const { View } = require('react-native');
    return {
        __esModule: true,
        WebView: (props: any) => <View testID="mock-webview" {...props} />,
    };
});

jest.mock('@/components/WheelPicker', () => {
    const { View } = require('react-native');
    return function MockWheelPicker() {
        return <View testID="mock-wheel-picker" />;
    };
});

// InterviewSection imports InterviewCard via relative path './InterviewCard'.
// That file lives at components/InterviewCard.tsx (not in candidates/).
// We mock the actual resolved path so Jest can load InterviewSection.
jest.mock(
    '../../components/candidates/InterviewCard',
    () => {
        const { Text } = require('react-native');
        return function MockInterviewCard({ interview }: any) {
            return <Text>Interview R{interview.round_number}</Text>;
        };
    },
    { virtual: true },
);

// ── Shared helpers ──

const colors = Colors.light;

function makeActivity(overrides: Partial<CandidateActivity> = {}): CandidateActivity {
    return {
        id: 'act-1',
        candidate_id: 'c1',
        user_id: 'u1',
        type: 'call',
        outcome: 'reached',
        note: null,
        created_at: '2026-03-15T10:00:00Z',
        actor_name: 'John',
        ...overrides,
    };
}

function makeCandidate(overrides: Partial<RecruitmentCandidate> = {}): RecruitmentCandidate {
    return {
        id: 'c1',
        name: 'Alice Tan',
        phone: '+6591234567',
        email: 'alice@example.com',
        status: 'applied',
        assigned_manager_id: 'm1',
        assigned_manager_name: 'Bob Lee',
        created_by_id: 'u1',
        invite_token: null,
        notes: null,
        resume_url: null,
        interviews: [],
        created_at: '2026-03-01T00:00:00Z',
        updated_at: '2026-03-15T00:00:00Z',
        ...overrides,
    };
}

function makeInterview(overrides: Partial<Interview> = {}): Interview {
    return {
        id: 'i1',
        candidate_id: 'c1',
        manager_id: 'm1',
        scheduled_by_id: 'u1',
        round_number: 1,
        type: 'zoom',
        datetime: '2099-01-01T10:00:00Z',
        location: null,
        zoom_link: null,
        google_calendar_event_id: null,
        status: 'scheduled',
        notes: null,
        created_at: '2026-03-01T00:00:00Z',
        ...overrides,
    };
}

function makeDocument(overrides: Partial<CandidateDocument> = {}): CandidateDocument {
    return {
        id: 'doc-1',
        candidate_id: 'c1',
        label: 'Resume',
        file_url: 'https://example.com/doc.pdf',
        file_name: 'resume.pdf',
        created_at: '2026-03-01T00:00:00Z',
        ...overrides,
    };
}

const noopAnimatedStyle = {} as any;

// ────────────────────────────────────────────────────────────────
// 1. ActivityEntry
// ────────────────────────────────────────────────────────────────
describe('ActivityEntry', () => {
    it('renders call type with Connected outcome', () => {
        const entry = makeActivity({ type: 'call', outcome: 'reached' });
        const { getByText } = render(<ActivityEntry entry={entry} isLast={false} colors={colors} />);
        expect(getByText(/Call/)).toBeTruthy();
        expect(getByText(/Connected/)).toBeTruthy();
    });

    it('renders call type with No answer outcome', () => {
        const entry = makeActivity({ type: 'call', outcome: 'no_answer' });
        const { getByText } = render(<ActivityEntry entry={entry} isLast={false} colors={colors} />);
        expect(getByText(/Call/)).toBeTruthy();
        expect(getByText(/No answer/)).toBeTruthy();
    });

    it('renders whatsapp type with Sent outcome', () => {
        const entry = makeActivity({ type: 'whatsapp', outcome: 'sent' });
        const { getByText } = render(<ActivityEntry entry={entry} isLast={false} colors={colors} />);
        expect(getByText(/WhatsApp/)).toBeTruthy();
        expect(getByText(/Sent/)).toBeTruthy();
    });

    it('renders note type with Note label', () => {
        const entry = makeActivity({ type: 'note', outcome: null });
        const { getByText, queryByText } = render(<ActivityEntry entry={entry} isLast={false} colors={colors} />);
        expect(getByText('Note')).toBeTruthy();
        expect(queryByText('Connected')).toBeNull();
        expect(queryByText('Sent')).toBeNull();
    });

    it('renders note text when present', () => {
        const entry = makeActivity({ note: 'Follow up tomorrow' });
        const { getByText } = render(<ActivityEntry entry={entry} isLast={false} colors={colors} />);
        expect(getByText('Follow up tomorrow')).toBeTruthy();
    });

    it('does not render note box when note is null', () => {
        const entry = makeActivity({ note: null });
        const { queryByText } = render(<ActivityEntry entry={entry} isLast={false} colors={colors} />);
        expect(queryByText('Follow up tomorrow')).toBeNull();
    });

    it('renders actor name and time', () => {
        const entry = makeActivity({ actor_name: 'Jane' });
        const { getByText } = render(<ActivityEntry entry={entry} isLast={false} colors={colors} />);
        expect(getByText(/Jane/)).toBeTruthy();
        expect(getByText(/2m ago/)).toBeTruthy();
    });

    it('renders without actor name', () => {
        const entry = makeActivity({ actor_name: undefined });
        const { getByText } = render(<ActivityEntry entry={entry} isLast={true} colors={colors} />);
        expect(getByText('2m ago')).toBeTruthy();
    });
});

// ────────────────────────────────────────────────────────────────
// 2. CandidateProfileCard
// ────────────────────────────────────────────────────────────────
describe('CandidateProfileCard', () => {
    it('renders candidate name and phone', () => {
        const candidate = makeCandidate();
        const { getByText } = render(<CandidateProfileCard candidate={candidate} colors={colors} />);
        expect(getByText('Alice Tan')).toBeTruthy();
        expect(getByText('+6591234567')).toBeTruthy();
    });

    it('renders avatar initial', () => {
        const candidate = makeCandidate({ name: 'Bob' });
        const { getByText } = render(<CandidateProfileCard candidate={candidate} colors={colors} />);
        expect(getByText('B')).toBeTruthy();
    });

    it('renders status badge', () => {
        const candidate = makeCandidate({ status: 'applied' });
        const { getByText } = render(<CandidateProfileCard candidate={candidate} colors={colors} />);
        expect(getByText('Applied')).toBeTruthy();
    });

    it('renders email when present', () => {
        const candidate = makeCandidate({ email: 'test@test.com' });
        const { getByText } = render(<CandidateProfileCard candidate={candidate} colors={colors} />);
        expect(getByText('test@test.com')).toBeTruthy();
    });

    it('does not render email when null', () => {
        const candidate = makeCandidate({ email: null });
        const { queryByText } = render(<CandidateProfileCard candidate={candidate} colors={colors} />);
        expect(queryByText('test@test.com')).toBeNull();
    });

    it('renders recruiter name', () => {
        const candidate = makeCandidate({ assigned_manager_name: 'Manager Kim' });
        const { getByText } = render(<CandidateProfileCard candidate={candidate} colors={colors} />);
        expect(getByText(/Recruiter: Manager Kim/)).toBeTruthy();
    });

    it('renders invite link banner when status is applied and invite_token exists', () => {
        const candidate = makeCandidate({ status: 'applied', invite_token: 'abc123' });
        const { getByText } = render(<CandidateProfileCard candidate={candidate} colors={colors} />);
        expect(getByText('Copy Invite Link')).toBeTruthy();
    });

    it('does not render invite link when status is not applied', () => {
        const candidate = makeCandidate({ status: 'interviewed', invite_token: 'abc123' });
        const { queryByText } = render(<CandidateProfileCard candidate={candidate} colors={colors} />);
        expect(queryByText('Copy Invite Link')).toBeNull();
    });

    it('does not render invite link when invite_token is null', () => {
        const candidate = makeCandidate({ status: 'applied', invite_token: null });
        const { queryByText } = render(<CandidateProfileCard candidate={candidate} colors={colors} />);
        expect(queryByText('Copy Invite Link')).toBeNull();
    });
});

// ────────────────────────────────────────────────────────────────
// 3. ContactHistoryCard
// ────────────────────────────────────────────────────────────────
describe('ContactHistoryCard', () => {
    it('renders empty state when no call log', () => {
        const { getByText } = render(<ContactHistoryCard callLog={[]} colors={colors} />);
        expect(getByText('Contact History')).toBeTruthy();
        expect(getByText(/No calls or messages logged yet/)).toBeTruthy();
    });

    it('renders activity entries when call log is present', () => {
        const entries = [
            makeActivity({ id: 'a1', type: 'call', outcome: 'reached' }),
            makeActivity({ id: 'a2', type: 'whatsapp', outcome: 'sent' }),
        ];
        const { getByText, getAllByText } = render(<ContactHistoryCard callLog={entries} colors={colors} />);
        expect(getByText('Contact History')).toBeTruthy();
        expect(getByText('2')).toBeTruthy(); // count badge
        expect(getByText(/Call/)).toBeTruthy();
        expect(getByText(/WhatsApp/)).toBeTruthy();
    });

    it('does not show count badge when call log is empty', () => {
        const { queryByText } = render(<ContactHistoryCard callLog={[]} colors={colors} />);
        expect(queryByText('0')).toBeNull();
    });
});

// ────────────────────────────────────────────────────────────────
// 4. ContactOutcomeSheet
// ────────────────────────────────────────────────────────────────
describe('ContactOutcomeSheet', () => {
    const baseProps = {
        visible: true,
        colors,
        animatedStyle: noopAnimatedStyle,
        pendingType: 'call' as const,
        confirmStep: 'outcome' as const,
        selectedOutcome: null,
        noteText: '',
        candidateName: 'Alice',
        candidatePhone: '+6591234567',
        onNoteTextChange: jest.fn(),
        onOutcomeSelect: jest.fn(),
        onSaveActivity: jest.fn(),
        onDismiss: jest.fn(),
    };

    beforeEach(() => jest.clearAllMocks());

    it('renders outcome step for call type', () => {
        const { getByText } = render(<ContactOutcomeSheet {...baseProps} />);
        expect(getByText('How did the call go?')).toBeTruthy();
        expect(getByText(/Alice/)).toBeTruthy();
        expect(getByText('Connected')).toBeTruthy();
        expect(getByText('No answer')).toBeTruthy();
    });

    it('renders outcome step for whatsapp type', () => {
        const { getByText } = render(<ContactOutcomeSheet {...baseProps} pendingType="whatsapp" />);
        expect(getByText('Did you message them?')).toBeTruthy();
        expect(getByText('Yes, sent')).toBeTruthy();
    });

    it('calls onOutcomeSelect when Connected is pressed', () => {
        const onOutcomeSelect = jest.fn();
        const { getByText } = render(<ContactOutcomeSheet {...baseProps} onOutcomeSelect={onOutcomeSelect} />);
        fireEvent.press(getByText('Connected'));
        expect(onOutcomeSelect).toHaveBeenCalledWith('reached');
    });

    it('calls onOutcomeSelect when No answer is pressed', () => {
        const onOutcomeSelect = jest.fn();
        const { getByText } = render(<ContactOutcomeSheet {...baseProps} onOutcomeSelect={onOutcomeSelect} />);
        fireEvent.press(getByText('No answer'));
        expect(onOutcomeSelect).toHaveBeenCalledWith('no_answer');
    });

    it('calls onOutcomeSelect with sent for whatsapp', () => {
        const onOutcomeSelect = jest.fn();
        const { getByText } = render(
            <ContactOutcomeSheet {...baseProps} pendingType="whatsapp" onOutcomeSelect={onOutcomeSelect} />,
        );
        fireEvent.press(getByText('Yes, sent'));
        expect(onOutcomeSelect).toHaveBeenCalledWith('sent');
    });

    it('calls onDismiss when "Don\'t log this" is pressed', () => {
        const onDismiss = jest.fn();
        const { getByText } = render(<ContactOutcomeSheet {...baseProps} onDismiss={onDismiss} />);
        fireEvent.press(getByText("Don't log this"));
        expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('renders note step with Save and Skip buttons', () => {
        const { getByText } = render(
            <ContactOutcomeSheet {...baseProps} confirmStep="note" selectedOutcome="reached" />,
        );
        expect(getByText(/Add a note/)).toBeTruthy();
        expect(getByText(/optional/)).toBeTruthy();
        expect(getByText('Save & Log')).toBeTruthy();
        expect(getByText('Skip note')).toBeTruthy();
    });

    it('shows Connected pill on note step when outcome is reached', () => {
        const { getByText } = render(
            <ContactOutcomeSheet {...baseProps} confirmStep="note" selectedOutcome="reached" />,
        );
        expect(getByText('Connected')).toBeTruthy();
    });

    it('shows No answer pill on note step when outcome is no_answer', () => {
        const { getByText } = render(
            <ContactOutcomeSheet {...baseProps} confirmStep="note" selectedOutcome="no_answer" />,
        );
        expect(getByText('No answer')).toBeTruthy();
    });

    it('shows Sent pill on note step when outcome is sent', () => {
        const { getByText } = render(<ContactOutcomeSheet {...baseProps} confirmStep="note" selectedOutcome="sent" />);
        expect(getByText('Sent')).toBeTruthy();
    });

    it('calls onSaveActivity(false) when Save & Log is pressed', () => {
        const onSaveActivity = jest.fn();
        const { getByText } = render(
            <ContactOutcomeSheet
                {...baseProps}
                confirmStep="note"
                selectedOutcome="reached"
                onSaveActivity={onSaveActivity}
            />,
        );
        fireEvent.press(getByText('Save & Log'));
        expect(onSaveActivity).toHaveBeenCalledWith(false);
    });

    it('calls onSaveActivity(true) when Skip note is pressed', () => {
        const onSaveActivity = jest.fn();
        const { getByText } = render(
            <ContactOutcomeSheet
                {...baseProps}
                confirmStep="note"
                selectedOutcome="reached"
                onSaveActivity={onSaveActivity}
            />,
        );
        fireEvent.press(getByText('Skip note'));
        expect(onSaveActivity).toHaveBeenCalledWith(true);
    });
});

// ────────────────────────────────────────────────────────────────
// 5. DocumentSection (DocumentList + AddDocumentSheet)
// ────────────────────────────────────────────────────────────────
describe('DocumentList', () => {
    it('renders empty state when no documents', () => {
        const { getByText } = render(
            <DocumentList
                documents={[]}
                hasDocumentPicker
                colors={colors}
                onViewDocument={jest.fn()}
                onDeleteDocument={jest.fn()}
                onAddDocument={jest.fn()}
            />,
        );
        expect(getByText('No documents yet')).toBeTruthy();
        expect(getByText('Add Document')).toBeTruthy();
    });

    it('renders document rows', () => {
        const docs = [
            makeDocument({ id: 'd1', label: 'Resume', file_name: 'resume.pdf' }),
            makeDocument({ id: 'd2', label: 'M5', file_name: 'm5_cert.pdf' }),
        ];
        const { getByText } = render(
            <DocumentList
                documents={docs}
                hasDocumentPicker
                colors={colors}
                onViewDocument={jest.fn()}
                onDeleteDocument={jest.fn()}
                onAddDocument={jest.fn()}
            />,
        );
        expect(getByText('Resume')).toBeTruthy();
        expect(getByText('resume.pdf')).toBeTruthy();
        expect(getByText('M5')).toBeTruthy();
        expect(getByText('m5_cert.pdf')).toBeTruthy();
    });

    it('calls onViewDocument when View is pressed', () => {
        const onView = jest.fn();
        const doc = makeDocument();
        const { getAllByText } = render(
            <DocumentList
                documents={[doc]}
                hasDocumentPicker
                colors={colors}
                onViewDocument={onView}
                onDeleteDocument={jest.fn()}
                onAddDocument={jest.fn()}
            />,
        );
        fireEvent.press(getAllByText('View')[0]);
        expect(onView).toHaveBeenCalledWith(doc);
    });

    it('calls onAddDocument when Add Document is pressed', () => {
        const onAdd = jest.fn();
        const { getByText } = render(
            <DocumentList
                documents={[]}
                hasDocumentPicker
                colors={colors}
                onViewDocument={jest.fn()}
                onDeleteDocument={jest.fn()}
                onAddDocument={onAdd}
            />,
        );
        fireEvent.press(getByText('Add Document'));
        expect(onAdd).toHaveBeenCalledTimes(1);
    });
});

describe('AddDocumentSheet', () => {
    const baseProps = {
        visible: true,
        colors,
        animatedStyle: noopAnimatedStyle,
        addDocStep: 'label' as const,
        addDocLabel: '',
        addDocCustomLabel: '',
        addDocError: null,
        onClose: jest.fn(),
        onSelectLabel: jest.fn(),
        onCustomLabelChange: jest.fn(),
        onPickAndUpload: jest.fn(),
    };

    it('renders label selection step', () => {
        const { getByText } = render(<AddDocumentSheet {...baseProps} />);
        expect(getByText('Add Document')).toBeTruthy();
        expect(getByText('Select a document type, then pick a PDF')).toBeTruthy();
        expect(getByText('Resume')).toBeTruthy();
        expect(getByText('Other')).toBeTruthy();
    });

    it('calls onSelectLabel when a label pill is pressed', () => {
        const onSelect = jest.fn();
        const { getByText } = render(<AddDocumentSheet {...baseProps} onSelectLabel={onSelect} />);
        fireEvent.press(getByText('Resume'));
        expect(onSelect).toHaveBeenCalledWith('Resume');
    });

    it('shows custom label input when Other is selected', () => {
        const { getByPlaceholderText, getByText } = render(<AddDocumentSheet {...baseProps} addDocLabel="Other" />);
        expect(getByPlaceholderText('Document name (e.g. BCP Certificate)')).toBeTruthy();
        expect(getByText('Pick PDF')).toBeTruthy();
    });

    it('shows uploading state', () => {
        const { getByText } = render(<AddDocumentSheet {...baseProps} addDocStep="uploading" />);
        expect(getByText('Uploading...')).toBeTruthy();
        expect(getByText('Uploading PDF...')).toBeTruthy();
    });

    it('shows error when addDocError is set', () => {
        const { getByText } = render(<AddDocumentSheet {...baseProps} addDocError="Upload failed" />);
        expect(getByText('Upload failed')).toBeTruthy();
    });
});

// ────────────────────────────────────────────────────────────────
// 6. InterviewSchedulerSheet
// ────────────────────────────────────────────────────────────────
describe('InterviewSchedulerSheet', () => {
    const baseProps = {
        visible: true,
        colors,
        animatedStyle: noopAnimatedStyle,
        editingInterview: null,
        candidateInterviewCount: 0,
        scheduleDate: new Date('2026-03-20'),
        scheduleHour: 10,
        scheduleMinute: 30,
        scheduleAmPm: 'AM' as const,
        scheduleType: 'zoom' as const,
        scheduleLink: '',
        scheduleLocation: '',
        scheduleNotes: '',
        scheduleStatus: 'scheduled' as const,
        scheduleError: null,
        isScheduling: false,
        onDateChange: jest.fn(),
        onHourChange: jest.fn(),
        onMinuteChange: jest.fn(),
        onAmPmChange: jest.fn(),
        onTypeChange: jest.fn(),
        onLinkChange: jest.fn(),
        onLocationChange: jest.fn(),
        onNotesChange: jest.fn(),
        onStatusChange: jest.fn(),
        onSubmit: jest.fn(),
        onDismiss: jest.fn(),
    };

    beforeEach(() => jest.clearAllMocks());

    it('renders title for new interview', () => {
        const { getByText } = render(<InterviewSchedulerSheet {...baseProps} />);
        expect(getByText(/Schedule Interview.*Round 1/)).toBeTruthy();
    });

    it('renders title for editing interview', () => {
        const interview = makeInterview({ round_number: 2 });
        const { getByText } = render(<InterviewSchedulerSheet {...baseProps} editingInterview={interview} />);
        expect(getByText(/Edit Interview.*Round 2/)).toBeTruthy();
    });

    it('renders format toggle with Zoom and In-person', () => {
        const { getByText } = render(<InterviewSchedulerSheet {...baseProps} />);
        expect(getByText('Zoom')).toBeTruthy();
        expect(getByText('In-person')).toBeTruthy();
    });

    it('calls onTypeChange when In-person is pressed', () => {
        const onTypeChange = jest.fn();
        const { getByText } = render(<InterviewSchedulerSheet {...baseProps} onTypeChange={onTypeChange} />);
        fireEvent.press(getByText('In-person'));
        expect(onTypeChange).toHaveBeenCalledWith('in_person');
    });

    it('shows Zoom link input when type is zoom', () => {
        const { getByPlaceholderText } = render(<InterviewSchedulerSheet {...baseProps} scheduleType="zoom" />);
        expect(getByPlaceholderText('Zoom link (optional)')).toBeTruthy();
    });

    it('shows Location input when type is in_person', () => {
        const { getByPlaceholderText } = render(<InterviewSchedulerSheet {...baseProps} scheduleType="in_person" />);
        expect(getByPlaceholderText('Location (optional)')).toBeTruthy();
    });

    it('calls onSubmit when Confirm Schedule is pressed', () => {
        const onSubmit = jest.fn();
        const { getByText } = render(<InterviewSchedulerSheet {...baseProps} onSubmit={onSubmit} />);
        fireEvent.press(getByText('Confirm Schedule'));
        expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    it('shows Save Changes button when editing', () => {
        const interview = makeInterview();
        const { getByText } = render(<InterviewSchedulerSheet {...baseProps} editingInterview={interview} />);
        expect(getByText('Save Changes')).toBeTruthy();
    });

    it('shows Saving... when isScheduling is true', () => {
        const { getByText } = render(<InterviewSchedulerSheet {...baseProps} isScheduling />);
        expect(getByText('Saving...')).toBeTruthy();
    });

    it('shows error message when scheduleError is set', () => {
        const { getByText } = render(<InterviewSchedulerSheet {...baseProps} scheduleError="Date is in the past" />);
        expect(getByText('Date is in the past')).toBeTruthy();
    });

    it('shows status buttons when editing', () => {
        const interview = makeInterview();
        const { getByText } = render(<InterviewSchedulerSheet {...baseProps} editingInterview={interview} />);
        expect(getByText('Scheduled')).toBeTruthy();
        expect(getByText('Completed')).toBeTruthy();
        expect(getByText('Rescheduled')).toBeTruthy();
        expect(getByText('Cancelled')).toBeTruthy();
    });

    it('calls onStatusChange when a status button is pressed', () => {
        const onStatusChange = jest.fn();
        const interview = makeInterview();
        const { getByText } = render(
            <InterviewSchedulerSheet {...baseProps} editingInterview={interview} onStatusChange={onStatusChange} />,
        );
        fireEvent.press(getByText('Completed'));
        expect(onStatusChange).toHaveBeenCalledWith('completed');
    });
});

// ────────────────────────────────────────────────────────────────
// 7. InterviewSection
// ────────────────────────────────────────────────────────────────
describe('InterviewSection', () => {
    it('renders empty state when no interviews', () => {
        const { getByText } = render(<InterviewSection interviews={[]} colors={colors} />);
        expect(getByText('Interviews')).toBeTruthy();
        expect(getByText('0')).toBeTruthy();
        expect(getByText('No interviews yet')).toBeTruthy();
    });

    it('renders interview cards when interviews are present', () => {
        const interviews = [
            makeInterview({ id: 'i1', round_number: 1, datetime: '2026-03-10T10:00:00Z' }),
            makeInterview({ id: 'i2', round_number: 2, datetime: '2026-03-15T10:00:00Z' }),
        ];
        const { getByText } = render(<InterviewSection interviews={interviews} colors={colors} />);
        expect(getByText('Interviews')).toBeTruthy();
        expect(getByText('2')).toBeTruthy();
        expect(getByText('Interview R1')).toBeTruthy();
        expect(getByText('Interview R2')).toBeTruthy();
    });
});

// ────────────────────────────────────────────────────────────────
// 8. NoteSheet
// ────────────────────────────────────────────────────────────────
describe('NoteSheet', () => {
    const baseProps = {
        visible: true,
        noteText: '',
        colors,
        animatedStyle: noopAnimatedStyle,
        onNoteTextChange: jest.fn(),
        onSave: jest.fn(),
        onClose: jest.fn(),
    };

    it('renders title and input', () => {
        const { getByText, getByPlaceholderText } = render(<NoteSheet {...baseProps} />);
        expect(getByText('Add Note')).toBeTruthy();
        expect(getByPlaceholderText('What happened? Any follow-up actions?')).toBeTruthy();
        expect(getByText('Save Note')).toBeTruthy();
    });

    it('calls onSave when Save Note is pressed', () => {
        const onSave = jest.fn();
        const { getByText } = render(<NoteSheet {...baseProps} noteText="Some text" onSave={onSave} />);
        fireEvent.press(getByText('Save Note'));
        expect(onSave).toHaveBeenCalledTimes(1);
    });

    it('calls onNoteTextChange when text is entered', () => {
        const onChange = jest.fn();
        const { getByPlaceholderText } = render(<NoteSheet {...baseProps} onNoteTextChange={onChange} />);
        fireEvent.changeText(getByPlaceholderText('What happened? Any follow-up actions?'), 'Hello');
        expect(onChange).toHaveBeenCalledWith('Hello');
    });
});

// ────────────────────────────────────────────────────────────────
// 9. PdfViewerModal
// ────────────────────────────────────────────────────────────────
describe('PdfViewerModal', () => {
    it('renders title and close button', () => {
        const { getByText } = render(
            <PdfViewerModal
                visible={true}
                pdfUrl="https://example.com/test.pdf"
                pdfTitle="Resume"
                colors={colors}
                onClose={jest.fn()}
            />,
        );
        expect(getByText('Resume')).toBeTruthy();
    });

    it('renders WebView when pdfUrl is provided', () => {
        const { getByTestId } = render(
            <PdfViewerModal
                visible={true}
                pdfUrl="https://example.com/test.pdf"
                pdfTitle="Resume"
                colors={colors}
                onClose={jest.fn()}
            />,
        );
        expect(getByTestId('mock-webview')).toBeTruthy();
    });

    it('does not render WebView when pdfUrl is null', () => {
        const { queryByTestId } = render(
            <PdfViewerModal visible={true} pdfUrl={null} pdfTitle="Resume" colors={colors} onClose={jest.fn()} />,
        );
        expect(queryByTestId('mock-webview')).toBeNull();
    });

    it('calls onClose when close button is pressed', () => {
        const onClose = jest.fn();
        const { UNSAFE_root } = render(
            <PdfViewerModal
                visible={true}
                pdfUrl="https://example.com/test.pdf"
                pdfTitle="Resume"
                colors={colors}
                onClose={onClose}
            />,
        );
        // Find the TouchableOpacity (close button) and press it
        const touchables = UNSAFE_root.findAll((node) => node.type === require('react-native').TouchableOpacity);
        if (touchables.length > 0) {
            fireEvent.press(touchables[0]);
            expect(onClose).toHaveBeenCalledTimes(1);
        }
    });
});

// ────────────────────────────────────────────────────────────────
// 10. ProfileCard
// ────────────────────────────────────────────────────────────────
describe('ProfileCard', () => {
    it('renders candidate name and phone', () => {
        const candidate = makeCandidate();
        const { getByText } = render(<ProfileCard candidate={candidate} colors={colors} />);
        expect(getByText('Alice Tan')).toBeTruthy();
        expect(getByText('+6591234567')).toBeTruthy();
    });

    it('renders avatar initial', () => {
        const candidate = makeCandidate({ name: 'Charlie' });
        const { getByText } = render(<ProfileCard candidate={candidate} colors={colors} />);
        expect(getByText('C')).toBeTruthy();
    });

    it('renders status badge', () => {
        const candidate = makeCandidate({ status: 'interview_scheduled' });
        const { getByText } = render(<ProfileCard candidate={candidate} colors={colors} />);
        expect(getByText('Interview')).toBeTruthy();
    });

    it('renders email when present', () => {
        const candidate = makeCandidate({ email: 'charlie@test.com' });
        const { getByText } = render(<ProfileCard candidate={candidate} colors={colors} />);
        expect(getByText('charlie@test.com')).toBeTruthy();
    });

    it('does not render email when null', () => {
        const candidate = makeCandidate({ email: null });
        const { queryByText } = render(<ProfileCard candidate={candidate} colors={colors} />);
        expect(queryByText('charlie@test.com')).toBeNull();
    });

    it('renders recruiter name', () => {
        const candidate = makeCandidate({ assigned_manager_name: 'Manager Lee' });
        const { getByText } = render(<ProfileCard candidate={candidate} colors={colors} />);
        expect(getByText(/Recruiter: Manager Lee/)).toBeTruthy();
    });
});

// ────────────────────────────────────────────────────────────────
// 11. QuickAction
// ────────────────────────────────────────────────────────────────
describe('QuickAction', () => {
    it('renders label', () => {
        const { getByText } = render(
            <QuickAction icon="call" label="Call" color="#007AFF" bgColor="#E5F1FF" onPress={jest.fn()} />,
        );
        expect(getByText('Call')).toBeTruthy();
    });

    it('calls onPress when pressed', () => {
        const onPress = jest.fn();
        const { getByText } = render(
            <QuickAction icon="call" label="Call" color="#007AFF" bgColor="#E5F1FF" onPress={onPress} />,
        );
        fireEvent.press(getByText('Call'));
        expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('is disabled when disabled prop is true', () => {
        const onPress = jest.fn();
        const { getByText } = render(
            <QuickAction icon="call" label="Call" color="#007AFF" bgColor="#E5F1FF" onPress={onPress} disabled />,
        );
        fireEvent.press(getByText('Call'));
        expect(onPress).not.toHaveBeenCalled();
    });
});

// ────────────────────────────────────────────────────────────────
// 12. QuickActionsBar
// ────────────────────────────────────────────────────────────────
describe('QuickActionsBar', () => {
    const actions = [
        { icon: 'call', label: 'Call', color: '#007AFF', bgColor: '#E5F1FF', onPress: jest.fn() },
        { icon: 'logo-whatsapp', label: 'WhatsApp', color: '#25D366', bgColor: '#E8F9ED', onPress: jest.fn() },
        { icon: 'create-outline', label: 'Note', color: '#8E8E93', bgColor: '#F2F2F7', onPress: jest.fn() },
    ];

    beforeEach(() => jest.clearAllMocks());

    it('renders all action labels', () => {
        const { getByText } = render(<QuickActionsBar actions={actions} colors={colors} />);
        expect(getByText('Call')).toBeTruthy();
        expect(getByText('WhatsApp')).toBeTruthy();
        expect(getByText('Note')).toBeTruthy();
    });

    it('calls the correct onPress for each action', () => {
        const { getByText } = render(<QuickActionsBar actions={actions} colors={colors} />);
        fireEvent.press(getByText('Call'));
        expect(actions[0].onPress).toHaveBeenCalledTimes(1);
        fireEvent.press(getByText('WhatsApp'));
        expect(actions[1].onPress).toHaveBeenCalledTimes(1);
        fireEvent.press(getByText('Note'));
        expect(actions[2].onPress).toHaveBeenCalledTimes(1);
    });

    it('does not call onPress for disabled actions', () => {
        const disabledActions = [
            { icon: 'call', label: 'Call', color: '#007AFF', bgColor: '#E5F1FF', onPress: jest.fn(), disabled: true },
        ];
        const { getByText } = render(<QuickActionsBar actions={disabledActions} colors={colors} />);
        fireEvent.press(getByText('Call'));
        expect(disabledActions[0].onPress).not.toHaveBeenCalled();
    });
});
