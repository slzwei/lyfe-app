/**
 * Tests for the leads-scoped UI primitives (Monogram / StatusChip / SourceBadge).
 * These are the re-skinned mktr-leads building blocks; they read the leads theme
 * bridge (useLeadsTheme → useTheme), so the theme context is mocked to the light
 * palette. resolveLeadSource itself is covered in lib/leads/meta.test.ts.
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { STATUS_LABELS } from '@/lib/leads/theme';
import { Monogram } from '@/components/leads/ui/Monogram';
import { StatusChip } from '@/components/leads/ui/StatusChip';
import { SourceBadge } from '@/components/leads/ui/SourceBadge';

jest.mock('@/contexts/ThemeContext', () => ({
    useTheme: () => ({ colors: jest.requireActual('@/constants/Colors').Colors.light, isDark: false }),
}));

describe('Monogram', () => {
    it('renders the uppercased first initial of the name', () => {
        const { getByText } = render(<Monogram name="siti rahman" status="new" />);
        expect(getByText('S')).toBeTruthy();
    });

    it('falls back to "?" for a blank / missing name', () => {
        const { getByText } = render(<Monogram name="   " />);
        expect(getByText('?')).toBeTruthy();
    });
});

describe('StatusChip', () => {
    it('renders the human label for each status', () => {
        (Object.keys(STATUS_LABELS) as (keyof typeof STATUS_LABELS)[]).forEach((status) => {
            const { getByText, unmount } = render(<StatusChip status={status} />);
            expect(getByText(STATUS_LABELS[status])).toBeTruthy();
            unmount();
        });
    });
});

describe('SourceBadge', () => {
    it('renders for an MKTR lead without crashing', () => {
        const { toJSON } = render(<SourceBadge lead={{ source: 'online', source_name: 'mktr' }} />);
        expect(toJSON()).toBeTruthy();
    });

    it('renders for a referral lead without crashing', () => {
        const { toJSON } = render(<SourceBadge lead={{ source: 'referral', source_name: null }} />);
        expect(toJSON()).toBeTruthy();
    });
});
