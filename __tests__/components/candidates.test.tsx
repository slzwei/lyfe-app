/**
 * Tests for components/candidates/ — active components.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Colors } from '@/constants/Colors';

import ContactOutcomeSheet from '@/components/candidates/ContactOutcomeSheet';
import { DocumentList, AddDocumentSheet } from '@/components/candidates/DocumentSection';
import InterviewSchedulerSheet from '@/components/candidates/InterviewSchedulerSheet';
import NoteSheet from '@/components/candidates/NoteSheet';
import PdfViewerModal from '@/components/candidates/PdfViewerModal';
import QuickActionsBar from '@/components/candidates/QuickActionsBar';

import type { Interview, CandidateDocument } from '@/types/recruitment';

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

jest.mock('react-native-pdf', () => {
    const { View } = require('react-native');
    return {
        __esModule: true,
        default: (props: any) => <View testID="mock-pdf-view" {...props} />,
    };
});

jest.mock('@/components/WheelPicker', () => {
    const { View } = require('react-native');
    return function MockWheelPicker() {
        return <View testID="mock-wheel-picker" />;
    };
});

// ── Shared helpers ──

const colors = Colors.light;

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
        recommendation: null,
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
// 1. ContactOutcomeSheet
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
// 2. DocumentSection (DocumentList + AddDocumentSheet)
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
// 3. InterviewSchedulerSheet
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
        scheduleRecommendation: null,
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
        onRecommendationChange: jest.fn(),
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
// 4. NoteSheet
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
// 5. PdfViewerModal
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

    it('renders Pdf component when pdfUrl is provided', () => {
        const { getByTestId } = render(
            <PdfViewerModal
                visible={true}
                pdfUrl="https://example.com/test.pdf"
                pdfTitle="Resume"
                colors={colors}
                onClose={jest.fn()}
            />,
        );
        expect(getByTestId('mock-pdf-view')).toBeTruthy();
    });

    it('does not render Pdf component when pdfUrl is null', () => {
        const { queryByTestId } = render(
            <PdfViewerModal visible={true} pdfUrl={null} pdfTitle="Resume" colors={colors} onClose={jest.fn()} />,
        );
        expect(queryByTestId('mock-pdf-view')).toBeNull();
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
        const touchables = UNSAFE_root.findAll((node: any) => node.type === require('react-native').TouchableOpacity);
        if (touchables.length > 0) {
            fireEvent.press(touchables[0]);
            expect(onClose).toHaveBeenCalledTimes(1);
        }
    });
});

// ────────────────────────────────────────────────────────────────
// 6. QuickActionsBar
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
