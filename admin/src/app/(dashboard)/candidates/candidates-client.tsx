'use client';

import { useState } from 'react';
import { DataTable } from '@/components/data-table';
import {
  Candidate,
  CandidateActivity,
  Interview,
  CANDIDATE_STATUSES,
  CANDIDATE_STATUS_LABELS,
} from '@/lib/types';
import { getColumns } from './columns';
import { CandidateDetailSheet } from './candidate-detail-sheet';

interface CandidatesClientProps {
  candidates: Candidate[];
  interviews: Interview[];
  activities: CandidateActivity[];
}

const STATUS_FILTER_OPTIONS = CANDIDATE_STATUSES.map((s) => ({
  label: CANDIDATE_STATUS_LABELS[s],
  value: s,
}));

export function CandidatesClient({ candidates, interviews, activities }: CandidatesClientProps) {
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const columns = getColumns();

  const candidateInterviews = selectedCandidate
    ? interviews.filter((iv) => iv.candidate_id === selectedCandidate.id)
    : [];

  const candidateActivities = selectedCandidate
    ? activities.filter((act) => act.candidate_id === selectedCandidate.id)
    : [];

  return (
    <>
      <DataTable
        columns={columns}
        data={candidates}
        searchColumn="name"
        searchPlaceholder="Search candidates..."
        facetedFilters={[{ columnId: 'status', title: 'Status', options: STATUS_FILTER_OPTIONS }]}
        onRowClick={(candidate) => {
          setSelectedCandidate(candidate);
          setSheetOpen(true);
        }}
      />
      <CandidateDetailSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        candidate={selectedCandidate}
        interviews={candidateInterviews}
        activities={candidateActivities}
      />
    </>
  );
}
