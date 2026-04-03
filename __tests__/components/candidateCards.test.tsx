/**
 * Tests for candidate detail card components at 0% coverage
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Colors } from '@/constants/Colors';

jest.mock('@/lib/supabase');

const colors = Colors.light;

// ── ApplicationDetailsCard ──

describe('ApplicationDetailsCard', () => {
    const ApplicationDetailsCard = require('@/components/candidates/ApplicationDetailsCard').default;

    const PROFILE = {
        completed: true,
        onboarding_step: 5,
        full_name: 'Jane Smith',
        chinese_name: null,
        alias: 'JaneS',
        date_of_birth: '1990-05-15',
        nationality: 'Singaporean',
        race: 'Chinese',
        gender: 'Female',
        marital_status: 'Single',
        address_block: '123',
        address_street: 'Main Street',
        address_unit: '#01-02',
        address_postal: '123456',
        position_applied: 'Financial Advisor',
        expected_salary: 5000,
        salary_period: 'month',
        date_available: '2026-04-01',
        emergency_name: 'John Smith',
        emergency_relationship: 'Father',
        emergency_contact: '+6591234567',
        education: [{ institution: 'NUS', qualification: 'BSc Finance', year: '2015' }],
        employment_history: [
            { company: 'DBS', position: 'Analyst', period: '2015-2020', reason_for_leaving: 'Career change' },
        ],
        languages: [{ language: 'English', spoken: 'Fluent', written: 'Fluent' }],
        software_competencies: 'Excel, PowerPoint',
        typing_wpm: 60,
        shorthand_wpm: null,
    };

    it('renders collapsed by default', () => {
        const { getByText, queryByText } = render(<ApplicationDetailsCard profile={PROFILE} colors={colors} />);
        expect(getByText('Application Details')).toBeTruthy();
        expect(getByText('Completed')).toBeTruthy();
        expect(queryByText('Jane Smith')).toBeNull();
    });

    it('expands on header press to show profile details', () => {
        const { getByText } = render(<ApplicationDetailsCard profile={PROFILE} colors={colors} />);
        fireEvent.press(getByText('Application Details'));
        expect(getByText('Jane Smith')).toBeTruthy();
        expect(getByText('Singaporean')).toBeTruthy();
        expect(getByText('Financial Advisor')).toBeTruthy();
        expect(getByText('NUS')).toBeTruthy();
        expect(getByText(/Analyst at DBS/)).toBeTruthy();
        expect(getByText('English')).toBeTruthy();
        expect(getByText('Excel, PowerPoint')).toBeTruthy();
    });

    it('shows step progress when not completed', () => {
        const incomplete = { ...PROFILE, completed: false, onboarding_step: 3 };
        const { getByText } = render(<ApplicationDetailsCard profile={incomplete} colors={colors} />);
        expect(getByText('Step 3 of 5')).toBeTruthy();
    });

    it('renders address correctly', () => {
        const { getByText } = render(<ApplicationDetailsCard profile={PROFILE} colors={colors} />);
        fireEvent.press(getByText('Application Details'));
        expect(getByText('123, Main Street, #01-02, 123456')).toBeTruthy();
    });
});

// ── InterviewCard ──

describe('InterviewCard', () => {
    const InterviewCard = require('@/components/candidates/InterviewCard').default;

    it('renders interview details', () => {
        const interview = {
            id: 'iv-1',
            candidate_id: 'cand-1',
            manager_id: 'mgr-1',
            scheduled_by_id: 'mgr-1',
            round_number: 1,
            type: 'zoom',
            datetime: '2026-04-10T14:00:00Z',
            location: null,
            zoom_link: 'https://zoom.us/123',
            notes: 'First round',
            status: 'scheduled',
        };

        const { getByText } = render(<InterviewCard interview={interview} colors={colors} />);
        expect(getByText(/Round 1/)).toBeTruthy();
    });
});

// ── DiscResultsCard ──

describe('DiscResultsCard', () => {
    const DiscResultsCard = require('@/components/candidates/DiscResultsCard').default;

    it('renders DISC scores', () => {
        const discResults = {
            d_pct: 30,
            i_pct: 25,
            s_pct: 20,
            c_pct: 25,
            disc_type: 'Di',
            angle: 45,
        };

        const { getByText } = render(<DiscResultsCard discResults={discResults} colors={colors} />);
        expect(getByText(/30%/)).toBeTruthy();
    });
});
