import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import MilestonesSection from '@/components/candidates/MilestonesSection';
import { Colors } from '@/constants/Colors';
import type { CandidateMilestone, MilestoneCode } from '@/types/recruitment';

const colors = Colors.light;

function emptyMap(): Record<MilestoneCode, CandidateMilestone | null> {
    return { bdm: null, bes_induction: null, soar: null, rnf: null, sales_authority: null };
}

function completedBdm(): CandidateMilestone {
    return {
        id: 'ms-bdm',
        candidate_id: 'c1',
        milestone_code: 'bdm',
        status: 'completed',
        scheduled_date: null,
        scheduled_end_date: null,
        completed_date: '2026-04-10T00:00:00Z',
        reference_number: null,
        verified_by_user_id: null,
        note: null,
        created_at: '2026-04-01T00:00:00Z',
        updated_at: '2026-04-10T00:00:00Z',
    };
}

describe('MilestonesSection', () => {
    it('renders all five milestone rows (including BDM first) with testIDs', () => {
        const { getByTestId, getAllByText } = render(
            <MilestonesSection milestoneByCode={emptyMap()} colors={colors} onMark={jest.fn()} />,
        );
        expect(getByTestId('milestones-section-row-bdm')).toBeTruthy();
        expect(getByTestId('milestones-section-row-bes_induction')).toBeTruthy();
        expect(getByTestId('milestones-section-row-soar')).toBeTruthy();
        expect(getByTestId('milestones-section-row-rnf')).toBeTruthy();
        expect(getByTestId('milestones-section-row-sales_authority')).toBeTruthy();
        // all 5 rows start at "Not Started"
        expect(getAllByText('Not Started').length).toBe(5);
    });

    it('shows BDM completed state when milestone is marked complete', () => {
        const map = emptyMap();
        map.bdm = completedBdm();
        const { getAllByText } = render(<MilestonesSection milestoneByCode={map} colors={colors} />);
        // BDM completed + 4 others not started
        expect(getAllByText('Completed').length).toBe(1);
        expect(getAllByText('Not Started').length).toBe(4);
    });

    it('invokes onMark with code + label when the BDM row is pressed', () => {
        const onMark = jest.fn();
        const { getByTestId } = render(
            <MilestonesSection milestoneByCode={emptyMap()} colors={colors} onMark={onMark} />,
        );
        fireEvent.press(getByTestId('milestones-section-row-bdm'));
        expect(onMark).toHaveBeenCalledWith('bdm', 'BDM Interview');
    });
});
