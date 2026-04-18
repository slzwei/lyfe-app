/**
 * Shared CandidateProgression state for a single candidate.
 *
 * Why: the candidate detail screen and its Papers sub-screen both need the
 * same progression snapshot. Without a shared Provider each screen would own
 * its own copy of the hook, and a write on the sub-screen would not reach the
 * detail screen until focus-refetched — producing a ~1s flicker on return.
 *
 * Put this Provider above both routes (in the tab's Stack layout). Both
 * screens then call `useCandidateProgressionContext()` and point at the same
 * state object, so any write propagates instantly.
 */
import { useCandidateProgression, type UseCandidateProgressionResult } from '@/hooks/useCandidateProgression';
import React, { createContext, useContext } from 'react';

const CandidateProgressionContext = createContext<UseCandidateProgressionResult | null>(null);

export function CandidateProgressionProvider({
    candidateId,
    children,
}: {
    candidateId: string | undefined;
    children: React.ReactNode;
}) {
    const value = useCandidateProgression(candidateId);
    return <CandidateProgressionContext.Provider value={value}>{children}</CandidateProgressionContext.Provider>;
}

export function useCandidateProgressionContext(): UseCandidateProgressionResult {
    const ctx = useContext(CandidateProgressionContext);
    if (!ctx) {
        throw new Error('useCandidateProgressionContext must be used inside <CandidateProgressionProvider>');
    }
    return ctx;
}
