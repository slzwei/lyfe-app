/**
 * Tests for components/roadmap/ModuleCard
 *
 * Business rules verified:
 * - Renders module title and description
 * - Status badges: Not Started, In Progress, Completed (with date)
 * - Type badges: Training vs Exam
 * - Learning objectives split by newline
 * - Resources section shown/hidden based on array contents
 * - "Take Exam" button for exam modules with exam_paper_id and onTakeExam
 * - Management notes shown when progress.notes is set
 * - Estimated duration display
 * - "Required" badge for is_required modules
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import ModuleCard from '@/components/roadmap/ModuleCard';
import type { RoadmapModuleWithProgress, RoadmapResource } from '@/types/roadmap';

// ── Theme mock ──
const COLORS: any = {
    textPrimary: '#111',
    textSecondary: '#555',
    textTertiary: '#999',
    background: '#FFF',
    border: '#E5E5E5',
    accent: '#FF7600',
    success: '#22C55E',
    surfacePrimary: '#F5F5F5',
    error: '#DC2626',
    errorBg: '#FEE2E2',
};

// ── Fixtures ──

function makeModule(overrides: Partial<RoadmapModuleWithProgress> = {}): RoadmapModuleWithProgress {
    return {
        id: 'mod-1',
        programme_id: 'prog-1',
        title: 'Introduction to Sales',
        description: null,
        learning_objectives: null,
        module_type: 'training',
        display_order: 1,
        is_active: true,
        is_required: true,
        estimated_minutes: 30,
        exam_paper_id: null,
        icon_name: null,
        icon_color: null,
        archived_at: null,
        archived_by: null,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        progress: null,
        resources: [],
        itemSummary: null,
        isLocked: false,
        examPaper: null,
        prerequisiteIds: [],
        isArchived: false,
        ...overrides,
    };
}

function makeResource(overrides: Partial<RoadmapResource> = {}): RoadmapResource {
    return {
        id: 'res-1',
        module_id: 'mod-1',
        title: 'Sales Handbook',
        description: 'Essential reading',
        resource_type: 'link',
        content_url: 'https://example.com/handbook',
        content_text: null,
        display_order: 1,
        is_active: true,
        created_at: '2026-01-01T00:00:00Z',
        ...overrides,
    };
}

beforeEach(() => jest.clearAllMocks());

describe('ModuleCard', () => {
    it('renders module title and description', () => {
        const module = makeModule({
            title: 'Sales Fundamentals',
            description: 'Learn the basics of insurance sales.',
        });
        const { getByText } = render(<ModuleCard module={module} colors={COLORS} />);

        expect(getByText('Sales Fundamentals')).toBeTruthy();
        expect(getByText('Learn the basics of insurance sales.')).toBeTruthy();
    });

    it('shows "Not Started" status badge when no progress', () => {
        const { getByText } = render(<ModuleCard module={makeModule()} colors={COLORS} />);
        expect(getByText('Not Started')).toBeTruthy();
    });

    it('shows "In Progress" status badge when status is in_progress', () => {
        const module = makeModule({
            progress: {
                id: 'p1',
                candidate_id: 'c1',
                module_id: 'mod-1',
                status: 'in_progress',
                completed_at: null,
                completed_by: null,
                score: null,
                notes: null,
                updated_at: '2026-02-01T00:00:00Z',
                created_at: '2026-01-15T00:00:00Z',
            },
        });
        const { getByText } = render(<ModuleCard module={module} colors={COLORS} />);
        expect(getByText('In Progress')).toBeTruthy();
    });

    it('shows "Completed" status badge and completed date when status is completed', () => {
        const module = makeModule({
            progress: {
                id: 'p1',
                candidate_id: 'c1',
                module_id: 'mod-1',
                status: 'completed',
                completed_at: '2026-02-15T10:30:00Z',
                completed_by: 'reviewer-1',
                score: null,
                notes: null,
                updated_at: '2026-02-15T10:30:00Z',
                created_at: '2026-01-15T00:00:00Z',
            },
        });
        const { getByText } = render(<ModuleCard module={module} colors={COLORS} />);
        expect(getByText('Completed')).toBeTruthy();
        // The date format uses en-SG locale: "15 Feb 2026"
        expect(getByText(/Completed on/)).toBeTruthy();
    });

    it('shows "Training" type badge for training modules', () => {
        const { getByText } = render(<ModuleCard module={makeModule({ module_type: 'training' })} colors={COLORS} />);
        expect(getByText('Training')).toBeTruthy();
    });

    it('shows "Exam" type badge for exam modules', () => {
        const { getByText } = render(<ModuleCard module={makeModule({ module_type: 'exam' })} colors={COLORS} />);
        expect(getByText('Exam')).toBeTruthy();
    });

    it('shows learning objectives when present (split by newline)', () => {
        const module = makeModule({
            learning_objectives: 'Understand basic sales process\nBuild client rapport\nClose deals effectively',
        });
        const { getByText } = render(<ModuleCard module={module} colors={COLORS} />);

        expect(getByText('Learning Objectives')).toBeTruthy();
        expect(getByText('Understand basic sales process')).toBeTruthy();
        expect(getByText('Build client rapport')).toBeTruthy();
        expect(getByText('Close deals effectively')).toBeTruthy();
    });

    it('shows resources section when resources array is non-empty', () => {
        const module = makeModule({
            resources: [makeResource({ title: 'Sales Handbook' })],
        });
        const { getByText } = render(<ModuleCard module={module} colors={COLORS} />);

        expect(getByText('Resources')).toBeTruthy();
        expect(getByText('Sales Handbook')).toBeTruthy();
    });

    it('does NOT show resources section when empty', () => {
        const module = makeModule({ resources: [] });
        const { queryByText } = render(<ModuleCard module={module} colors={COLORS} />);

        expect(queryByText('Resources')).toBeNull();
    });

    it('shows "Take Exam" button for exam modules with exam_paper_id and onTakeExam provided', () => {
        const onTakeExam = jest.fn();
        const module = makeModule({
            module_type: 'exam',
            exam_paper_id: 'paper-1',
            examPaper: { code: 'M9', title: 'M9 Mock Paper', pass_percentage: 70 },
        });
        const { getByText } = render(<ModuleCard module={module} colors={COLORS} onTakeExam={onTakeExam} />);

        const button = getByText('Take Exam');
        expect(button).toBeTruthy();
        fireEvent.press(button);
        expect(onTakeExam).toHaveBeenCalledTimes(1);
    });

    it('does NOT show "Take Exam" button for training modules', () => {
        const onTakeExam = jest.fn();
        const module = makeModule({ module_type: 'training' });
        const { queryByText } = render(<ModuleCard module={module} colors={COLORS} onTakeExam={onTakeExam} />);

        expect(queryByText('Take Exam')).toBeNull();
    });

    it('shows management notes when progress.notes is present', () => {
        const module = makeModule({
            progress: {
                id: 'p1',
                candidate_id: 'c1',
                module_id: 'mod-1',
                status: 'not_started',
                completed_at: null,
                completed_by: null,
                score: null,
                notes: 'Focus on chapter 3 and 4',
                updated_at: '2026-02-01T00:00:00Z',
                created_at: '2026-01-15T00:00:00Z',
            },
        });
        const { getByText } = render(<ModuleCard module={module} colors={COLORS} />);

        expect(getByText('Notes from your manager')).toBeTruthy();
        expect(getByText('Focus on chapter 3 and 4')).toBeTruthy();
    });

    it('shows estimated duration when estimated_minutes is set', () => {
        const module = makeModule({ estimated_minutes: 45 });
        const { getByText } = render(<ModuleCard module={module} colors={COLORS} />);

        expect(getByText('~45 min')).toBeTruthy();
    });

    it('shows "Required" badge when is_required is true', () => {
        const module = makeModule({ is_required: true });
        const { getByText } = render(<ModuleCard module={module} colors={COLORS} />);

        expect(getByText('Required')).toBeTruthy();
    });

    it('does NOT show "Required" badge when is_required is false', () => {
        const module = makeModule({ is_required: false });
        const { queryByText } = render(<ModuleCard module={module} colors={COLORS} />);

        expect(queryByText('Required')).toBeNull();
    });

    it('does NOT show estimated duration when estimated_minutes is null', () => {
        const module = makeModule({ estimated_minutes: null });
        const { queryByText } = render(<ModuleCard module={module} colors={COLORS} />);

        expect(queryByText(/min/)).toBeNull();
    });

    // ── Exam button label: "Retake Exam" vs "Take Exam" ─────────────

    it('shows "Retake Exam" button for a completed exam module', () => {
        const onTakeExam = jest.fn();
        const module = makeModule({
            module_type: 'exam',
            exam_paper_id: 'paper-1',
            examPaper: { code: 'M9', title: 'M9 Mock Paper', pass_percentage: 70 },
            progress: {
                id: 'p1',
                candidate_id: 'c1',
                module_id: 'mod-1',
                status: 'completed',
                completed_at: '2026-03-01T09:00:00Z',
                completed_by: 'manager-1',
                score: 85,
                notes: null,
                updated_at: '2026-03-01T09:00:00Z',
                created_at: '2026-02-01T00:00:00Z',
            },
        });
        const { getByText, queryByText } = render(
            <ModuleCard module={module} colors={COLORS} onTakeExam={onTakeExam} />,
        );

        expect(getByText('Retake Exam')).toBeTruthy();
        expect(queryByText('Take Exam')).toBeNull();
    });

    it('calls onTakeExam when "Retake Exam" button is pressed', () => {
        const onTakeExam = jest.fn();
        const module = makeModule({
            module_type: 'exam',
            exam_paper_id: 'paper-1',
            examPaper: { code: 'M9', title: 'M9 Mock Paper', pass_percentage: 70 },
            progress: {
                id: 'p1',
                candidate_id: 'c1',
                module_id: 'mod-1',
                status: 'completed',
                completed_at: '2026-03-01T09:00:00Z',
                completed_by: 'manager-1',
                score: 90,
                notes: null,
                updated_at: '2026-03-01T09:00:00Z',
                created_at: '2026-02-01T00:00:00Z',
            },
        });
        const { getByText } = render(<ModuleCard module={module} colors={COLORS} onTakeExam={onTakeExam} />);

        fireEvent.press(getByText('Retake Exam'));
        expect(onTakeExam).toHaveBeenCalledTimes(1);
    });

    it('shows "Take Exam" for an in-progress exam module (not completed)', () => {
        const onTakeExam = jest.fn();
        const module = makeModule({
            module_type: 'exam',
            exam_paper_id: 'paper-1',
            examPaper: { code: 'M9', title: 'M9 Mock Paper', pass_percentage: 70 },
            progress: {
                id: 'p1',
                candidate_id: 'c1',
                module_id: 'mod-1',
                status: 'in_progress',
                completed_at: null,
                completed_by: null,
                score: null,
                notes: null,
                updated_at: '2026-02-15T00:00:00Z',
                created_at: '2026-02-01T00:00:00Z',
            },
        });
        const { getByText, queryByText } = render(
            <ModuleCard module={module} colors={COLORS} onTakeExam={onTakeExam} />,
        );

        expect(getByText('Take Exam')).toBeTruthy();
        expect(queryByText('Retake Exam')).toBeNull();
    });

    it('shows "Take Exam" for a not-started exam module', () => {
        const onTakeExam = jest.fn();
        const module = makeModule({
            module_type: 'exam',
            exam_paper_id: 'paper-1',
            examPaper: { code: 'M9', title: 'M9 Mock Paper', pass_percentage: 70 },
            progress: null,
        });
        const { getByText, queryByText } = render(
            <ModuleCard module={module} colors={COLORS} onTakeExam={onTakeExam} />,
        );

        expect(getByText('Take Exam')).toBeTruthy();
        expect(queryByText('Retake Exam')).toBeNull();
    });

    it('uses MODULE_TYPE_COLOR_KEY for type badge color (roadmapTraining for training)', () => {
        const { Colors } = require('@/constants/Colors');
        const trainingColor = Colors.light.roadmapTraining;
        const module = makeModule({ module_type: 'training' });
        // Render with Colors.light so typeColor resolves to roadmapTraining
        const { toJSON } = render(<ModuleCard module={module} colors={Colors.light} />);
        const json = JSON.stringify(toJSON());
        // The badge background uses typeColor + '14' alpha suffix
        expect(json).toContain(trainingColor);
    });

    it('uses MODULE_TYPE_COLOR_KEY for exam type badge color (roadmapExam)', () => {
        const { Colors } = require('@/constants/Colors');
        const examColor = Colors.light.roadmapExam;
        const module = makeModule({
            module_type: 'exam',
            exam_paper_id: 'paper-1',
            examPaper: { code: 'M9', title: 'M9 Mock Paper', pass_percentage: 70 },
        });
        const { toJSON } = render(<ModuleCard module={module} colors={Colors.light} onTakeExam={jest.fn()} />);
        const json = JSON.stringify(toJSON());
        expect(json).toContain(examColor);
    });
});
