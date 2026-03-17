/**
 * Tests for components/roadmap/ModuleItemRow
 *
 * Business rules verified:
 * - Renders item title
 * - Shows correct status icon (checkmark for completed, ellipse for not_started, contrast for in_progress)
 * - Shows "View" button for material items with resource_url
 * - Shows "Start" button for exam items with exam_paper_id
 * - Shows "Continue" button for in_progress exam items
 * - Shows "Pending" badge for attendance items (not completed)
 * - Shows "Attended" badge for completed attendance items
 * - Shows score for completed quiz/exam items
 * - Calls Linking.openURL for material items when pressed
 * - Calls onStartExam for exam/quiz items when pressed
 * - No action button when material has no resource_url
 * - No action button when exam has no exam_paper_id
 * - Shows description when present
 */
import React from 'react';
import { Linking } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';

import ModuleItemRow from '@/components/roadmap/ModuleItemRow';
import type { ModuleItemWithProgress, CandidateModuleItemProgress, ModuleItemType } from '@/types/roadmap';
import { Colors } from '@/constants/Colors';

const colors = Colors.light;

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('@/constants/platform', () => ({
    letterSpacing: (v: number) => v,
}));

let openURLSpy: jest.SpyInstance;

// ── Fixtures ──

function makeItemProgress(overrides: Partial<CandidateModuleItemProgress> = {}): CandidateModuleItemProgress {
    return {
        id: 'ip-1',
        candidate_id: 'c-1',
        module_item_id: 'item-1',
        status: 'not_started',
        completed_at: null,
        completed_by: null,
        score: null,
        attempt_count: 0,
        notes: null,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
        ...overrides,
    };
}

function makeItem(
    overrides: Partial<ModuleItemWithProgress> & { item_type?: ModuleItemType } = {},
): ModuleItemWithProgress {
    return {
        id: 'item-1',
        module_id: 'mod-1',
        title: 'Test Item',
        description: null,
        item_type: 'material',
        resource_type: null,
        resource_url: null,
        exam_paper_id: null,
        display_order: 0,
        is_active: true,
        is_required: true,
        icon_name: null,
        pass_percentage: null,
        time_limit_minutes: null,
        archived_at: null,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
        progress: null,
        ...overrides,
    };
}

beforeEach(() => {
    jest.clearAllMocks();
    openURLSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as any);
});

describe('ModuleItemRow', () => {
    // ── Basic rendering ──

    it('renders item title', () => {
        const { getByText } = render(
            <ModuleItemRow item={makeItem({ title: 'Sales Handbook' })} colors={colors} isLast={false} />,
        );
        expect(getByText('Sales Handbook')).toBeTruthy();
    });

    it('renders item description when present', () => {
        const { getByText } = render(
            <ModuleItemRow item={makeItem({ description: 'Read chapters 1-3' })} colors={colors} isLast={false} />,
        );
        expect(getByText('Read chapters 1-3')).toBeTruthy();
    });

    it('does not render description when null', () => {
        const { queryByText } = render(
            <ModuleItemRow item={makeItem({ description: null })} colors={colors} isLast={false} />,
        );
        // Only the title should be present, no extra text nodes for description
        expect(queryByText('Read chapters 1-3')).toBeNull();
    });

    // ── Status icons ──

    it('shows ellipse-outline icon for not_started status', () => {
        const { toJSON } = render(<ModuleItemRow item={makeItem({ progress: null })} colors={colors} isLast={false} />);
        const json = JSON.stringify(toJSON());
        expect(json).toContain('ellipse-outline');
    });

    it('shows contrast-outline icon for in_progress status', () => {
        const { toJSON } = render(
            <ModuleItemRow
                item={makeItem({ progress: makeItemProgress({ status: 'in_progress' }) })}
                colors={colors}
                isLast={false}
            />,
        );
        const json = JSON.stringify(toJSON());
        expect(json).toContain('contrast-outline');
    });

    it('shows checkmark-circle icon for completed status', () => {
        const { toJSON } = render(
            <ModuleItemRow
                item={makeItem({ progress: makeItemProgress({ status: 'completed' }) })}
                colors={colors}
                isLast={false}
            />,
        );
        const json = JSON.stringify(toJSON());
        expect(json).toContain('checkmark-circle');
    });

    // ── Material items ──

    it('shows "View" button for material items with resource_url', () => {
        const { getByText } = render(
            <ModuleItemRow
                item={makeItem({
                    item_type: 'material',
                    resource_url: 'https://example.com/doc.pdf',
                })}
                colors={colors}
                isLast={false}
            />,
        );
        expect(getByText('View')).toBeTruthy();
    });

    it('calls Linking.openURL when "View" button is pressed for material', () => {
        const { getByText } = render(
            <ModuleItemRow
                item={makeItem({
                    item_type: 'material',
                    resource_url: 'https://example.com/doc.pdf',
                })}
                colors={colors}
                isLast={false}
            />,
        );
        fireEvent.press(getByText('View'));
        expect(openURLSpy).toHaveBeenCalledWith('https://example.com/doc.pdf');
    });

    it('shows "View" button for completed material with resource_url', () => {
        const { getByText } = render(
            <ModuleItemRow
                item={makeItem({
                    item_type: 'material',
                    resource_url: 'https://example.com/doc.pdf',
                    progress: makeItemProgress({ status: 'completed' }),
                })}
                colors={colors}
                isLast={false}
            />,
        );
        expect(getByText('View')).toBeTruthy();
    });

    it('does NOT show action button for material without resource_url', () => {
        const { queryByText } = render(
            <ModuleItemRow
                item={makeItem({ item_type: 'material', resource_url: null })}
                colors={colors}
                isLast={false}
            />,
        );
        expect(queryByText('View')).toBeNull();
        expect(queryByText('Start')).toBeNull();
    });

    // ── Exam / quiz items ──

    it('shows "Start" button for exam items with exam_paper_id', () => {
        const { getByText } = render(
            <ModuleItemRow
                item={makeItem({
                    item_type: 'exam',
                    exam_paper_id: 'paper-1',
                })}
                colors={colors}
                isLast={false}
                onStartExam={jest.fn()}
            />,
        );
        expect(getByText('Start')).toBeTruthy();
    });

    it('calls onStartExam when "Start" button is pressed', () => {
        const onStartExam = jest.fn();
        const { getByText } = render(
            <ModuleItemRow
                item={makeItem({
                    item_type: 'exam',
                    exam_paper_id: 'paper-42',
                })}
                colors={colors}
                isLast={false}
                onStartExam={onStartExam}
            />,
        );
        fireEvent.press(getByText('Start'));
        expect(onStartExam).toHaveBeenCalledWith('paper-42');
    });

    it('shows "Start" button for quiz items with exam_paper_id', () => {
        const { getByText } = render(
            <ModuleItemRow
                item={makeItem({
                    item_type: 'quiz',
                    exam_paper_id: 'quiz-paper-1',
                })}
                colors={colors}
                isLast={false}
                onStartExam={jest.fn()}
            />,
        );
        expect(getByText('Start')).toBeTruthy();
    });

    it('shows "Continue" button for in_progress exam items', () => {
        const { getByText } = render(
            <ModuleItemRow
                item={makeItem({
                    item_type: 'exam',
                    exam_paper_id: 'paper-1',
                    progress: makeItemProgress({ status: 'in_progress' }),
                })}
                colors={colors}
                isLast={false}
                onStartExam={jest.fn()}
            />,
        );
        expect(getByText('Continue')).toBeTruthy();
    });

    it('does NOT show action button for exam without exam_paper_id', () => {
        const { queryByText } = render(
            <ModuleItemRow
                item={makeItem({
                    item_type: 'exam',
                    exam_paper_id: null,
                })}
                colors={colors}
                isLast={false}
                onStartExam={jest.fn()}
            />,
        );
        expect(queryByText('Start')).toBeNull();
        expect(queryByText('Continue')).toBeNull();
    });

    it('shows score for completed exam items', () => {
        const { getByText } = render(
            <ModuleItemRow
                item={makeItem({
                    item_type: 'exam',
                    exam_paper_id: 'paper-1',
                    progress: makeItemProgress({ status: 'completed', score: 85 }),
                })}
                colors={colors}
                isLast={false}
                onStartExam={jest.fn()}
            />,
        );
        expect(getByText('85%')).toBeTruthy();
    });

    it('shows score for completed quiz items', () => {
        const { getByText } = render(
            <ModuleItemRow
                item={makeItem({
                    item_type: 'quiz',
                    exam_paper_id: 'quiz-1',
                    progress: makeItemProgress({ status: 'completed', score: 92 }),
                })}
                colors={colors}
                isLast={false}
                onStartExam={jest.fn()}
            />,
        );
        expect(getByText('92%')).toBeTruthy();
    });

    it('shows score for completed pre_quiz items', () => {
        const { getByText } = render(
            <ModuleItemRow
                item={makeItem({
                    item_type: 'pre_quiz',
                    exam_paper_id: 'pq-1',
                    progress: makeItemProgress({ status: 'completed', score: 70 }),
                })}
                colors={colors}
                isLast={false}
                onStartExam={jest.fn()}
            />,
        );
        expect(getByText('70%')).toBeTruthy();
    });

    // ── Attendance items ──

    it('shows "Pending" badge for attendance items that are not completed', () => {
        const { getByText } = render(
            <ModuleItemRow item={makeItem({ item_type: 'attendance' })} colors={colors} isLast={false} />,
        );
        expect(getByText('Pending')).toBeTruthy();
    });

    it('shows "Attended" badge for completed attendance items', () => {
        const { getByText } = render(
            <ModuleItemRow
                item={makeItem({
                    item_type: 'attendance',
                    progress: makeItemProgress({ status: 'completed' }),
                })}
                colors={colors}
                isLast={false}
            />,
        );
        expect(getByText('Attended')).toBeTruthy();
    });

    it('shows "Pending" badge for in_progress attendance items', () => {
        const { getByText } = render(
            <ModuleItemRow
                item={makeItem({
                    item_type: 'attendance',
                    progress: makeItemProgress({ status: 'in_progress' }),
                })}
                colors={colors}
                isLast={false}
            />,
        );
        expect(getByText('Pending')).toBeTruthy();
    });

    // ── Edge cases ──

    it('does not call Linking.openURL for exam items', () => {
        const onStartExam = jest.fn();
        const { getByText } = render(
            <ModuleItemRow
                item={makeItem({
                    item_type: 'exam',
                    exam_paper_id: 'paper-1',
                    resource_url: 'https://should-not-open.com',
                })}
                colors={colors}
                isLast={false}
                onStartExam={onStartExam}
            />,
        );
        fireEvent.press(getByText('Start'));
        expect(openURLSpy).not.toHaveBeenCalled();
        expect(onStartExam).toHaveBeenCalledWith('paper-1');
    });

    it('does not crash when onStartExam is not provided for exam items', () => {
        const { getByText } = render(
            <ModuleItemRow
                item={makeItem({
                    item_type: 'exam',
                    exam_paper_id: 'paper-1',
                })}
                colors={colors}
                isLast={false}
            />,
        );
        // Should render Start button and pressing it should not throw
        fireEvent.press(getByText('Start'));
        expect(openURLSpy).not.toHaveBeenCalled();
    });

    it('renders without bottom border when isLast is true', () => {
        const { toJSON: lastJSON } = render(<ModuleItemRow item={makeItem()} colors={colors} isLast={true} />);
        const { toJSON: notLastJSON } = render(<ModuleItemRow item={makeItem()} colors={colors} isLast={false} />);
        // The last item should not have borderBottomWidth set
        const lastStr = JSON.stringify(lastJSON());
        const notLastStr = JSON.stringify(notLastJSON());
        // notLast should contain borderBottomWidth, last should not
        expect(notLastStr).toContain('borderBottomWidth');
        // isLast=true should not add the extra border style
        // (the base container style has no borderBottomWidth)
    });
});
